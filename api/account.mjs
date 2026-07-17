// ═══════════════════════════════════════════════════════════
// Customer actions that need the service role (bypass RLS safely).
//
//   POST /api/account   { action: 'snapshot', source, source_id }
//     → server re-fetches the external listing and upserts it into
//       public.vehicles keyed by (source, source_id) → { vehicle_id }
//
//   POST /api/account   { action: 'order', source+source_id | vehicle_id }
//     → snapshot if external, then creates the order for the CALLER
//       (customer_id comes from the verified JWT, the price from the
//       server-side snapshot — neither can be forged by the browser)
//       → { order_id, vehicle_id }
//
// Auth: Authorization: Bearer <supabase access token> (required).
// Same-origin only — deliberately NO Access-Control-Allow-Origin.
// ═══════════════════════════════════════════════════════════

import { serviceClient, getCallerFromReq, fail } from './_lib/supa.mjs';
import { fetchVehicleRow } from './_lib/sources.mjs';

const MAX_OPEN_ORDERS = 10; // abuse guard: open pending_payment orders per user

// Upsert a snapshot keyed by (source, source_id).
// PostgREST can't infer our partial unique index, so: select → update|insert,
// with one retry on the unique-violation race.
async function upsertSnapshot(source, sourceId) {
  const db = serviceClient();
  const row = await fetchVehicleRow(source, sourceId);

  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: existing, error: selErr } = await db
      .from('vehicles').select('id, status')
      .eq('source', row.source).eq('source_id', row.source_id)
      .maybeSingle();
    if (selErr) throw new Error('vehicles select failed: ' + selErr.message);

    if (existing) {
      // refresh volatile fields; never touch status (admin owns it)
      const { error } = await db.from('vehicles').update({
        price_krw: row.price_krw,
        price_sar: row.price_sar,
        images: row.images,
        specs: row.specs,
        vin: row.vin,
      }).eq('id', existing.id);
      if (error) throw new Error('vehicles update failed: ' + error.message);
      return { vehicle_id: existing.id, status: existing.status, price_sar: row.price_sar };
    }

    const { data: inserted, error: insErr } = await db
      .from('vehicles')
      .insert({ ...row, status: 'pending' })
      .select('id, status')
      .single();
    if (!insErr) return { vehicle_id: inserted.id, status: inserted.status, price_sar: row.price_sar };
    // 23505 = another request snapshotted the same car first → re-select
    if (insErr.code !== '23505') throw new Error('vehicles insert failed: ' + insErr.message);
  }
  throw new Error('snapshot upsert did not converge');
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  // Safe diagnostics: /api/account?diag=1 (no secrets exposed)
  if (req.method === 'GET' && req.query && req.query.diag === '1') {
    const sk = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    return res.status(200).json({
      service_key_present: Boolean(sk),
      service_key_prefix: sk ? sk.slice(0, 10) + '…' : null,
      supabase_url_env: Boolean((process.env.SUPABASE_URL || '').trim()),
    });
  }

  if (req.method !== 'POST') return fail(res, 405, 'POST only');

  let caller;
  try {
    caller = await getCallerFromReq(req);
  } catch (e) {
    console.error('auth check failed:', e && e.message);
    return fail(res, 500, 'auth backend not configured');
  }
  if (!caller) return fail(res, 401, 'sign in required');

  // abuse / freeze check
  try {
    const dbCheck = serviceClient();
    const { data: profile, error: profErr } = await dbCheck
      .from('profiles')
      .select('is_frozen')
      .eq('id', caller.id)
      .maybeSingle();
    if (profErr) {
      console.error('profile freeze check failed:', profErr.message);
      return fail(res, 500, 'database error checking profile state');
    }
    if (profile && profile.is_frozen) {
      return fail(res, 403, 'account frozen');
    }
  } catch (err) {
    console.error('profile freeze check failed:', err && err.message);
    return fail(res, 500, 'database error checking profile state');
  }

  const body = typeof req.body === 'object' && req.body ? req.body : {};
  const action = String(body.action || '');

  try {
    // ── snapshot ─────────────────────────────────────────────
    if (action === 'snapshot') {
      const source = String(body.source || '');
      const sourceId = String(body.source_id || '');
      if (!['encar', 'auction'].includes(source) || !sourceId) {
        return fail(res, 400, 'source (encar|auction) and source_id are required');
      }
      const snap = await upsertSnapshot(source, sourceId);
      return res.status(200).json({ vehicle_id: snap.vehicle_id });
    }

    // ── order ────────────────────────────────────────────────
    if (action === 'order') {
      const db = serviceClient();

      // abuse guard
      const { count, error: cntErr } = await db
        .from('orders').select('id', { count: 'exact', head: true })
        .eq('customer_id', caller.id).eq('status', 'pending_payment');
      if (cntErr) throw new Error('order count failed: ' + cntErr.message);
      if ((count || 0) >= MAX_OPEN_ORDERS) {
        return fail(res, 429, 'too many open orders — please contact us to complete them first');
      }

      // resolve the vehicle
      let vehicleId, priceSar;
      if (body.vehicle_id) {
        const { data: v, error } = await db
          .from('vehicles').select('id, status, price_sar')
          .eq('id', String(body.vehicle_id)).maybeSingle();
        if (error) throw new Error('vehicle lookup failed: ' + error.message);
        if (!v) return fail(res, 404, 'vehicle not found');
        // customers may only order internal cars that are actually for sale
        if (!['approved', 'pending'].includes(v.status)) return fail(res, 409, 'vehicle is not available');
        vehicleId = v.id;
        priceSar = v.price_sar;
      } else {
        const source = String(body.source || '');
        const sourceId = String(body.source_id || '');
        if (!['encar', 'auction'].includes(source) || !sourceId) {
          return fail(res, 400, 'vehicle_id, or source (encar|auction) + source_id, is required');
        }
        const snap = await upsertSnapshot(source, sourceId);
        vehicleId = snap.vehicle_id;
        priceSar = snap.price_sar;
      }

      // duplicate guard: one open order per car per customer
      const { data: dup, error: dupErr } = await db
        .from('orders').select('id')
        .eq('customer_id', caller.id).eq('vehicle_id', vehicleId)
        .neq('status', 'delivered')
        .limit(1);
      if (dupErr) throw new Error('duplicate check failed: ' + dupErr.message);
      if (dup && dup.length) {
        return res.status(200).json({ order_id: dup[0].id, vehicle_id: vehicleId, existing: true });
      }

      const { data: order, error: ordErr } = await db
        .from('orders')
        .insert({
          customer_id: caller.id,     // from the verified JWT — never from the body
          vehicle_id: vehicleId,
          final_price_sar: priceSar,  // server-computed — never from the body
          status: 'pending_payment',
        })
        .select('id')
        .single();
      if (ordErr) throw new Error('order insert failed: ' + ordErr.message);

      // first milestone + welcome notification (best-effort)
      await db.from('order_milestones').insert({
        order_id: order.id,
        step_title: 'تم استلام طلبك',
        step_description: 'استلمنا طلبك وسيتواصل معك فريقنا لتأكيد التفاصيل وطريقة الدفع.',
        location: 'العز العالمي',
      });
      await db.from('in_app_notifications').insert({
        user_id: caller.id,
        title: 'تم استلام طلبك ✓',
        message: 'استلمنا طلبك بنجاح وسيتواصل معك فريقنا قريباً. يمكنك متابعة كل مراحل الشحن من صفحة طلباتي.',
      });

      return res.status(200).json({ order_id: order.id, vehicle_id: vehicleId });
    }

    return fail(res, 400, 'unknown action');
  } catch (err) {
    const code = err && err.code;
    console.error('account action failed:', action, err && err.message);
    if (code === 404) return fail(res, 404, 'car not found or no longer listed');
    if (code === 400) return fail(res, 400, String(err.message));
    return fail(res, 502, 'upstream or database error — try again shortly');
  }
}
