// ═══════════════════════════════════════════════════════════
// Staff/admin actions that need the auth admin API (service role).
//
//   POST /api/admin   { action: 'create-user', email, password,
//                       full_name, phone_number, role }
//     role='customer'            → caller must be admin/super_admin
//     role='admin'|'logistics'   → caller must be super_admin
//     → creates a confirmed auth user (signup trigger builds the
//       profile + base customer role), then inserts the staff role
//       with assigned_by = caller → { user_id }
//
// Privilege-escalation guard: a caller can never grant a role above
// their own tier; role names are whitelisted server-side.
// Everything else in the dashboard talks to Supabase directly under
// RLS — this endpoint exists only because creating users requires
// the service-role auth admin API.
// ═══════════════════════════════════════════════════════════

import { serviceClient, getCallerFromReq, callerHasRole, fail } from './_lib/supa.mjs';

function normPhone(raw) {
  const v = String(raw || '').replace(/[\s\-()]/g, '');
  if (/^00\d{8,15}$/.test(v)) return '+' + v.slice(2);
  if (/^\+9665\d{8}$/.test(v)) return v;
  if (/^9665\d{8}$/.test(v)) return '+' + v;
  if (/^05\d{8}$/.test(v)) return '+966' + v.slice(1);
  if (/^5\d{8}$/.test(v)) return '+966' + v;
  if (/^\+\d{8,15}$/.test(v)) return v;
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') return fail(res, 405, 'POST only');

  let caller;
  try {
    caller = await getCallerFromReq(req);
  } catch (e) {
    console.error('auth check failed:', e && e.message);
    return fail(res, 500, 'auth backend not configured');
  }
  if (!caller) return fail(res, 401, 'sign in required');

  const body = typeof req.body === 'object' && req.body ? req.body : {};
  const action = String(body.action || '');

  try {
    if (action === 'create-user') {
      const role = String(body.role || 'customer');
      if (!['customer', 'admin', 'logistics'].includes(role)) {
        return fail(res, 400, 'invalid role');
      }

      // tier check — server-side, from the DB, never from the client
      const needed = role === 'customer' ? ['admin', 'super_admin'] : ['super_admin'];
      const allowed = await callerHasRole(caller.id, needed);
      if (!allowed) return fail(res, 403, 'not allowed to create this role');

      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const fullName = String(body.full_name || '').trim();
      const phone = body.phone_number ? normPhone(body.phone_number) : null;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res, 400, 'invalid email');
      if (password.length < 8) return fail(res, 400, 'password too short');
      if (!fullName) return fail(res, 400, 'full_name required');
      if (body.phone_number && !phone) return fail(res, 400, 'invalid phone');

      const db = serviceClient();
      const { data: created, error: cErr } = await db.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // staff/CRM accounts skip the confirmation mail
        user_metadata: { full_name: fullName, phone_number: phone || undefined },
      });
      if (cErr) {
        const msg = String(cErr.message || '');
        if (/already|registered|exists/i.test(msg)) return fail(res, 409, 'email already registered');
        throw new Error('createUser failed: ' + msg);
      }
      const userId = created.user.id;

      if (role !== 'customer') {
        const { error: rErr } = await db.from('user_roles').insert({
          user_id: userId,
          role,
          assigned_by: caller.id,
        });
        if (rErr && rErr.code !== '23505') {
          throw new Error('role insert failed: ' + rErr.message);
        }
      }

      return res.status(200).json({ user_id: userId, role });
    }

    return fail(res, 400, 'unknown action');
  } catch (err) {
    console.error('admin action failed:', action, err && err.message);
    return fail(res, 502, 'server error — try again shortly');
  }
}
