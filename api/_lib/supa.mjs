// ═══════════════════════════════════════════════════════════
// Server-side Supabase helpers for the /api functions.
// Files under /api/_lib are NOT deployed as routes (underscore
// convention) — shared code only.
//
// SUPABASE_SERVICE_ROLE_KEY bypasses RLS: it must only ever be
// read here, server-side, from Vercel env vars.
// ═══════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rkdwqptiaknoedmsmrjk.supabase.co';

let _service = null;

/** Service-role client (full access, bypasses RLS). Server only. */
export function serviceClient() {
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  if (!_service) {
    _service = createClient(SUPABASE_URL, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _service;
}

/**
 * Verify the caller's JWT from the Authorization header.
 * Returns the auth user object, or null when missing/invalid.
 */
export async function getCallerFromReq(req) {
  const h = String(req.headers.authorization || '');
  const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!token) return null;
  try {
    const { data, error } = await serviceClient().auth.getUser(token);
    if (error || !data || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

/** True when userId holds ANY of the given roles. */
export async function callerHasRole(userId, roles) {
  const { data, error } = await serviceClient()
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', roles)
    .limit(1);
  if (error) throw new Error('role lookup failed: ' + error.message);
  return Array.isArray(data) && data.length > 0;
}

/** Uniform JSON error response. */
export function fail(res, status, message) {
  return res.status(status).json({ error: message });
}
