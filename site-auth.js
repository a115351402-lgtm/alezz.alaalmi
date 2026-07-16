/* ═══════════════════════════════════════════════════════════
   site-auth.js — wires the PUBLIC pages to Supabase (Phase 5).
   Loaded with `defer` after vendor/supabase-js + supabase-client.

   Safety contract: if window.SB is missing (lib blocked / failed),
   this file exits immediately and every page behaves exactly as it
   did before Supabase existed (WhatsApp-only). Order buttons are
   hidden by default in markup and only revealed here.

   Provides:
     · navbar auth widget      → <span id="nav-auth">
     · favorites hearts        → [data-fav="source:id"] on cards
                                 [data-fav-detail="source"] on detail
                                 pages (id read from ?id=)
     · real order button       → [data-order="encar|auction"]
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!window.SB) return;

  var T = function (k) { return window.I18N ? I18N.t(k) : k; };
  function el(id) { return document.getElementById(id); }
  function qs(sel) { return document.querySelectorAll(sel); }
  function here() { return location.pathname + location.search + location.hash; }
  function goAuth() { location.href = '/auth?next=' + encodeURIComponent(here()); }

  /* ── injected styles (hearts + modal + toast) ─────────────── */
  var css = document.createElement('style');
  css.textContent =
    '.fav-btn{position:absolute;top:10px;left:10px;z-index:6;width:38px;height:38px;border-radius:50%;' +
    'border:1px solid rgba(255,255,255,0.28);background:rgba(9,9,15,0.55);backdrop-filter:blur(8px);' +
    'color:#fff;font-size:19px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;' +
    'transition:transform .15s,background .2s,color .2s;padding:0;}' +
    '.fav-btn:hover{transform:scale(1.12);}' +
    '.fav-btn.on{color:#f87171;border-color:rgba(248,113,113,0.65);background:rgba(248,113,113,0.18);}' +
    '.fav-btn.fav-lower{top:48px;}' +
    '.fav-btn.fav-inline{position:static;display:inline-flex;flex:0 0 auto;}' +
    '#sb-modal-back{position:fixed;inset:0;background:rgba(0,0,0,0.72);backdrop-filter:blur(4px);z-index:95;' +
    'display:none;align-items:center;justify-content:center;padding:16px;}' +
    '#sb-modal-back.open{display:flex;}' +
    '#sb-modal{background:rgba(15,17,37,0.97);border:1px solid rgba(201,168,76,0.35);border-radius:20px;' +
    'max-width:400px;width:100%;padding:1.6rem;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.6);}' +
    '#sb-toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:#0F1125;' +
    'border:1px solid rgba(201,168,76,0.5);color:#F0D98A;font-family:Cairo,sans-serif;font-weight:700;' +
    'font-size:0.85rem;padding:0.8rem 1.4rem;border-radius:999px;box-shadow:0 10px 30px rgba(0,0,0,0.6);' +
    'opacity:0;pointer-events:none;transition:opacity .3s;z-index:99;max-width:92vw;text-align:center;}' +
    '#sb-toast.show{opacity:1;}';
  document.head.appendChild(css);

  var toastEl, toastTimer;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.id = 'sb-toast'; toastEl.setAttribute('data-no-i18n',''); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 3200);
  }

  /* ── tiny modal ───────────────────────────────────────────── */
  var back = null;
  function modal(title, body, buttons) {
    if (!back) {
      back = document.createElement('div');
      back.id = 'sb-modal-back'; back.setAttribute('data-no-i18n','');
      back.innerHTML = '<div id="sb-modal"></div>';
      back.addEventListener('click', function (e) { if (e.target === back) back.classList.remove('open'); });
      document.body.appendChild(back);
    }
    var box = back.firstChild;
    box.innerHTML =
      '<p style="font-size:2.4rem;margin-bottom:.4rem;">' + (title.icon || '') + '</p>' +
      '<p style="font-family:Cairo,sans-serif;font-weight:800;color:#fff;font-size:1.05rem;margin-bottom:.4rem;">' + title.text + '</p>' +
      (body ? '<p style="font-size:0.85rem;color:rgba(200,216,240,0.65);line-height:1.8;margin-bottom:1.1rem;">' + body + '</p>' : '') +
      buttons.map(function (b, i) {
        return '<button data-mb="' + i + '" style="display:block;width:100%;padding:0.85rem;border-radius:14px;cursor:pointer;' +
          'font-family:Cairo,sans-serif;font-weight:700;font-size:0.9rem;margin-bottom:0.55rem;' +
          (b.gold
            ? 'background:linear-gradient(135deg,#C9A84C,#F0D98A,#A0802A);color:#09090F;border:none;'
            : 'background:rgba(255,255,255,0.05);color:#C8D8F0;border:1px solid rgba(255,255,255,0.14);') +
          '">' + b.label + '</button>';
      }).join('');
    box.onclick = function (e) {
      var b = e.target.closest('[data-mb]'); if (!b) return;
      back.classList.remove('open');
      var fn = buttons[Number(b.getAttribute('data-mb'))].onClick;
      if (fn) fn();
    };
    back.classList.add('open');
  }

  /* ── navbar widget ────────────────────────────────────────── */
  var mount = el('nav-auth');
  if (mount) SB.mountNavAuth(mount);

  /* ── favorites ────────────────────────────────────────────── */
  var favSet = {};   // 'source:source_id' → { favId, vehicleId }
  var favBusy = false;

  function keyOf(btn) {
    var k = btn.getAttribute('data-fav');
    if (k) return k;
    var src = btn.getAttribute('data-fav-detail') || '';
    var id = new URLSearchParams(location.search).get('id') || '';
    return src + ':' + id;
  }
  function paint() {
    qs('[data-fav],[data-fav-detail]').forEach(function (b) {
      var on = !!favSet[keyOf(b)];
      b.classList.toggle('on', on);
      b.textContent = on ? '❤' : '♡';
    });
  }
  function loadFavs() {
    SB.session().then(function (s) {
      if (!s) { favSet = {}; paint(); return; }
      SB.client.from('favorites').select('id, vehicles(id, source, source_id)').then(function (r) {
        if (r.error) return;
        favSet = {};
        (r.data || []).forEach(function (f) {
          var v = f.vehicles;
          if (v && v.source_id) favSet[v.source + ':' + v.source_id] = { favId: f.id, vehicleId: v.id };
        });
        paint();
      });
    });
  }

  function toggleFav(btn) {
    if (favBusy) return;
    var key = keyOf(btn);
    var src = key.split(':')[0], sid = key.slice(src.length + 1);
    if (!sid) return;
    SB.session().then(function (s) {
      if (!s) {
        modal({ icon: '🤍', text: T('site_fav_login_t') }, T('site_fav_login_b'), [
          { label: T('auth_tab_login'), gold: true, onClick: goAuth },
          { label: T('adm_cancel') }
        ]);
        return;
      }
      var existing = favSet[key];
      favBusy = true;
      if (existing) {
        SB.client.from('favorites').delete().eq('id', existing.favId).then(function (r) {
          favBusy = false;
          if (r.error) return toast(T('acc_load_err'));
          delete favSet[key]; paint();
          toast(T('site_fav_removed'));
        });
        return;
      }
      btn.textContent = '…';
      SB.authHeader().then(function (h) {
        return fetch('/api/account', {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, h),
          body: JSON.stringify({ action: 'snapshot', source: src, source_id: sid })
        });
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (x) {
          if (!x.ok || !x.j.vehicle_id) throw 0;
          return SB.client.from('favorites')
            .insert({ user_id: s.user.id, vehicle_id: x.j.vehicle_id })
            .select('id').single()
            .then(function (r) {
              favBusy = false;
              if (r.error && r.error.code !== '23505') throw 0;
              favSet[key] = { favId: r.data && r.data.id, vehicleId: x.j.vehicle_id };
              paint();
              toast(T('site_fav_added'));
            });
        })
        .catch(function () { favBusy = false; paint(); toast(T('acc_load_err')); });
    });
  }

  // capture phase beats the cards' inline onclick navigation
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-fav],[data-fav-detail]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    toggleFav(b);
  }, true);

  // cards render asynchronously → repaint hearts when the DOM changes
  var mo = new MutationObserver(function () {
    clearTimeout(mo._t); mo._t = setTimeout(paint, 250);
  });
  mo.observe(document.body, { childList: true, subtree: true });

  /* ── real order button (detail pages) ─────────────────────── */
  qs('[data-order],[data-order-sib]').forEach(function (b) { b.style.display = ''; });

  var ordering = false;
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-order]');
    if (!b || ordering) return;
    var source = b.getAttribute('data-order');
    var sid = new URLSearchParams(location.search).get('id') || '';
    if (!sid) return;

    SB.session().then(function (s) {
      if (!s) {
        modal({ icon: '🚗', text: T('site_order_login_t') }, T('site_order_login_b'), [
          { label: T('site_order_login_go'), gold: true, onClick: goAuth },
          { label: T('site_order_wa'), onClick: function () {
              var wa = el('t-wa') || el('wa-cta');
              if (wa && wa.href) window.open(wa.href, '_blank');
            } },
          { label: T('adm_cancel') }
        ]);
        return;
      }
      ordering = true;
      var span = b.querySelector('span');
      var old = span ? span.textContent : '';
      if (span) span.textContent = '…';
      SB.authHeader().then(function (h) {
        return fetch('/api/account', {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, h),
          body: JSON.stringify({ action: 'order', source: source, source_id: sid })
        });
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (x) {
          ordering = false;
          if (span) span.textContent = old;
          if (!x.ok) {
            toast(T('site_order_fail') + (x.j && x.j.error ? '' : ''));
            return;
          }
          modal(
            { icon: '✅', text: x.j.existing ? T('site_order_dup_t') : T('site_order_ok_t') },
            x.j.existing ? T('site_order_dup_b') : T('site_order_ok_b'),
            [
              { label: T('site_order_view'), gold: true, onClick: function () { location.href = '/account#orders'; } },
              { label: T('site_order_stay') }
            ]
          );
        })
        .catch(function () {
          ordering = false;
          if (span) span.textContent = old;
          toast(T('site_order_fail'));
        });
    });
  });

  /* ── boot ─────────────────────────────────────────────────── */
  loadFavs();
  window.addEventListener('sb:auth', loadFavs);
})();
