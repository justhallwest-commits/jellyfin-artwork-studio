/* Artwork Studio — show a library's own backdrop(s) behind that library's pages.
 * Jellyfin's web app normally rotates random backdrops from items inside the library;
 * when a library has backdrops set, this shows those instead. */
(function () {
    'use strict';
    if (window.__artworkStudioLibBg) { return; }
    window.__artworkStudioLibBg = true;

    var cfg = window.__artworkStudioCfg || {};
    if (cfg.enabled === false) { return; }
    var ROTATE_MS = Math.max(5, cfg.interval || 12) * 1000;

    var cache = {};          // libraryId -> [urls]
    var current = null;      // libraryId being shown (or null)
    var lastHref = null;
    var host = null, layers = [], urls = [], idx = 0, rotateTimer = null, addedWithBackdrop = false;

    var style = document.createElement('style');
    style.textContent =
        '#asLibBackdrop{position:fixed;top:0;left:0;right:0;bottom:0;z-index:-1;pointer-events:none;overflow:hidden}' +
        '#asLibBackdrop>div{position:absolute;top:0;left:0;right:0;bottom:0;background-size:cover;background-position:center;opacity:0;transition:opacity 1.2s ease}' +
        '#asLibBackdrop>div.as-on{opacity:1}' +
        'body.as-libbg .backdropContainer{display:none!important}';
    document.head.appendChild(style);

    function client() { return window.ApiClient; }

    function libraryIdFromUrl() {
        var h = location.hash || '';
        var q = h.indexOf('?');
        if (q < 0) { return null; }
        // Only library landing pages: #/movies, #/tv, #/music, #/list … (with or without .html)
        var route = h.substring(0, q).toLowerCase().replace(/^#!?\/?/, '').replace(/\.html$/, '');
        if (['movies', 'tv', 'music', 'list', 'livetv', 'books', 'homevideos', 'musicvideos', 'photos'].indexOf(route) < 0) { return null; }
        var p = new URLSearchParams(h.substring(q + 1));
        return p.get('topParentId') || p.get('parentId') || null;
    }

    function backdropsFor(id) {
        if (cache[id]) { return Promise.resolve(cache[id]); }
        var api = client();
        if (!api || !api.getCurrentUserId()) { return Promise.resolve([]); }
        return api.getItem(api.getCurrentUserId(), id).then(function (item) {
            var isLibrary = item && (item.Type === 'CollectionFolder' || item.Type === 'UserView' || item.Type === 'Folder' && item.CollectionType);
            var tags = isLibrary ? (item.BackdropImageTags || []) : [];
            var list = tags.map(function (tag, i) {
                return api.getUrl('Items/' + id + '/Images/Backdrop/' + i, { tag: tag, maxWidth: 1920, quality: 85 });
            });
            cache[id] = list;
            return list;
        }).catch(function () { cache[id] = []; return []; });
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
        };
        img.src = url;
    }

    function assertDim() {
        // Jellyfin dims the page over backdrops with .backgroundContainer.withBackdrop
        var bg = document.querySelector('.backgroundContainer');
        if (bg && !bg.classList.contains('withBackdrop')) { bg.classList.add('withBackdrop'); addedWithBackdrop = true; }
        document.body.classList.add('as-libbg');
    }

    function start(list) {
        urls = list; idx = 0;
        assertDim();
        showImage(urls[0]);
        clearInterval(rotateTimer);
        if (urls.length > 1) {
            rotateTimer = setInterval(function () { idx = (idx + 1) % urls.length; showImage(urls[idx]); }, ROTATE_MS);
        }
    }

    function stop() {
        clearInterval(rotateTimer); rotateTimer = null; urls = [];
        document.body.classList.remove('as-libbg');
        if (host) { host.remove(); host = null; }
        if (addedWithBackdrop) {
            var bg = document.querySelector('.backgroundContainer');
            var jellyfinOwn = document.querySelector('.backdropContainer .backdropImage');
            if (bg && !jellyfinOwn) { bg.classList.remove('withBackdrop'); }
            addedWithBackdrop = false;
        }
    }

    function check() {
        if (location.href === lastHref) {
            if (current && urls.length) { assertDim(); ensureHost(); }
            return;
        }
        lastHref = location.href;
        var id = libraryIdFromUrl();
        if (id === current) { return; }
        current = id;
        if (!id) { stop(); return; }
        backdropsFor(id).then(function (list) {
            if (current !== id) { return; }
            if (list.length) { start(list); } else { stop(); }
        });
    }

    window.addEventListener('hashchange', check);
    document.addEventListener('viewshow', check);
    setInterval(check, 800);
    check();
})();
