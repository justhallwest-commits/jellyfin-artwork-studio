/* Artwork Studio — custom page backgrounds for the Jellyfin web app.
 *  - Library pages show the library's own backdrop(s) instead of random item backdrops.
 *  - The home page and the login page can have their own backdrop(s).
 *  - The darkness of the overlay on top of backdrops is adjustable. */
(function () {
    'use strict';
    if (window.__artworkStudioLibBg) { return; }
    window.__artworkStudioLibBg = true;

    var cfg = window.__artworkStudioCfg || {};
    var ROTATE_MS = Math.max(5, cfg.interval || 12) * 1000;
    var DIM = Math.min(100, Math.max(0, cfg.dim == null ? 45 : cfg.dim)) / 100;
    var LOGIN_ROUTES = ['login', 'selectserver', 'forgotpassword', 'forgotpasswordpin', 'wizardstart'];
    var LIBRARY_ROUTES = ['movies', 'tv', 'music', 'list', 'livetv', 'books', 'homevideos', 'musicvideos', 'photos'];

    // Where the plugin lives, taken from this script's own address (works with a base URL / reverse proxy).
    var me = document.currentScript;
    var base = me && me.src ? me.src.replace(/ArtworkStudio\/ClientScript.*$/i, '') : null;
    function pluginUrl(path) {
        if (base) { return base + path; }
        var api = window.ApiClient;
        return api ? api.getUrl(path) : '../' + path;
    }
    function pageUrls(page) {
        return (cfg[page] || []).map(function (f) { return pluginUrl('ArtworkStudio/Backdrops/' + page + '/' + encodeURIComponent(f)); });
    }

    var cache = {};          // libraryId -> [urls]
    var currentKey = null;   // what's being shown ('home', 'login', 'lib:<id>' or null)
    var host = null, layers = [], urls = [], idx = 0, rotateTimer = null, addedWithBackdrop = false, curUrl = null;

    var dimCss = 'rgba(0,0,0,' + DIM + ')';
    var style = document.createElement('style');
    style.textContent =
        '#asLibBackdrop{position:fixed;top:0;left:0;right:0;bottom:0;z-index:-1;pointer-events:none;overflow:hidden}' +
        '#asLibBackdrop>div{position:absolute;top:0;left:0;right:0;bottom:0;background-size:cover;background-position:center;opacity:0;transition:opacity 1.2s ease}' +
        '#asLibBackdrop>div.as-on{opacity:1}' +
        'body.as-libbg .backdropContainer{display:none!important}' +
        'body.as-libbg .backgroundContainer{background:' + dimCss + '!important}' +
        (cfg.dimAll ? '.backgroundContainer.withBackdrop{background:' + dimCss + '!important}' : '') +
        // Login: the image is attached to the sign-in page itself, so nothing else can cover it
        '.as-loginbg{isolation:isolate;min-height:100vh;min-height:100dvh;background:transparent!important}' +
        '.as-loginbg::before{content:"";position:fixed;top:0;left:0;right:0;bottom:0;z-index:-2;background-image:var(--as-login-img);background-size:cover;background-position:center;transition:background-image 1s ease}' +
        '.as-loginbg::after{content:"";position:fixed;top:0;left:0;right:0;bottom:0;z-index:-1;background:' + dimCss + '}';
    document.head.appendChild(style);

    function routeInfo() {
        var h = location.hash || '';
        var q = h.indexOf('?');
        var route = (q < 0 ? h : h.substring(0, q)).toLowerCase().replace(/^#!?\/?/, '').replace(/\.html$/, '');
        var params = new URLSearchParams(q < 0 ? '' : h.substring(q + 1));
        return { route: route, params: params };
    }

    function backdropsForLibrary(id) {
        if (cache[id]) { return Promise.resolve(cache[id]); }
        var api = window.ApiClient;
        if (!api || !api.getCurrentUserId()) { return Promise.resolve([]); }
        return api.getItem(api.getCurrentUserId(), id).then(function (item) {
            var isLibrary = item && (item.Type === 'CollectionFolder' || item.Type === 'UserView' || (item.Type === 'Folder' && item.CollectionType));
            var tags = isLibrary ? (item.BackdropImageTags || []) : [];
            var list = tags.map(function (tag, i) {
                return api.getUrl('Items/' + id + '/Images/Backdrop/' + i, { tag: tag, maxWidth: 1920, quality: 85 });
            });
            cache[id] = list;
            return list;
        }).catch(function () { cache[id] = []; return []; });
    }

    function loginPageEl() {
        return document.querySelector('#loginPage:not(.hide),.loginPage:not(.hide),#selectServerPage:not(.hide),#forgotPasswordPage:not(.hide)');
    }

    function applyLogin() {
        if (currentKey !== 'login' || !curUrl) { return; }
        var lp = loginPageEl() || document.querySelector('.standalonePage:not(.hide)');
        if (!lp) { return; }
        lp.classList.add('as-loginbg');
        var v = 'url("' + curUrl + '")';
        if (lp.style.getPropertyValue('--as-login-img') !== v) { lp.style.setProperty('--as-login-img', v); }
    }

    // Decide what (if anything) should be shown for the current page.
    function target() {
        var r = routeInfo();
        if (loginPageEl() && cfg.login && cfg.login.length) {
            return { key: 'login', load: function () { return Promise.resolve(pageUrls('login')); } };
        }
        if (r.route === 'home') {
            return cfg.home && cfg.home.length ? { key: 'home', load: function () { return Promise.resolve(pageUrls('home')); } } : null;
        }
        if (LOGIN_ROUTES.indexOf(r.route) >= 0) {
            return cfg.login && cfg.login.length ? { key: 'login', load: function () { return Promise.resolve(pageUrls('login')); } } : null;
        }
        if (cfg.enabled !== false && LIBRARY_ROUTES.indexOf(r.route) >= 0) {
            var id = r.params.get('topParentId') || r.params.get('parentId');
            if (id) { return { key: 'lib:' + id, load: function () { return backdropsForLibrary(id); } }; }
        }
        return null;
    }

    function ensureHost() {
        if (host && host.isConnected) { return; }
        host = document.createElement('div');
        host.id = 'asLibBackdrop';
        host.innerHTML = '<div></div><div></div>';
        layers = [host.children[0], host.children[1]];
        var anchor = document.querySelector('.backdropContainer') || document.querySelector('.backgroundContainer');
        if (anchor && anchor.parentNode) { anchor.parentNode.insertBefore(host, anchor); }
        else { document.body.insertBefore(host, document.body.firstChild); }
    }

    function showImage(url) {
        ensureHost();
        var img = new Image();
        img.onload = function () {
            var next = layers[0].classList.contains('as-on') ? layers[1] : layers[0];
            var prev = next === layers[0] ? layers[1] : layers[0];
            next.style.backgroundImage = 'url("' + url + '")';
            next.classList.add('as-on');
            prev.classList.remove('as-on');
            curUrl = url;
            applyLogin();
        };
        img.src = url;
    }

    function assertDim() {
        var bg = document.querySelector('.backgroundContainer');
        if (bg && !bg.classList.contains('withBackdrop')) { bg.classList.add('withBackdrop'); addedWithBackdrop = true; }
        document.body.classList.add('as-libbg');
    }

    function start(list) {
        urls = list;
        idx = Math.floor(Math.random() * list.length);
        assertDim();
        showImage(urls[idx]);
        clearInterval(rotateTimer);
        if (urls.length > 1) {
            rotateTimer = setInterval(function () { idx = (idx + 1) % urls.length; showImage(urls[idx]); }, ROTATE_MS);
        }
    }

    function stop() {
        clearInterval(rotateTimer); rotateTimer = null; urls = []; curUrl = null;
        document.body.classList.remove('as-libbg');
        Array.prototype.forEach.call(document.querySelectorAll('.as-loginbg'), function (el) { el.classList.remove('as-loginbg'); el.style.removeProperty('--as-login-img'); });
        if (host) { host.remove(); host = null; }
        if (addedWithBackdrop) {
            var bg = document.querySelector('.backgroundContainer');
            var jellyfinOwn = document.querySelector('.backdropContainer .backdropImage');
            if (bg && !jellyfinOwn) { bg.classList.remove('withBackdrop'); }
            addedWithBackdrop = false;
        }
    }

    function check() {
        var t = target();
        var key = t ? t.key : null;
        if (key === currentKey) {
            // Jellyfin re-renders pages; keep our background attached
            if (currentKey && urls.length) { assertDim(); ensureHost(); applyLogin(); }
            return;
        }
        stop();
        currentKey = key;
        if (!t) { stop(); return; }
        t.load().then(function (list) {
            if (currentKey !== key) { return; }
            if (list.length) { start(list); } else { stop(); }
        });
    }

    window.addEventListener('hashchange', check);
    document.addEventListener('viewshow', check);
    setInterval(check, 800);
    check();
})();
