// ═══════════════════════════════════════════════════════════
// Upstream listing fetchers + vehicle-row normalizer.
//
// Used by /api/account.mjs to snapshot an external car into the
// public.vehicles table. The price is ALWAYS computed here on the
// server from the upstream source — nothing sent by the browser
// can influence what gets stored.
// ═══════════════════════════════════════════════════════════

import { fetchLotteDetail } from '../auctions.mjs';

const CARAPIS_BASE = process.env.CARAPIS_URL || 'https://api.carapis.com/apix/catalog_api';

const USD_TO_SAR = 3.75;   // SAR is pegged to USD
const KRW_TO_USD = 1360;   // fallback rate, mirrors currency.js

function roundSar(n) { return Math.round(n / 100) * 100; }

function carapisAuth() {
  const apiKey = (process.env.CARAPIS_API_KEY || process.env.AUTO_API_KEY || '').trim();
  if (!apiKey) throw new Error('Carapis API key is not configured');
  return apiKey.startsWith('car_')
    ? { Authorization: `Bearer ${apiKey}` }
    : { 'X-API-Key': apiKey };
}

/** Fetch one Encar listing from Carapis (listings/{id} with vehicles/{id} fallback). */
export async function fetchEncarListing(id) {
  const clean = String(id).trim();
  if (!/^[0-9a-zA-Z_-]{4,64}$/.test(clean)) throw Object.assign(new Error('bad id'), { code: 404 });

  const uuidLike = /^[0-9a-f-]{32,36}$/i.test(clean);
  const paths = uuidLike ? ['vehicles/', 'listings/'] : ['listings/', 'vehicles/'];
  const headers = { ...carapisAuth(), Accept: 'application/json' };

  let lastStatus = 0;
  for (const p of paths) {
    const r = await fetch(`${CARAPIS_BASE}/${p}${encodeURIComponent(clean)}/`, {
      headers, signal: AbortSignal.timeout(25000),
    });
    if (r.ok) {
      const v = await r.json();
      if (v && (v.id || v.listing_id)) return v;
    }
    lastStatus = r.status;
  }
  const err = new Error('encar listing not found (upstream ' + lastStatus + ')');
  err.code = lastStatus === 404 ? 404 : 502;
  throw err;
}

/** USD price of a Carapis listing (KRW converted with the pegged fallback). */
function encarPriceUsd(v) {
  if (v.price_usd != null) return Number(v.price_usd);
  const cur = String(v.currency || 'KRW').toUpperCase();
  const price = Number(v.price || 0);
  return cur === 'USD' ? price : price / KRW_TO_USD;
}

function encarPhotoUrl(p) {
  let u = (p && (p.original_url || p.url || p.thumb_url)) || '';
  if (u.indexOf('/') === 0) u = 'https://api.carapis.com' + u;
  return u;
}

/**
 * Fetch the external listing and normalize it into a public.vehicles row.
 * source: 'encar' | 'auction' — source_id: Carapis listing id / Lotte gdId.
 */
export async function fetchVehicleRow(source, sourceId) {
  if (source === 'auction') {
    const gdId = String(sourceId).replace(/[^\d]/g, '');
    if (!gdId) throw Object.assign(new Error('bad auction id'), { code: 404 });
    let car;
    try {
      car = await fetchLotteDetail(gdId);
    } catch (e) {
      const err = new Error('auction car not found: ' + (e && e.message));
      err.code = /not recognized|404/.test(String(e && e.message)) ? 404 : 502;
      throw err;
    }
    if (!car.price_sar) throw Object.assign(new Error('auction car has no price'), { code: 502 });
    return {
      source: 'auction',
      source_id: String(gdId),
      vin: car.vin || null,
      make: car.maker || null,
      model: car.model || null,
      year: car.year || null,
      price_krw: null,
      price_sar: car.price_sar,
      images: (car.images || []).slice(0, 12),
      specs: {
        title: car.title,
        title_en: car.title_en,
        mileage_km: car.mileage_km,
        fuel: car.fuel,
        transmission: car.transmission,
        body: car.body,
        drive: car.drive,
        seats: car.seats,
        color: car.color,
        displacement_cc: car.displacement_cc,
        evaluation: car.evaluation,
        inspection_sheet: car.inspection_sheet,
        detail_url: car.detail_url,
        source_url: '/auction-car.html?id=' + gdId,
      },
    };
  }

  if (source === 'encar') {
    const v = await fetchEncarListing(sourceId);
    const usd = encarPriceUsd(v);
    if (!usd || usd <= 0) throw Object.assign(new Error('encar car has no price'), { code: 502 });
    const make = v.brand_name || v.make || null;
    const model = v.model_name || v.model || null;
    return {
      source: 'encar',
      source_id: String(sourceId),
      vin: v.vin || null,
      make,
      model,
      year: Number(v.year) || null,
      price_krw: String(v.currency || 'KRW').toUpperCase() === 'KRW' ? Number(v.price) || null : null,
      price_sar: roundSar(usd * USD_TO_SAR),
      images: (v.photos || []).slice(0, 12).map(encarPhotoUrl).filter(Boolean),
      specs: {
        title: [make, model, v.year].filter(Boolean).join(' '),
        trim: v.trim,
        mileage_km: v.mileage,
        fuel: v.fuel_type,
        transmission: v.transmission,
        body: v.body_type,
        drive: v.drive_type,
        seats: v.seat_count,
        color: v.color,
        engine_cc: v.engine_cc,
        has_accident: v.has_accident != null ? Boolean(v.has_accident) : (v.accident_history != null ? Boolean(v.accident_history) : null),
        inspection_passed: v.inspection_passed,
        ref: v.vehicle_no || v.source_id || v.listing_id || null,
        source_url: '/car.html?id=' + encodeURIComponent(String(sourceId)),
      },
    };
  }

  throw Object.assign(new Error('unknown source'), { code: 400 });
}
