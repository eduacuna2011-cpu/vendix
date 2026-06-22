// ─── Vendix SPA Router ────────────────────────────────────────────────────────
// Keeps sidebar + navbar persistent; only swaps <main> on navigation.
// CSS is fully loaded BEFORE content appears — zero flash of unstyled content.
// Scripts are IIFE-wrapped so let/const in one page don't conflict with the next.
(function () {
  'use strict';

  window.__SPA = true;

  // ── Route manifest ────────────────────────────────────────────────────────
  const ROUTES = {
    'index.html':        { css: [],                  js: 'script.js',      title: 'Dashboard' },
    'sales.html':        { css: ['sales.css'],        js: 'sales.js',       title: 'Punto de Venta' },
    'inventory.html':    { css: ['inventory.css'],    js: 'inventory.js',   title: 'Inventario' },
    'sellers.html':      { css: ['sellers.css'],      js: 'sellers.js',     title: 'Vendedores' },
    'labels.html':       { css: ['labels.css'],       js: 'labels.js',      title: 'Etiquetas' },
    'settings.html':     { css: ['settings.css'],     js: 'settings.js',    title: 'Configuración' },
    'users.html':        { css: ['users.css'],         js: 'users.js',       title: 'Usuarios' },
    'platform-sa.html':  { css: [], js: ['platform-sa.js', 'vendix-sales.js'], title: 'Platform Admin' },
    'settings-sa.html':  { css: [], js: 'settings-sa.js', title: 'SA Settings' },
    'customer-details.html': { css: [], js: '', title: 'Detalle de Cliente' },
  };

  const SPA_PAGES = new Set(Object.keys(ROUTES));

  // CSS already in shell — skip these
  const _loadedCss = new Set(['styles.css', 'mobile.css', 'animations.css',
                               'sellers.css', 'dashboard.css']);

  let _currentPage = getPageName(location.pathname) || 'index.html';
  let _navigating  = false;

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getPageName(href) {
    return (href || '').replace(/^.*\//, '').split('?')[0] || 'index.html';
  }

  function getSpaEl() { return document.getElementById('spaContent'); }

  function updateActiveNav(pageName) {
    document.querySelectorAll('#sidebarNav .nav-item').forEach(item => {
      const a = item.querySelector('a.nav-link');
      if (!a) return;
      const dest = getPageName(a.getAttribute('href') || '');
      item.classList.toggle('active',
        dest === pageName || (pageName === 'index.html' && dest === ''));
    });
  }

  // Inserts a <link> and returns a Promise that resolves once the sheet is loaded.
  // Resolves instantly if already loaded.
  function loadCss(css) {
    if (_loadedCss.has(css)) return Promise.resolve();
    _loadedCss.add(css);
    return new Promise(function (resolve) {
      var link = document.createElement('link');
      link.rel  = 'stylesheet';
      link.href = css;
      link.setAttribute('data-page-css', '1');
      link.onload  = resolve;
      link.onerror = resolve; // don't block navigation on 404
      document.head.appendChild(link);
    });
  }

  // ── Core navigate ─────────────────────────────────────────────────────────
  async function spaNavigate(href, pushState) {
    if (pushState === undefined) pushState = true;
    if (_navigating) return;
    const pageName = getPageName(href);

    if (!SPA_PAGES.has(pageName)) { window.location.href = href; return; }
    if (pageName === _currentPage) return;

    _navigating = true;
    const spaEl = getSpaEl();
    const route = ROUTES[pageName] || {};

    // ── Step 1: Start fetching HTML + CSS simultaneously, begin exit anim ──
    const htmlPromise = fetch(pageName, { cache: 'force-cache' });
    const cssPromises = (route.css || []).map(loadCss); // starts download immediately
    const exitDelay   = new Promise(function (r) { setTimeout(r, 160); });

    spaEl.classList.add('spa-exit');

    // ── Step 2: Await HTML ────────────────────────────────────────────────
    let html;
    try {
      const res = await htmlPromise;
      if (!res.ok) throw new Error('HTTP ' + res.status);
      html = await res.text();
    } catch {
      spaEl.classList.remove('spa-exit');
      _navigating = false;
      window.location.href = href;
      return;
    }

    // ── Step 3: Parse HTML ─────────────────────────────────────────────────
    const doc  = new DOMParser().parseFromString(html, 'text/html');
    const main = doc.querySelector('main');
    if (!main) {
      spaEl.classList.remove('spa-exit');
      _navigating = false;
      window.location.href = href;
      return;
    }

    // ── Step 4: Wait until BOTH animation AND CSS are done ────────────────
    // This guarantees: no flash of unstyled content, and smooth exit.
    await Promise.all([exitDelay, ...cssPromises]);

    // ── Step 5: Swap content ──────────────────────────────────────────────
    spaEl.classList.remove('spa-exit');
    spaEl.innerHTML = main.outerHTML;

    // ── Step 6: Navbar title / search ─────────────────────────────────────
    const titleEl = document.querySelector('.spa-page-title');
    if (titleEl) {
      titleEl.textContent   = route.title || '';
      titleEl.style.display = pageName === 'index.html' ? 'none' : '';
    }
    const searchEl = document.querySelector('.spa-search');
    if (searchEl) searchEl.style.display = pageName === 'index.html' ? '' : 'none';

    // ── Step 7: URL + history + document title + active nav ───────────────
    _currentPage = pageName;
    if (pushState) history.pushState({ pageName: pageName }, '', pageName);
    document.title = 'Vendix — ' + (route.title || pageName);
    updateActiveNav(pageName);

    // ── Step 8: Enter animation ───────────────────────────────────────────
    spaEl.classList.add('spa-enter');
    requestAnimationFrame(function () {
      spaEl.classList.remove('spa-enter');
      spaEl.classList.add('spa-entered');
      setTimeout(function () { spaEl.classList.remove('spa-entered'); }, 350);
    });

    // ── Step 9: Scroll to top ─────────────────────────────────────────────
    var mc = document.querySelector('.main-content');
    if (mc) mc.scrollTo({ top: 0 });

    // ── Step 10: Execute page script(s) ───────────────────────────────────
    // route.js puede ser un string o un array (varios scripts por página).
    document.querySelectorAll('._spaScript').forEach(function (s) { s.remove(); });
    var jsFiles = !route.js ? [] : (Array.isArray(route.js) ? route.js : [route.js]);
    for (var i = 0; i < jsFiles.length; i++) {
      try {
        var code = await fetch(jsFiles[i] + '?_v=' + Date.now()).then(function (r) { return r.text(); });
        var script = document.createElement('script');
        script.className = '_spaScript';
        // IIFE gives each page a clean scope — avoids "already declared" errors
        script.textContent = ';(async function(){\n' + code + '\n})().catch(console.error);';
        document.body.appendChild(script);
      } catch (err) {
        console.error('[Router] script load failed:', jsFiles[i], err);
      }
    }

    _navigating = false;
  }

  // ── Click interception (capture phase — before onclick handlers) ──────────
  document.addEventListener('click', function (e) {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (/^(https?:|mailto:|tel:|#|javascript:)/i.test(href)) return;
    const pageName = getPageName(href);
    if (!SPA_PAGES.has(pageName)) return;
    e.preventDefault();
    e.stopPropagation();
    spaNavigate(href);
  }, true);

  // ── Browser back / forward ────────────────────────────────────────────────
  window.addEventListener('popstate', function (e) {
    const pageName = (e.state && e.state.pageName)
      || location.pathname.replace(/^.*\//, '')
      || 'index.html';
    spaNavigate(pageName, false);
  });

  // ── Prefetch on sidebar hover ─────────────────────────────────────────────
  document.addEventListener('mouseover', function (e) {
    const a = e.target.closest('#sidebarNav a[href]');
    if (!a || a.dataset.prefetched) return;
    const href     = a.getAttribute('href') || '';
    const pageName = getPageName(href);
    if (!SPA_PAGES.has(pageName)) return;
    a.dataset.prefetched = '1';
    const route = ROUTES[pageName];
    fetch(pageName, { cache: 'force-cache' }).catch(function () {});
    if (route && route.js) fetch(route.js, { cache: 'force-cache' }).catch(function () {});
    // Also warm up CSS
    (route && route.css || []).forEach(function (css) {
      if (!_loadedCss.has(css)) fetch(css, { cache: 'force-cache' }).catch(function () {});
    });
  }, { passive: true });

  // Seed initial history entry so back button works from shell
  history.replaceState({ pageName: _currentPage }, '', location.href);

  // Public API
  window.spaNavigate = spaNavigate;

})();
