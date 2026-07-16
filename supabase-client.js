/* ═══════════════════════════════════════════════════════════
   supabase-client.js — shared Supabase singleton for العز العالمي
   Requires vendor/supabase-js-v2.min.js loaded FIRST (exposes
   window.supabase). If the vendor lib is missing, window.SB is
   simply not defined and every page degrades to today's behavior.

   The URL + publishable key below are PUBLIC BY DESIGN (safe to
   ship client-side — Row Level Security protects the data).
   The service_role key must NEVER appear here: server env only.

   Public API (window.SB):
     SB.client               → the supabase-js client instance
     SB.session()            → Promise<Session|null>
     SB.user()               → Promise<User|null>
     SB.roles()              → Promise<string[]> (cached per user)
     SB.hasRole(r)           → Promise<boolean>
     SB.isStaff()            → admin | super_admin | logistics
     SB.isAdmin()            → admin | super_admin
     SB.isSuperAdmin()       → super_admin
     SB.isLogistics()        → logistics
     SB.requireAuth(next)    → redirect to /auth if signed out
     SB.requireStaff()       → redirect if not staff
     SB.authHeader()         → Promise<{Authorization}|{}> for /api calls
     SB.mountNavAuth(el)     → login pill / account chip in the navbar
     window 'sb:auth' event  → fired on every auth state change
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://rkdwqptiaknoedmsmrjk.supabase.co';
  var SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_RHPNqmH06RXBrwkMmLPBLQ_G3nuhMym';

  if (!window.supabase || !window.supabase.createClient) {
    console.warn('[SB] vendor/supabase-js not loaded — Supabase features disabled');
    return;
  }

  var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  /* ── session / user ──────────────────────────────────────── */
  function session() {
    return client.auth.getSession().then(function (r) {
      return (r && r.data && r.data.session) || null;
    });
  }
  function user() {
    return session().then(function (s) { return s ? s.user : null; });
  }

  /* ── roles (cached per signed-in user) ───────────────────── */
  var rolesCache = { uid: null, promise: null };

  function roles() {
    return user().then(function (u) {
      if (!u) { rolesCache = { uid: null, promise: null }; return []; }
      if (rolesCache.uid === u.id && rolesCache.promise) return rolesCache.promise;
      rolesCache.uid = u.id;
      rolesCache.promise = client
        .from('user_roles').select('role').eq('user_id', u.id)
        .then(function (r) {
          if (r.error) { console.warn('[SB] roles fetch failed:', r.error.message); return []; }
          return (r.data || []).map(function (row) { return row.role; });
        });
      return rolesCache.promise;
    });
  }
  function hasRole(role) {
    return roles().then(function (list) { return list.indexOf(role) !== -1; });
  }
  function anyRole(wanted) {
    return roles().then(function (list) {
      return list.some(function (r) { return wanted.indexOf(r) !== -1; });
    });
  }
  function isStaff()      { return anyRole(['admin', 'super_admin', 'logistics']); }
  function isAdmin()      { return anyRole(['admin', 'super_admin']); }
  function isSuperAdmin() { return hasRole('super_admin'); }
  function isLogistics()  { return hasRole('logistics'); }

  /* ── page guards ─────────────────────────────────────────── */
  function herePath() {
    return location.pathname + location.search + location.hash;
  }
  function requireAuth(next) {
    return session().then(function (s) {
      if (s) return s.user;
      location.replace('/auth?next=' + encodeURIComponent(next || herePath()));
      return null;
    });
  }
  function requireStaff() {
    return requireAuth().then(function (u) {
      if (!u) return null;
      return isStaff().then(function (ok) {
        if (ok) return u;
        location.replace('/');
        return null;
      });
    });
  }

  /* ── Authorization header for our /api/*.mjs endpoints ───── */
  function authHeader() {
    return session().then(function (s) {
      return s ? { Authorization: 'Bearer ' + s.access_token } : {};
    });
  }

  /* ── trilingual micro-helper (works before i18n entries exist) */
  function tr(ar, en, ko) {
    var l = (window.I18N && window.I18N.lang) || 'ar';
    return l === 'en' ? en : l === 'ko' ? ko : ar;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ── navbar auth widget (mounted by pages in Phase 5) ────── */
  function unreadCount() {
    return client
      .from('in_app_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false)
      .then(function (r) { return r.error ? 0 : (r.count || 0); })
      .catch(function () { return 0; });
  }

  function injectNavStyles() {
    if (document.getElementById('sb-nav-css')) return;
    var st = document.createElement('style');
    st.id = 'sb-nav-css';
    st.textContent =
      '#nav-auth{display:inline-flex;align-items:center;gap:8px;flex:0 0 auto;}' +
      '.sb-pill{display:inline-flex;align-items:center;gap:.4em;padding:.5em 1.05em;border-radius:9999px;' +
      'background:linear-gradient(135deg,#C9A84C,#F0D98A,#A0802A);color:#09090F;font-family:Cairo,sans-serif;' +
      'font-weight:700;font-size:.82rem;white-space:nowrap;text-decoration:none;}' +
      '.sb-chip{display:inline-flex;align-items:center;gap:.45em;padding:.3em .8em .3em .5em;border-radius:9999px;' +
      'background:rgba(26,77,184,.25);border:1px solid rgba(91,155,245,.35);color:#C8D8F0;' +
      'font-family:Cairo,sans-serif;font-weight:700;font-size:.8rem;white-space:nowrap;text-decoration:none;}' +
      '.sb-avatar{position:relative;display:inline-flex;align-items:center;justify-content:center;' +
      'width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#C9A84C,#A0802A);' +
      'color:#09090F;font-weight:800;font-size:.85rem;flex:0 0 auto;}' +
      '.sb-badge{position:absolute;top:-5px;inset-inline-start:-5px;background:#f87171;color:#fff;' +
      'border-radius:9999px;padding:0 4px;min-width:15px;height:15px;line-height:15px;font-size:.6rem;' +
      'font-weight:800;text-align:center;border:1.5px solid #09090F;}' +
      '.sb-dash{display:inline-flex;align-items:center;padding:.42em .9em;border-radius:9999px;' +
      'border:1px solid rgba(201,168,76,.5);color:#F0D98A;font-family:Cairo,sans-serif;font-weight:700;' +
      'font-size:.78rem;white-space:nowrap;text-decoration:none;}' +
      '@media (max-width: 767px){' +
        '.sb-pill{width:38px;height:38px;padding:0;justify-content:center;border-radius:50%;}' +
        '.sb-pill .sb-txt{display:none;}' +
        '.sb-chip{padding:0;background:none;border:none;}' +
        '.sb-chip .sb-txt{display:none;}' +
        '.sb-avatar{width:36px;height:36px;font-size:.95rem;}' +
        '.sb-dash{display:none;}' +
      '}';
    document.head.appendChild(st);
  }

  var SB_USER_SVG =
    '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">' +
    '<path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>';

  function mountNavAuth(el) {
    if (!el) return;
    el.setAttribute('data-no-i18n', '');
    injectNavStyles();

    function render() {
      session().then(function (s) {
        if (!s) {
          el.innerHTML =
            '<a href="/auth?next=' + encodeURIComponent(herePath()) + '" class="sb-pill"' +
            ' title="' + tr('تسجيل الدخول', 'Sign in', '로그인') + '">' +
            SB_USER_SVG +
            '<span class="sb-txt">' + tr('تسجيل الدخول', 'Sign in', '로그인') + '</span></a>';
          return;
        }
        var u = s.user;
        var name = (u.user_metadata && u.user_metadata.full_name) || u.email || '';
        var initial = name.trim().charAt(0).toUpperCase() || '👤';
        Promise.all([isStaff(), unreadCount()]).then(function (res) {
          var staff = res[0], unread = res[1];
          var html =
            '<a href="/account" class="sb-chip" title="' + esc(name) + '">' +
            '<span class="sb-avatar">' + esc(initial) +
            (unread > 0 ? '<span class="sb-badge">' + (unread > 9 ? '9+' : unread) + '</span>' : '') +
            '</span>' +
            '<span class="sb-txt">' + tr('حسابي', 'My account', '내 계정') + '</span></a>';
          if (staff) {
            html += '<a href="/admin" class="sb-dash">' + tr('لوحة التحكم', 'Dashboard', '대시보드') + '</a>';
          }
          el.innerHTML = html;
        });
      });
    }

    render();
    window.addEventListener('sb:auth', render);
    window.addEventListener('langchange', render);
  }

  /* ── auth state plumbing ─────────────────────────────────── */
  client.auth.onAuthStateChange(function (event, s) {
    rolesCache = { uid: null, promise: null };
    try { // keep Realtime authorized for RLS-protected channels
      client.realtime.setAuth(s ? s.access_token : null);
    } catch (e) { /* realtime not in use yet */ }
    try {
      window.dispatchEvent(new CustomEvent('sb:auth', { detail: { event: event, session: s } }));
    } catch (e) { /* very old browsers */ }
  });

  /* ── expose ──────────────────────────────────────────────── */
  window.SB = {
    client: client,
    session: session,
    user: user,
    roles: roles,
    hasRole: hasRole,
    isStaff: isStaff,
    isAdmin: isAdmin,
    isSuperAdmin: isSuperAdmin,
    isLogistics: isLogistics,
    requireAuth: requireAuth,
    requireStaff: requireStaff,
    authHeader: authHeader,
    mountNavAuth: mountNavAuth
  };
}());
