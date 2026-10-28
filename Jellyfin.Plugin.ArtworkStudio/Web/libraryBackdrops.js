/* Artwork Studio \u2014 custom page backgrounds for the Jellyfin web app.
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
        '.as-bg-video{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;pointer-events:none}' +
        '.as-login-video{position:fixed;top:0;left:0;width:100vw;height:100vh;object-fit:cover;z-index:-2;pointer-events:none}' +
        'html.transparentDocument .as-bg-video,html.transparentDocument .as-login-video{display:none!important}' +
        'body.as-libbg .backdropContainer{display:none!important}' +
        'body.as-libbg .backgroundContainer:not(.backgroundContainer-transparent){background:' + dimCss + '!important}' +
        (cfg.dimAll ? '.backgroundContainer.withBackdrop:not(.backgroundContainer-transparent){background:' + dimCss + '!important}' : '') +
        'html.transparentDocument #asLibBackdrop,html.transparentDocument #asLoginSplit{display:none!important}' +
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
        var p = document.querySelector('#loginPage:not(.hide),.loginPage:not(.hide),#selectServerPage:not(.hide),#forgotPasswordPage:not(.hide)');
        if (p) { return p; }
        var f = document.querySelector('.manualLoginForm,#divUsers,.visualLoginForm');
        var pg = f && f.closest('.page,[data-role="page"]');
        return pg && !pg.classList.contains('hide') && pg.offsetParent !== null ? pg : null;
    }

    // Split-screen login: our own fixed element on the image side, outside Jellyfin's page,
    // so nothing inside the page can clip or cover it.
    var SPLIT = !!(cfg.theme && /^split/.test(cfg.theme.LoginLayout || ''));
    var splitEl = null, splitLayers = [], splitShown = null;
    // A layer shows either an image (as its background) or a muted looping video
    function isVideo(url) { return /\.(mp4|webm)(\?|$)/i.test(url || ''); }
    function setLayer(layer, url) {
        var v = layer.querySelector('video');
        if (isVideo(url)) {
            layer.style.backgroundImage = '';
            if (!v) {
                v = document.createElement('video');
                v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true;
                v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
                v.className = 'as-bg-video';
                layer.appendChild(v);
            }
            if (v.getAttribute('src') !== url) { v.src = url; }
            var pr = v.play(); if (pr && pr.catch) { pr.catch(function () {}); }
        } else {
            if (v) { v.remove(); }
            layer.style.backgroundImage = 'url("' + url + '")';
        }
    }

    function showSplit(url) {
        if (!splitEl || !splitEl.isConnected) {
            splitEl = document.createElement('div');
            splitEl.id = 'asLoginSplit';
            splitEl.innerHTML = '<div></div><div></div>';
            splitLayers = [splitEl.children[0], splitEl.children[1]];
            document.body.appendChild(splitEl);
            splitShown = null;
        }
        document.body.classList.add('as-split-login');
        layoutSplit();
        if (splitShown === url) { return; }
        splitShown = url;
        var next = splitLayers[0].classList.contains('as-on') ? splitLayers[1] : splitLayers[0];
        var prev = next === splitLayers[0] ? splitLayers[1] : splitLayers[0];
        setLayer(next, url);
        next.classList.add('as-on');
        prev.classList.remove('as-on');
    }
    // Start the image just past the sign-in form so it can fade across the empty part of the panel
    function layoutSplit() {
        if (!splitEl) { return; }
        var right = cfg.theme && cfg.theme.LoginLayout === 'split-right';
        var vw = window.innerWidth || document.documentElement.clientWidth;
        var fade = Math.round(vw * Math.min(60, Math.max(4, (cfg.theme && cfg.theme.LoginFadeWidth) || 24)) / 100);
        splitEl.style.setProperty('--as-fade', fade + 'px');
        if (vw <= 820) { splitEl.style.left = ''; splitEl.style.right = ''; return; }
        var page = loginPageEl();
        if (!page) { return; }
        var edge = right ? vw : 0;
        Array.prototype.forEach.call(page.querySelectorAll('input,button,h1,h2,h3,.as-login-brand,.cardBox,label,p'), function (el) {
            if (!el.offsetParent) { return; }
            var r = el.getBoundingClientRect();
            if (!r.width) { return; }
            edge = right ? Math.min(edge, r.left) : Math.max(edge, r.right);
        });
        var gap = 28;
        if (right) {
            var rightPx = Math.max(vw * 0.3, vw - edge + gap);
            splitEl.style.right = Math.round(rightPx) + 'px'; splitEl.style.left = '0px';
        } else {
            var leftPx = Math.min(vw * 0.7, edge + gap);
            splitEl.style.left = Math.round(leftPx) + 'px'; splitEl.style.right = '0px';
        }
    }
    window.addEventListener('resize', function () { layoutSplit(); });

    function hideSplit() {
        document.body.classList.remove('as-split-login');
        if (splitEl) { splitEl.remove(); splitEl = null; splitShown = null; }
    }

    function applyLogin() {
        if (currentKey !== 'login' || !curUrl) { return; }
        if (SPLIT) { showSplit(curUrl); layoutSplit(); return; }
        var lp = loginPageEl() || document.querySelector('.standalonePage:not(.hide)');
        if (!lp) { return; }
        lp.classList.add('as-loginbg');
        var vid = lp.querySelector(':scope > video.as-login-video');
        if (isVideo(curUrl)) {
            // video can't be a CSS background: put a looping video at the back of the sign-in page
            lp.style.removeProperty('--as-login-img');
            if (!vid) {
                vid = document.createElement('video');
                vid.className = 'as-login-video';
                vid.muted = true; vid.loop = true; vid.autoplay = true; vid.playsInline = true;
                vid.setAttribute('muted', ''); vid.setAttribute('playsinline', '');
                lp.insertBefore(vid, lp.firstChild);
            }
            if (vid.getAttribute('src') !== curUrl) { vid.src = curUrl; var pr = vid.play(); if (pr && pr.catch) { pr.catch(function () {}); } }
            return;
        }
        if (vid) { vid.remove(); }
        var v = 'url("' + curUrl + '")';
        if (lp.style.getPropertyValue('--as-login-img') !== v) { lp.style.setProperty('--as-login-img', v); }
    }

    // Decide what (if anything) should be shown for the current page.
    function target() {
        var r = routeInfo();
        var split = cfg.theme && /^split/.test(cfg.theme.LoginLayout || '');
        var loginSrc = cfg.login && cfg.login.length ? 'login' : (split && cfg.home && cfg.home.length ? 'home' : null);
        if (loginPageEl() && loginSrc) {
            return { key: 'login', load: function () { return Promise.resolve(pageUrls(loginSrc)); } };
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
            setLayer(next, url);
            next.classList.add('as-on');
            prev.classList.remove('as-on');
            curUrl = url;
            applyLogin();
        };
        if (isVideo(url)) { img.onload(); return; }   // videos load themselves
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
        hideSplit();
        document.body.classList.remove('as-libbg');
        Array.prototype.forEach.call(document.querySelectorAll('.as-loginbg'), function (el) { el.classList.remove('as-loginbg'); el.style.removeProperty('--as-login-img'); });
        Array.prototype.forEach.call(document.querySelectorAll('video.as-login-video'), function (v) { v.remove(); });
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
