/* HallFlix TV — a remote-control interface for Jellyfin, styled by Artwork Studio.
 * Served by the Artwork Studio plugin at /ArtworkStudio/TV/ and opened by the HallFlix apps for
 * LG (webOS), Samsung (Tizen) and Android TV / Fire TV. Written in ES5 so 2018+ TVs can run it.
 * Query string: ?platform=webos|tizen|android|browser&home=<wrapper start page, to change server>
 */
(function () {
    'use strict';

    // ================================================================== basics
    var VERSION = '1.0.0';
    var qs = parseQuery(location.search);
    var PLATFORM = qs.platform || (window.webOS || /web0s|webos/i.test(navigator.userAgent) ? 'webos' : window.tizen ? 'tizen' : window.HallFlixNative ? 'android' : 'browser');
    var SERVER = location.href.replace(/\/ArtworkStudio\/TV\/?.*$/i, '');
    var NATIVE = window.HallFlixNative || null;
    var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: [8, 27, 461, 10009, 166], PLAY: [415, 179, 10252], PAUSE: [19, 10252, 179], STOP: [413], FF: [417, 228], RW: [412, 227] };
    var $app = document.getElementById('hfApp');
    var $overlay = document.getElementById('hfOverlay');

    function parseQuery(s) { var o = {}; (s || '').replace(/^\?/, '').split('&').forEach(function (p) { if (!p) { return; } var i = p.indexOf('='); o[decodeURIComponent(i < 0 ? p : p.slice(0, i))] = i < 0 ? '' : decodeURIComponent(p.slice(i + 1).replace(/\+/g, ' ')); }); return o; }
    function extend(a) { for (var i = 1; i < arguments.length; i++) { var b = arguments[i]; if (b) { for (var k in b) { if (Object.prototype.hasOwnProperty.call(b, k)) { a[k] = b[k]; } } } } return a; }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function el(tag, cls, html) { var e = document.createElement(tag); if (cls) { e.className = cls; } if (html != null) { e.innerHTML = html; } return e; }
    function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
    function store(k, v) { try { if (v === undefined) { var x = localStorage.getItem(k); return x ? JSON.parse(x) : null; } if (v === null) { localStorage.removeItem(k); } else { localStorage.setItem(k, JSON.stringify(v)); } } catch (e) { /* storage off */ } return null; }
    function uuid() { return 'hf-xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }); }
    function ticksToTime(t) { var s = Math.floor((t || 0) / 1e7), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60; return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (sec < 10 ? '0' : '') + sec; }
    function runtime(t) { var m = Math.round((t || 0) / 6e8); return m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + 'm'; }
    function endsAt(ticks) { var d = new Date(Date.now() + (ticks || 0) / 1e4); var h = d.getHours(), m = d.getMinutes(); return 'Ends at ' + ((h % 12) || 12) + ':' + (m < 10 ? '0' : '') + m + (h < 12 ? ' AM' : ' PM'); }
    function toast(msg) { var t = document.getElementById('hfToast'); t.textContent = msg; t.className = 'on'; clearTimeout(toast.t); toast.t = setTimeout(function () { t.className = ''; }, 3200); }
    function nid(id) { return String(id || '').replace(/-/g, '').toLowerCase(); }

    // ================================================================== Jellyfin API
    var DEVICE_ID = store('hf-device-id') || uuid(); store('hf-device-id', DEVICE_ID);
    var DEVICE_NAME = { webos: 'LG TV', tizen: 'Samsung TV', android: 'Android TV', browser: 'Web browser' }[PLATFORM] || 'TV';
    var auth = store('hf-auth-' + nid(SERVER)) || null;   // { UserId, AccessToken, Name }

    function authHeader() {
        return 'MediaBrowser Client="HallFlix TV", Device="' + DEVICE_NAME + '", DeviceId="' + DEVICE_ID + '", Version="' + VERSION + '"' + (auth ? ', Token="' + auth.AccessToken + '"' : '');
    }
    function url(path, query) {
        var q = [];
        for (var k in (query || {})) { if (query[k] !== undefined && query[k] !== null && query[k] !== '') { q.push(encodeURIComponent(k) + '=' + encodeURIComponent(query[k])); } }
        return SERVER + '/' + path.replace(/^\//, '') + (q.length ? (path.indexOf('?') < 0 ? '?' : '&') + q.join('&') : '');
    }
    function api(method, path, query, body) {
        return new Promise(function (resolve, reject) {
            var x = new XMLHttpRequest();
            x.open(method, url(path, query));
            x.setRequestHeader('Authorization', authHeader());
            if (body !== undefined) { x.setRequestHeader('Content-Type', 'application/json'); }
            x.onload = function () {
                if (x.status === 401 && auth) { signOut(true); }
                if (x.status >= 200 && x.status < 300) { try { resolve(x.responseText ? JSON.parse(x.responseText) : null); } catch (e) { resolve(null); } }
                else { var err = new Error(x.responseText || ('HTTP ' + x.status)); err.status = x.status; reject(err); }
            };
            x.onerror = function () { reject(new Error('Can’t reach the server')); };
            x.send(body === undefined ? null : JSON.stringify(body));
        });
    }
    function img(id, type, opts, tag) {
        if (!id) { return ''; }
        return url('Items/' + id + '/Images/' + (type || 'Primary') + (opts && opts.index != null ? '/' + opts.index : ''), extend({ quality: 90, tag: tag }, opts && opts.q));
    }
    function uid() { return auth && auth.UserId; }

    // ================================================================== Artwork Studio design
    var CFG = {}, THEME = {}, X = {}, PRESET = null;
    function safeColor(v) { return /^#[0-9a-f]{6}$/i.test(v || '') ? v : ''; }
    function rgb(h) { var n = parseInt(String(h).replace('#', ''), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    function onColor(h) { var c = rgb(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) > 0.5 ? '#000' : '#fff'; }
    function brandUrl(slot, f) { return f ? url('ArtworkStudio/Backdrops/' + slot + '/' + encodeURIComponent(f)) : null; }
    function applyDesign() {
        THEME = CFG.theme || {}; X = CFG.extras || {};
        var P = window.__artworkStudioPresets;
        PRESET = P && THEME.Preset && P.list[THEME.Preset] ? P.list[THEME.Preset] : null;
        var accent = safeColor(THEME.AccentColor) || (PRESET && safeColor(PRESET.settings.AccentColor)) || '#e50914';
        var bg = safeColor(THEME.BackgroundColor) || (PRESET && safeColor(PRESET.settings.BackgroundColor)) || '#0b0b0f';
        var r = document.documentElement.style;
        r.setProperty('--accent', accent); r.setProperty('--accent-rgb', rgb(accent).join(','));
        r.setProperty('--on-accent', onColor(accent));
        r.setProperty('--bg', bg); r.setProperty('--bg-rgb', rgb(bg).join(','));
        var b = rgb(bg); r.setProperty('--surface', 'rgb(' + b.map(function (v) { return Math.round(v + (255 - v) * 0.07); }).join(',') + ')');
        if (PRESET && PRESET.style) { if (PRESET.style.text) { r.setProperty('--text', PRESET.style.text); } if (PRESET.style.muted) { r.setProperty('--muted', PRESET.style.muted); } }
        var radius = THEME.CardRadius >= 0 ? THEME.CardRadius : (PRESET && PRESET.settings.CardRadius >= 0 ? PRESET.settings.CardRadius : -1);
        if (radius >= 0) { r.setProperty('--radius', Math.min(40, radius) * 1.4 + 'px'); }
        var fonts = [THEME.BodyFont || (PRESET && PRESET.settings.BodyFont), THEME.HeadingFont || (PRESET && PRESET.settings.HeadingFont)];
        fonts.forEach(function (f, i) {
            if (!f) { return; }
            var l = document.createElement('link'); l.rel = 'stylesheet';
            l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(f).replace(/%20/g, '+') + (/bebas|anton/i.test(f) ? '' : ':wght@400;600;700;800') + '&display=swap';
            document.head.appendChild(l);
            r.setProperty(i ? '--head-font' : '--font', '"' + f + '", "Noto Sans", sans-serif');
        });
        if (THEME.SiteName) { document.title = THEME.SiteName; }
    }
    function logoUrl(login) { var br = CFG.brand || {}; return login ? brandUrl('loginlogo', br.loginLogo) || brandUrl('logo', br.logo) : brandUrl('logo', br.logo); }
    function siteName() { return THEME.SiteName || 'HallFlix'; }

    // ================================================================== background layers
    var bgState = { i: 0, timer: null, list: [] };
    function setBackground(list, rotate) {
        clearInterval(bgState.timer);
        bgState.list = (list || []).filter(Boolean);
        bgState.i = 0;
        showBg(bgState.list[0] || null);
        if (rotate && bgState.list.length > 1) { bgState.timer = setInterval(function () { bgState.i = (bgState.i + 1) % bgState.list.length; showBg(bgState.list[bgState.i]); }, Math.max(6, CFG.interval || 12) * 1000); }
    }
    function showBg(src) {
        var layers = qsa('#hfBg .hf-bg-layer'), cur = layers[0].classList.contains('on') ? 0 : 1, next = layers[1 - cur];
        if (!src) { layers[0].classList.remove('on'); layers[1].classList.remove('on'); next.innerHTML = ''; return; }
        if (/\.(mp4|webm)(\?|$)/i.test(src)) {
            next.style.backgroundImage = 'none';
            next.innerHTML = '<video autoplay muted loop playsinline src="' + esc(src) + '"></video>';
        } else {
            next.innerHTML = '';
            next.style.backgroundImage = 'url("' + src + '")';
        }
        next.classList.add('on'); layers[cur].classList.remove('on');
        setTimeout(function () { if (!layers[cur].classList.contains('on')) { layers[cur].innerHTML = ''; } }, 1200);
    }
    function setShade(kind) {
        var s = document.getElementById('hfBgShade');
        var dim = (CFG.dim == null ? 45 : CFG.dim) / 100;
        s.style.background = kind === 'full'
            ? 'rgba(var(--bg-rgb),' + Math.max(0.55, dim + 0.35) + ')'
            : 'linear-gradient(90deg, rgba(var(--bg-rgb),.97) 0%, rgba(var(--bg-rgb),' + (0.55 + dim * 0.4).toFixed(2) + ') 45%, rgba(var(--bg-rgb),' + (dim * 0.6).toFixed(2) + ') 100%), linear-gradient(0deg, rgba(var(--bg-rgb),1) 0%, rgba(var(--bg-rgb),0) 45%)';
    }

    // ================================================================== focus engine (D-pad)
    var focusRoot = function () { return $overlay.classList.contains('on') ? $overlay : (player.on ? document.getElementById('hfPlayer') : $app); };
    var current = null;
    function visible(e) { var r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.disabled; }
    function focusables() { return qsa('.f', focusRoot()).filter(visible); }
    function setFocus(e, noScroll) {
        if (!e) { return; }
        qsa('.focused').forEach(function (x) { if (x !== e) { x.classList.remove('focused'); } });
        current = e; e.classList.add('focused');
        if (e.tagName === 'INPUT') { try { e.focus(); } catch (x) { /* ignore */ } } else if (document.activeElement && document.activeElement.tagName === 'INPUT') { document.activeElement.blur(); }
        if (!noScroll) { reveal(e); }
        if (e.onfocusin2) { e.onfocusin2(); }
    }
    function reveal(e) {
        // horizontal rows scroll themselves; the page moves so the focused row is in view
        var track = e.closest ? e.closest('.hf-row-track,.hf-menu-scroll') : null;
        if (track) {
            if (track.classList.contains('hf-menu-scroll')) {
                var mt = e.offsetTop - track.clientHeight / 2 + e.offsetHeight / 2; track.scrollTop = Math.max(0, mt);
            } else {
                var r = e.getBoundingClientRect(), tr = track.getBoundingClientRect(), pad = window.innerWidth * 0.042;
                if (r.right > tr.right - pad) { track.scrollLeft += r.right - tr.right + pad; }
                else if (r.left < tr.left + pad) { track.scrollLeft -= tr.left + pad - r.left; }
            }
        }
        var inner = e.closest ? e.closest('.hf-scroll-inner') : null;
        var screen = e.closest ? e.closest('.hf-screen') : null;
        if (!inner && screen && e.closest('.hf-top')) {
            inner = screen.querySelector('.hf-scroll-inner');
            if (inner) { inner.setAttribute('data-y', '0'); inner.style.transform = ''; }
            screen.classList.remove('scrolled');
            return;
        }
        if (inner) {
            var box = inner.parentNode.getBoundingClientRect(), er = e.getBoundingClientRect();
            var y = parseFloat(inner.getAttribute('data-y') || '0');
            var anchor = e.closest('.hf-row,.hf-spot,.hf-details-top,.hf-section') || e;
            var ar = anchor.getBoundingClientRect();
            var target = y;
            if (anchor.classList.contains('hf-spot') || anchor.classList.contains('hf-details-top')) { target = 0; }
            else if (ar.top < box.top + box.height * 0.12 || er.bottom > box.bottom - box.height * 0.08) { target = y - (ar.top - box.top - box.height * 0.18); }
            target = Math.min(0, Math.max(target, -(inner.scrollHeight - box.height + box.height * 0.1)));
            if (target !== y) { inner.setAttribute('data-y', target); inner.style.transform = 'translateY(' + target + 'px)'; }
            if (screen) { screen.classList.toggle('scrolled', target < -window.innerHeight * 0.05); }
        }
    }
    function centerOf(r) { return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
    function move(dir) {
        var list = focusables();
        if (!current || list.indexOf(current) < 0) { setFocus(firstFocus(list)); return; }
        var cr = current.getBoundingClientRect(), c = centerOf(cr), best = null, bestScore = Infinity;
        var sameRow = current.closest('.hf-row-track,.hf-nav,.hf-tabs,.ctrls,.hf-btns');
        list.forEach(function (e) {
            if (e === current) { return; }
            var r = e.getBoundingClientRect(), p = centerOf(r), dx = p.x - c.x, dy = p.y - c.y, main, cross;
            if (dir === 'left') { if (r.right > cr.left + 2) { return; } main = cr.left - r.right; cross = Math.abs(dy); }
            else if (dir === 'right') { if (r.left < cr.right - 2) { return; } main = r.left - cr.right; cross = Math.abs(dy); }
            else if (dir === 'up') { if (r.bottom > cr.top + 2) { return; } main = cr.top - r.bottom; cross = Math.abs(dx); }
            else { if (r.top < cr.bottom - 2) { return; } main = r.top - cr.bottom; cross = Math.abs(dx); }
            var score = main + cross * ((dir === 'up' || dir === 'down') ? 0.35 : 2.2);
            if ((dir === 'left' || dir === 'right') && sameRow && e.closest('.hf-row-track,.hf-nav,.hf-tabs,.ctrls,.hf-btns') !== sameRow) {
                if (sameRow.classList.contains('hf-row-track') || sameRow.classList.contains('hf-tabs') || current.closest('.hf-spot')) { return; }
                score += 100000;
            }
            if (score < bestScore) { bestScore = score; best = e; }
        });
        if (best && (dir === 'up' || dir === 'down')) {
            // entering a row: go back to the card last used in it
            var track = best.closest('.hf-row-track');
            if (track && track !== sameRow && track.lastFocus && track.contains(track.lastFocus) && visible(track.lastFocus)) { best = track.lastFocus; }
        }
        if (best) {
            var t = current.closest('.hf-row-track'); if (t) { t.lastFocus = current; }
            setFocus(best);
        }
        return !!best;
    }
    function firstFocus(list) {
        list = list || focusables();
        return list.filter(function (e) { return e.classList.contains('autofocus'); })[0] || list.filter(function (e) { return !e.closest('.hf-top'); })[0] || list[0];
    }
    function focusFirst() { current = null; setFocus(firstFocus()); }
    var lastMove = 0, lastXY = '';
    document.addEventListener('mousemove', function (e) {
        var xy = e.clientX + ',' + e.clientY; if (xy === lastXY) { return; } lastXY = xy; lastMove = Date.now();
        var f = e.target.closest && e.target.closest('.f'); if (f && f !== current && focusRoot().contains(f)) { setFocus(f, true); }
    });
    document.addEventListener('mouseover', function (e) { if (Date.now() - lastMove > 120) { return; } var f = e.target.closest && e.target.closest('.f'); if (f && focusRoot().contains(f)) { setFocus(f, true); } });

    // ================================================================== navigation stack
    var stack = [];
    function show(screen) {
        if (stack.length) {
            var top = stack[stack.length - 1];
            top.lastFocus = current; top.scrollY = (top.el.querySelector('.hf-scroll-inner') || {}).getAttribute ? top.el.querySelector('.hf-scroll-inner').getAttribute('data-y') : null;
            if (top.pause) { top.pause(); }
            top.el.style.display = 'none';
        }
        screen.el = el('div', 'hf-screen');
        $app.appendChild(screen.el);
        stack.push(screen);
        current = null;
        var r = screen.render(screen.el);
        var after = function () { if (stack[stack.length - 1] === screen && !current) { focusFirst(); } };
        if (r && r.then) { r.then(after, function (e) { screen.el.innerHTML = '<div class="hf-empty" style="padding-top:20vh">' + esc(e.message) + '</div>'; after(); }); } else { after(); }
    }
    function replace(screen) { while (stack.length) { var s = stack.pop(); if (s.destroy) { s.destroy(); } s.el.remove(); } show(screen); }
    function back() {
        if ($overlay.classList.contains('on')) { closeMenu(); return true; }
        if (player.on) { player.stop(true); return true; }
        if (stack.length <= 1) {
            var top = stack[0];
            if (top && top.onRootBack && top.onRootBack()) { return true; }
            return false;   // let the app close
        }
        var s = stack.pop(); if (s.destroy) { s.destroy(); } s.el.remove();
        var prev = stack[stack.length - 1];
        prev.el.style.display = '';
        if (prev.resume) { prev.resume(); }
        current = null;
        if (prev.lastFocus && prev.el.contains(prev.lastFocus)) { setFocus(prev.lastFocus, true); } else { focusFirst(); }
        return true;
    }
    var FRAMED = window.parent !== window;
    function toWrapper(msg) { try { window.parent.postMessage(JSON.stringify(extend({ hallflix: true }, msg)), '*'); } catch (e) { /* ignore */ } }
    function exitApp() {
        if (FRAMED) { toWrapper({ action: 'exit' }); return; }
        if (window.webOS && webOS.platformBack) { webOS.platformBack(); return; }
        try { if (window.tizen) { tizen.application.getCurrentApplication().exit(); return; } } catch (e) { /* ignore */ }
        try { window.close(); } catch (e2) { /* ignore */ }
    }
    // Android calls this for the Back button; false = close the app
    window.HallFlix = { back: function () { return back(); }, nativeEvent: function (name, data) { player.nativeEvent(name, data); } };

    // ================================================================== menus (overlay)
    var menuReturn = null;
    function openMenu(title, items, onPick) {
        menuReturn = current;
        $overlay.innerHTML = '';
        var m = el('div', 'hf-menu', '<h3>' + esc(title) + '</h3>');
        var sc = el('div', 'hf-menu-scroll');
        items.forEach(function (it, i) {
            var b = el('button', 'f hf-item' + (it.checked ? ' checked autofocus' : ''), '<span>' + esc(it.label) + '</span>' + (it.note ? '<em>' + esc(it.note) + '</em>' : ''));
            b.onclick = function () { closeMenu(); onPick(it, i); };
            sc.appendChild(b);
        });
        m.appendChild(sc); $overlay.appendChild(m);
        $overlay.classList.add('on');
        current = null; focusFirst();
    }
    function closeMenu() { $overlay.classList.remove('on'); $overlay.innerHTML = ''; current = null; if (menuReturn && document.body.contains(menuReturn)) { setFocus(menuReturn, true); } else { focusFirst(); } }

    // ================================================================== keys
    function isKey(e, list) { return list.indexOf(e.keyCode) >= 0; }
    function onKey(e) {
        var k = e.keyCode, typing = document.activeElement && document.activeElement.tagName === 'INPUT';
        if (player.on && player.key(e)) { e.preventDefault(); return; }
        if (typing && (k === 8 || (k >= 48 && k <= 90) || k === 32)) { return; }   // let the keyboard type
        if (isKey(e, KEY.BACK)) { if (typing && k === 8) { return; } e.preventDefault(); if (!back() && !NATIVE) { exitApp(); } return; }
        if (typing && (k === KEY.LEFT || k === KEY.RIGHT)) { return; }
        if (k === KEY.LEFT || k === KEY.RIGHT) {
            e.preventDefault();
            var dir = k === KEY.LEFT ? 'left' : 'right';
            if (!move(dir) && current && current.closest('.hf-spot')) { var inner = current.closest('.hf-scroll-inner'); if (inner && inner.spotNav) { inner.spotNav(dir); } }
        }
        else if (k === KEY.UP) { e.preventDefault(); move('up'); }
        else if (k === KEY.DOWN) { e.preventDefault(); move('down'); }
        else if (k === KEY.ENTER) { if (current) { e.preventDefault(); if (current.tagName === 'INPUT') { if (current.onenter) { current.onenter(); } } else { current.click(); } } }
    }
    document.addEventListener('keydown', onKey);
    // the LG / Samsung wrapper passes on keys that reach it while this page isn't focused
    window.addEventListener('message', function (ev) {
        var m; try { m = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data; } catch (x) { return; }
        if (m && m.hallflix && m.key) { onKey({ keyCode: m.key, preventDefault: function () { } }); }
    });
    if (window.tizen && tizen.tvinputdevice) {
        ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaFastForward', 'MediaRewind'].forEach(function (k) { try { tizen.tvinputdevice.registerKey(k); } catch (e) { /* not supported */ } });
    }

    // ================================================================== cards
    function badgesFor(it) {
        var out = [];
        var d = it.Type === 'Series' ? (it.DateLastMediaAdded || it.DateCreated) : it.DateCreated;
        if (X.Badges !== false && X.BadgeNew !== false && d && Date.now() - Date.parse(d) < Math.max(1, X.BadgeNewDays || 14) * 864e5) { out.push('<span class="new">NEW</span>'); }
        if (X.Badges !== false && X.BadgeQuality !== false && (it.Width >= 3200 || it.Height >= 1700)) { out.push('<span class="k4">4K</span>'); }
        if (X.Badges !== false && X.BadgeVersions !== false && it.MediaSourceCount > 1) { out.push('<span class="ver">' + it.MediaSourceCount + ' VERSIONS</span>'); }
        return out.length ? '<div class="hf-badges">' + out.join('') + '</div>' : '';
    }
    function card(it, shape, onClick) {
        shape = shape || 'poster';
        var c = el('button', 'f hf-card' + (shape === 'wide' ? ' wide' : shape === 'square' ? ' square' : ''));
        var src = '';
        if (shape === 'wide') {
            if (it.Type === 'Episode' && it.ImageTags && it.ImageTags.Primary) { src = img(it.Id, 'Primary', { q: { maxWidth: 560 } }, it.ImageTags.Primary); }
            else if (it.ImageTags && it.ImageTags.Thumb) { src = img(it.Id, 'Thumb', { q: { maxWidth: 560 } }, it.ImageTags.Thumb); }
            else if (it.ParentThumbItemId) { src = img(it.ParentThumbItemId, 'Thumb', { q: { maxWidth: 560 } }, it.ParentThumbImageTag); }
            else if (it.BackdropImageTags && it.BackdropImageTags.length) { src = img(it.Id, 'Backdrop', { q: { maxWidth: 560 } }, it.BackdropImageTags[0]); }
            else if (it.ParentBackdropItemId) { src = img(it.ParentBackdropItemId, 'Backdrop', { q: { maxWidth: 560 } }, (it.ParentBackdropImageTags || [])[0]); }
            else if (it.ImageTags && it.ImageTags.Primary) { src = img(it.Id, 'Primary', { q: { maxWidth: 560 } }, it.ImageTags.Primary); }
        } else if (it.ImageTags && it.ImageTags.Primary) { src = img(it.Id, 'Primary', { q: { maxHeight: shape === 'square' ? 360 : 480 } }, it.ImageTags.Primary); }
        else if (it.SeriesPrimaryImageTag && it.SeriesId) { src = img(it.SeriesId, 'Primary', { q: { maxHeight: 480 } }, it.SeriesPrimaryImageTag); }
        var ud = it.UserData || {};
        var pct = ud.PlayedPercentage || (it.RunTimeTicks && ud.PlaybackPositionTicks ? ud.PlaybackPositionTicks / it.RunTimeTicks * 100 : 0);
        var name = it.Type === 'Episode' ? (it.SeriesName || it.Name) : it.Name;
        var sub = it.Type === 'Episode' ? (it.ParentIndexNumber != null ? 'S' + it.ParentIndexNumber + ':E' + it.IndexNumber + ' · ' : '') + it.Name : (it.ProductionYear || '');
        c.innerHTML = '<div class="img"' + (src ? ' style="background-image:url(\'' + esc(src) + '\')"' : '') + '>' + (src ? '' : '<div class="ph">' + esc(name) + '</div>') +
            (it.Type === 'CollectionFolder' || it.Type === 'UserView' ? (src ? '' : '<div class="lib-name">' + esc(it.Name) + '</div>') : badgesFor(it)) +
            (X.Badges !== false && X.BadgeRating !== false && it.CommunityRating && it.Type !== 'Episode' ? '<div class="hf-rating">★ ' + it.CommunityRating.toFixed(1) + '</div>' : '') +
            (ud.Played && it.Type !== 'Series' ? '<div class="hf-played">✓</div>' : '') +
            (pct > 0 && pct < 100 ? '<div class="hf-progress"><i style="width:' + pct.toFixed(1) + '%"></i></div>' : '') + '</div>' +
            (it.Type === 'CollectionFolder' || it.Type === 'UserView' ? '' : '<div class="cap"><b>' + esc(name) + '</b>' + esc(sub) + '</div>');
        c.onclick = onClick || function () { openItem(it); };
        return c;
    }
    function row(title, items, shape, onClick) {
        var r = el('div', 'hf-row');
        r.appendChild(el('h2', '', esc(title)));
        var t = el('div', 'hf-row-track');
        items.forEach(function (it) { t.appendChild(card(it, typeof shape === 'function' ? shape(it) : shape, onClick ? function () { onClick(it); } : null)); });
        r.appendChild(t);
        return r;
    }
    var FIELDS = 'PrimaryImageAspectRatio,DateCreated,MediaSourceCount,Width,Height,Overview,ProductionYear';
    function openItem(it) {
        if (it.Type === 'CollectionFolder' || it.Type === 'UserView') { show(libraryScreen(it)); return; }
        if (it.Type === 'BoxSet' || it.Type === 'Folder' || it.Type === 'Playlist') { show(libraryScreen(it)); return; }
        if (it.Type === 'Person') { show(libraryScreen({ Id: null, Name: it.Name, PersonId: it.Id })); return; }
        show(detailsScreen(it.Id));
    }

    // ================================================================== top bar
    function topBar(active) {
        var bar = el('div', 'hf-top');
        var logo = logoUrl(false);
        bar.innerHTML = logo ? '<img class="logo" src="' + esc(logo) + '" alt="">' : '<div class="logo-text">' + esc(siteName()) + '</div>';
        var nav = el('div', 'hf-nav');
        var add = function (label, key, fn) { var b = el('button', 'f' + (active === key ? ' active' : ''), esc(label)); b.onclick = fn; nav.appendChild(b); };
        add('Home', 'home', function () { if (active !== 'home') { replace(homeScreen()); } });
        add('Search', 'search', function () { show(searchScreen()); });
        (views || []).forEach(function (v) { if (/^(movies|tvshows|boxsets|homevideos|musicvideos|books|mixed|)$/.test(v.CollectionType || '')) { add(v.Name, v.Id, function () { show(libraryScreen(v)); }); } });
        bar.appendChild(nav);
        var me = el('button', 'f hf-avatar');
        if (auth && auth.ImageTag) { me.style.backgroundImage = 'url("' + url('Users/' + auth.UserId + '/Images/Primary', { tag: auth.ImageTag, maxHeight: 120 }) + '")'; } else { me.textContent = ((auth && auth.Name) || '?').charAt(0).toUpperCase(); }
        me.onclick = function () { show(settingsScreen()); };
        bar.appendChild(me);
        return bar;
    }

    // ================================================================== login
    function loginScreen() {
        var s = {};
        s.render = function (root) {
            setShade('login');
            setBackground((CFG.login || []).map(function (f) { return brandUrl('login', f); }), true);
            var split = THEME.LoginLayout !== 'center';
            var panel = el('div', 'hf-login' + (split ? '' : ' center'));
            var logo = logoUrl(true);
            panel.innerHTML = (logo ? '<img class="brand" src="' + esc(logo) + '" alt="">' : '<div class="brand-text">' + esc(siteName()) + '</div>') +
                (THEME.LoginMessage ? '<p class="msg">' + esc(THEME.LoginMessage) + '</p>' : '') + '<div class="body"></div>';
            root.appendChild(panel);
            var body = panel.querySelector('.body');
            return Promise.all([api('GET', 'Users/Public').catch(function () { return []; }), api('GET', 'QuickConnect/Enabled').catch(function () { return false; })]).then(function (r) {
                var users = r[0] || [], qc = r[1] === true;
                body.innerHTML = '<h2>' + (users.length ? 'Who’s watching?' : 'Sign in') + '</h2>';
                if (users.length) {
                    var g = el('div', 'hf-users');
                    users.forEach(function (u) {
                        var b = el('button', 'f hf-user', '<div class="img"' + (u.PrimaryImageTag ? ' style="background-image:url(\'' + esc(url('Users/' + u.Id + '/Images/Primary', { tag: u.PrimaryImageTag, maxHeight: 300 })) + '\')"' : '') + '>' + (u.PrimaryImageTag ? '' : esc(u.Name.charAt(0).toUpperCase())) + '</div><span>' + esc(u.Name) + '</span>');
                        b.onclick = function () { if (u.HasPassword) { show(passwordScreen(u.Name, false)); } else { doLogin(u.Name, ''); } };
                        g.appendChild(b);
                    });
                    body.appendChild(g);
                }
                var btns = el('div', 'hf-btns');
                var other = el('button', 'f hf-btn' + (users.length ? '' : ' autofocus'), users.length ? 'Someone else' : 'Enter user name');
                other.onclick = function () { show(passwordScreen('', true)); };
                btns.appendChild(other);
                if (qc) { var q = el('button', 'f hf-btn', 'Quick Connect'); q.onclick = function () { show(quickConnectScreen()); }; btns.appendChild(q); }
                if (canChangeServer()) { var cs = el('button', 'f hf-btn', 'Change server'); cs.onclick = changeServer; btns.appendChild(cs); }
                body.appendChild(btns);
            });
        };
        s.onRootBack = function () { return false; };
        return s;
    }
    function passwordScreen(name, askName) {
        return { render: function (root) {
            var panel = el('div', 'hf-login' + (THEME.LoginLayout === 'center' ? ' center' : ''));
            panel.innerHTML = '<h2>' + (askName ? 'Sign in' : esc(name)) + '</h2>' +
                (askName ? '<div class="hf-field"><label>User name</label><input class="f hf-input autofocus" id="hfUser" autocomplete="username"></div>' : '') +
                '<div class="hf-field"><label>Password</label><input class="f hf-input' + (askName ? '' : ' autofocus') + '" id="hfPass" type="password" autocomplete="current-password"></div>' +
                '<p class="hf-error" id="hfErr"></p><div class="hf-btns"><button class="f hf-btn primary" id="hfGo">Sign in</button></div>';
            root.appendChild(panel);
            var go = function () {
                var n = askName ? panel.querySelector('#hfUser').value.trim() : name;
                if (!n) { panel.querySelector('#hfErr').textContent = 'Type your user name.'; return; }
                doLogin(n, panel.querySelector('#hfPass').value, panel.querySelector('#hfErr'));
            };
            panel.querySelector('#hfGo').onclick = go;
            qsa('input', panel).forEach(function (i) { i.onenter = function () { if (i.id === 'hfUser') { setFocus(panel.querySelector('#hfPass')); } else { go(); } }; });
        } };
    }
    function quickConnectScreen() {
        var s = { timer: null };
        s.render = function (root) {
            var panel = el('div', 'hf-login' + (THEME.LoginLayout === 'center' ? ' center' : ''));
            panel.innerHTML = '<h2>Quick Connect</h2><p class="msg">On a phone or computer that’s signed in, open your profile → Quick Connect and enter this code:</p><div class="hf-code">…</div><p class="hf-error"></p><div class="hf-btns"><button class="f hf-btn">Cancel</button></div>';
            root.appendChild(panel);
            panel.querySelector('button').onclick = back;
            return api('POST', 'QuickConnect/Initiate').then(function (r) {
                panel.querySelector('.hf-code').textContent = r.Code;
                s.timer = setInterval(function () {
                    api('GET', 'QuickConnect/Connect', { secret: r.Secret }).then(function (st) {
                        if (st && st.Authenticated) {
                            clearInterval(s.timer);
                            api('POST', 'Users/AuthenticateWithQuickConnect', null, { Secret: r.Secret }).then(signedIn, function (e) { panel.querySelector('.hf-error').textContent = e.message; });
                        }
                    }, function () { /* keep waiting */ });
                }, 3000);
            });
        };
        s.destroy = function () { clearInterval(s.timer); };
        return s;
    }
    function doLogin(name, pw, errEl) {
        if (errEl) { errEl.textContent = 'Signing in…'; }
        api('POST', 'Users/AuthenticateByName', null, { Username: name, Pw: pw }).then(signedIn, function (e) {
            if (errEl) { errEl.textContent = e.status === 401 ? 'Wrong user name or password.' : 'Couldn’t sign in: ' + e.message.slice(0, 120); } else { toast('Couldn’t sign in'); show(passwordScreen(name, false)); }
        });
    }
    function signedIn(r) {
        auth = { UserId: r.User.Id, AccessToken: r.AccessToken, Name: r.User.Name, ImageTag: r.User.PrimaryImageTag };
        store('hf-auth-' + nid(SERVER), auth);
        startApp();
    }
    function signOut(expired) {
        if (auth) { api('POST', 'Sessions/Logout').catch(function () { /* ignore */ }); }
        auth = null; store('hf-auth-' + nid(SERVER), null);
        if (expired) { toast('Please sign in again'); }
        replace(loginScreen());
    }
    function canChangeServer() { return FRAMED || !!NATIVE || !!qs.home; }
    function changeServer() {
        if (FRAMED) { toWrapper({ action: 'changeServer' }); }
        else if (NATIVE && NATIVE.changeServer) { NATIVE.changeServer(); }
        else if (qs.home) { location.href = qs.home + (qs.home.indexOf('?') < 0 ? '?' : '&') + 'change=1'; }
    }

    // ================================================================== home
    var views = null, userCfg = null;
    function loadUser() {
        return Promise.all([api('GET', 'Users/' + uid()), api('GET', 'UserViews', { userId: uid() })]).then(function (r) {
            userCfg = (r[0] && r[0].Configuration) || {};
            auth.ImageTag = r[0] && r[0].PrimaryImageTag; auth.Name = r[0] && r[0].Name;
            var order = (userCfg.OrderedViews || []).map(nid);
            views = (r[1] && r[1].Items || []).slice().sort(function (a, b) { var ia = order.indexOf(nid(a.Id)), ib = order.indexOf(nid(b.Id)); return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib); });
        });
    }
    function spotlight(container) {
        if (X.Spotlight === false) { return Promise.resolve(); }
        var count = Math.min(20, Math.max(3, X.SpotlightCount || 8));
        var q = { userId: uid(), IncludeItemTypes: 'Movie,Series', Recursive: true, Limit: count * 2, ImageTypes: 'Backdrop', Fields: 'Overview,Genres,CommunityRating,OfficialRating,ProductionYear,RunTimeTicks,DateCreated,MediaSourceCount,Width,Height', EnableImageTypes: 'Backdrop,Logo,Primary' };
        if (X.SpotlightSource === 'random') { q.SortBy = 'Random'; } else if (X.SpotlightSource === 'unwatched') { q.SortBy = 'Random'; q.Filters = 'IsUnplayed'; } else if (X.SpotlightSource === 'favorites') { q.SortBy = 'Random'; q.Filters = 'IsFavorite'; } else { q.SortBy = 'DateCreated,SortName'; q.SortOrder = 'Descending'; }
        var libs = (X.SpotlightLibraryIds || []).map(nid).filter(Boolean);
        var load = libs.length ? Promise.all(libs.map(function (l) { return api('GET', 'Items', extend({}, q, { ParentId: l })).then(function (r) { return r.Items || []; }, function () { return []; }); })).then(function (ls) {
            var all = [].concat.apply([], ls);
            return q.SortBy === 'Random' ? all.sort(function () { return Math.random() - 0.5; }) : all.sort(function (a, b) { return (Date.parse(b.DateCreated) || 0) - (Date.parse(a.DateCreated) || 0); });
        }) : api('GET', 'Items', q).then(function (r) { return r.Items || []; });
        return load.then(function (items) {
            items = items.filter(function (i) { return i.BackdropImageTags && i.BackdropImageTags.length; }).slice(0, count);
            if (!items.length) { return; }
            var sp = el('div', 'hf-spot hf-section');
            var info = el('div', 'info'), dots = el('div', 'hf-dots');
            sp.appendChild(info); sp.appendChild(dots);
            container.appendChild(sp);
            var idx = -1, timer = null;
            function showIdx(i) {
                idx = (i + items.length) % items.length;
                var it = items[idx];
                var wasOn = current && sp.contains(current) ? (current.className.indexOf('more') >= 0 ? 1 : 0) : -1;
                setBackground([img(it.Id, 'Backdrop', { q: { maxWidth: 1920 } }, it.BackdropImageTags[0])], false);
                var meta = [it.ProductionYear, it.OfficialRating ? '<span class="hf-chip">' + esc(it.OfficialRating) + '</span>' : '', it.CommunityRating ? '★ ' + it.CommunityRating.toFixed(1) : '', it.RunTimeTicks ? runtime(it.RunTimeTicks) : '', (it.Genres || []).slice(0, 3).join(' · ')].filter(Boolean);
                info.innerHTML = (it.ImageTags && it.ImageTags.Logo ? '<img class="title-logo" src="' + esc(img(it.Id, 'Logo', { q: { maxWidth: 800 } }, it.ImageTags.Logo)) + '" alt="">' : '<h1>' + esc(it.Name) + '</h1>') +
                    '<div class="hf-meta">' + meta.map(function (m) { return '<span>' + m + '</span>'; }).join('') + '</div><p class="hf-overview">' + esc(it.Overview || '') + '</p><div class="hf-btns"></div>';
                var btns = info.querySelector('.hf-btns');
                var play = el('button', 'f hf-btn primary autofocus', '<span class="ico">▶</span>Play'); play.onclick = function () { playItem(it.Id); };
                var more = el('button', 'f hf-btn more', 'More info'); more.onclick = function () { openItem(it); };
                btns.appendChild(play); btns.appendChild(more);
                if (wasOn >= 0) { current = null; setFocus(wasOn ? more : play, true); }
                dots.innerHTML = items.map(function (_, n) { return '<i' + (n === idx ? ' class="on"' : '') + '></i>'; }).join('');
            }
            function schedule() { clearInterval(timer); timer = setInterval(function () { if (!player.on && !$overlay.classList.contains('on')) { showIdx(idx + 1); } }, Math.max(5, X.SpotlightSeconds || 9) * 1000); }
            showIdx(0); schedule();
            container.spotNav = function (dir) { showIdx(idx + (dir === 'right' ? 1 : -1)); schedule(); };
            container.spotStop = function () { clearInterval(timer); };
            container.spotStart = function () { showIdx(idx); schedule(); };
        });
    }
    function homeScreen() {
        var s = {};
        s.render = function (root) {
            setShade('home');
            root.appendChild(topBar('home'));
            var sc = el('div', 'hf-scroll'), inner = el('div', 'hf-scroll-inner');
            sc.appendChild(inner); root.appendChild(sc);
            s.inner = inner;
            var homeBgs = (CFG.home || []).map(function (f) { return brandUrl('home', f); });
            if (homeBgs.length) { setBackground(homeBgs, true); }
            return api('GET', 'DisplayPreferences/usersettings', { userId: uid(), client: 'emby' }).catch(function () { return {}; }).then(function (prefs) {
                var cp = (prefs && prefs.CustomPrefs) || {}, def = ['smalllibrarytiles', 'resume', 'resumeaudio', 'resumebook', 'livetv', 'nextup', 'latestmedia'];
                var sections = [];
                for (var i = 0; i < 10; i++) { sections.push(cp['homesection' + i] || def[i] || 'none'); }
                return spotlight(inner).then(function () {
                    announcement(inner);
                    var chain = Promise.resolve();
                    sections.forEach(function (sec) { chain = chain.then(function () { return homeSection(inner, sec); }).catch(function () { /* skip a broken row */ }); });
                    return chain;
                });
            }).then(function () {
                if (!inner.children.length) { inner.appendChild(el('div', 'hf-empty', 'Nothing here yet.')); }
            });
        };
        s.pause = function () { if (s.inner && s.inner.spotStop) { s.inner.spotStop(); } };
        s.resume = function () { setShade('home'); if (s.inner && s.inner.spotStart) { s.inner.spotStart(); } };
        s.destroy = s.pause;
        s.onRootBack = function () { if (current && !(current.closest && current.closest('.hf-spot,.hf-top'))) { var inner = s.inner; inner.setAttribute('data-y', '0'); inner.style.transform = ''; focusFirst(); return true; } return false; };
        return s;
    }
    function announcement(inner) {
        var list = [];
        if (THEME.Announcement) { list.push({ Text: THEME.Announcement, Style: THEME.AnnouncementStyle }); }
        (X.Announcements || []).forEach(function (a) { var n = Date.now(), st = a.Start ? Date.parse(a.Start) : NaN, en = a.End ? Date.parse(a.End) : NaN; if ((isNaN(st) || n >= st) && (isNaN(en) || n <= en)) { list.push(a); } });
        list.forEach(function (a) { inner.appendChild(el('div', 'hf-announce ' + esc(a.Style || 'info'), esc(a.Text))); });
    }
    function homeSection(inner, sec) {
        var add = function (r) { if (r) { inner.appendChild(r); } };
        if (sec === 'smalllibrarytiles' || sec === 'librarybuttons') {
            if (!views || !views.length) { return Promise.resolve(); }
            add(row('My Media', views, 'wide'));
            return Promise.resolve();
        }
        if (sec === 'resume') {
            return api('GET', 'UserItems/Resume', { userId: uid(), Limit: 16, Fields: FIELDS, MediaTypes: 'Video', EnableImageTypes: 'Primary,Backdrop,Thumb' }).then(function (r) { if (r.Items && r.Items.length) { add(row('Continue watching', r.Items, 'wide')); } });
        }
        if (sec === 'nextup') {
            return api('GET', 'Shows/NextUp', { userId: uid(), Limit: 16, Fields: FIELDS, EnableImageTypes: 'Primary,Backdrop,Thumb' }).then(function (r) { if (r.Items && r.Items.length) { add(row('Next up', r.Items, 'wide')); } });
        }
        if (sec === 'latestmedia') {
            var ex = (userCfg.LatestItemsExcludes || []).map(nid);
            var chain = Promise.resolve();
            (views || []).filter(function (v) { return ex.indexOf(nid(v.Id)) < 0 && /^(movies|tvshows|homevideos|musicvideos|books|mixed|)$/.test(v.CollectionType || ''); }).forEach(function (v) {
                chain = chain.then(function () {
                    return api('GET', 'Items/Latest', { userId: uid(), ParentId: v.Id, Limit: 16, Fields: FIELDS, EnableImageTypes: 'Primary,Backdrop,Thumb' }).then(function (items) {
                        if (items && items.length) { add(row('Recently added in ' + v.Name, items, v.CollectionType === 'homevideos' ? 'wide' : 'poster')); }
                    }, function () { /* skip */ });
                });
            });
            return chain;
        }
        return Promise.resolve();
    }

    // ================================================================== library grid
    var SORTS = [['SortName', 'Ascending', 'Name'], ['DateCreated', 'Descending', 'Recently added'], ['PremiereDate', 'Descending', 'Release date'], ['CommunityRating', 'Descending', 'Rating'], ['Random', 'Ascending', 'Random']];
    function libraryScreen(v) {
        var s = { start: 0, total: 0, loading: false, sort: 0 };
        s.render = function (root) {
            setShade('full');
            root.appendChild(topBar(v.Id));
            var sc = el('div', 'hf-scroll'), inner = el('div', 'hf-scroll-inner');
            sc.appendChild(inner); root.appendChild(sc);
            var head = el('div', 'hf-page-head', '<h1>' + esc(v.Name) + '</h1>');
            var sortBtn = el('button', 'f hf-btn', 'Sort: ' + SORTS[0][2]);
            sortBtn.onclick = function () { openMenu('Sort by', SORTS.map(function (x, i) { return { label: x[2], checked: i === s.sort }; }), function (_, i) { s.sort = i; sortBtn.textContent = 'Sort: ' + SORTS[i][2]; grid.innerHTML = ''; s.start = 0; more().then(function () { focusFirstIn(grid); }); }); };
            head.appendChild(sortBtn);
            inner.appendChild(head);
            var grid = el('div', 'hf-grid'); inner.appendChild(grid);
            var type = { movies: 'Movie', tvshows: 'Series', boxsets: 'BoxSet', books: 'Book,AudioBook', musicvideos: 'MusicVideo', homevideos: 'Video,PhotoAlbum,Photo' }[v.CollectionType || ''];
            var shape = v.CollectionType === 'homevideos' || v.CollectionType === 'musicvideos' ? 'wide' : 'poster';
            function more() {
                if (s.loading || (s.total && s.start >= s.total)) { return Promise.resolve(); }
                s.loading = true;
                var q = { userId: uid(), StartIndex: s.start, Limit: 60, Fields: FIELDS, SortBy: SORTS[s.sort][0] + (SORTS[s.sort][0] === 'SortName' ? '' : ',SortName'), SortOrder: SORTS[s.sort][1], EnableImageTypes: 'Primary,Backdrop,Thumb' };
                if (v.PersonId) { q.PersonIds = v.PersonId; q.Recursive = true; q.IncludeItemTypes = 'Movie,Series'; }
                else if (type) { q.ParentId = v.Id; q.Recursive = true; q.IncludeItemTypes = type; }
                else { q.ParentId = v.Id; }
                return api('GET', 'Items', q).then(function (r) {
                    s.loading = false; s.total = r.TotalRecordCount || 0;
                    (r.Items || []).forEach(function (it, i) {
                        var c = card(it, shape);
                        if (s.start === 0 && i === 0) { c.classList.add('autofocus'); }
                        if (s.start + i >= s.total - 20 || (i === (r.Items.length - 12))) { c.onfocusin2 = function () { more(); }; }
                        grid.appendChild(c);
                    });
                    s.start += (r.Items || []).length;
                    if (!s.total) { grid.appendChild(el('div', 'hf-empty', 'Nothing in this library.')); }
                }, function (e) { s.loading = false; throw e; });
            }
            return more();
        };
        s.resume = function () { setShade('full'); };
        return s;
    }
    function focusFirstIn(c) { var f = qsa('.f', c).filter(visible)[0]; if (f) { setFocus(f); } }

    // ================================================================== details
    function streamsInfo(it) {
        var ms = (it.MediaSources || [])[0] || {}, st = ms.MediaStreams || it.MediaStreams || [];
        var v = st.filter(function (x) { return x.Type === 'Video'; })[0] || {}, a = st.filter(function (x) { return x.Type === 'Audio'; });
        var out = [];
        if (v.Width >= 3200 || v.Height >= 1700) { out.push('<span class="hf-chip">4K</span>'); } else if (v.Height >= 700) { out.push('<span class="hf-chip">HD</span>'); }
        var range = (v.VideoRangeType || '') + ' ' + (v.VideoRange || '');
        if (/DOVI/i.test(range)) { out.push('<span class="hf-chip">Dolby Vision</span>'); } else if (/HDR|HLG/i.test(range)) { out.push('<span class="hf-chip">HDR</span>'); }
        if (a.some(function (x) { return /atmos/i.test((x.DisplayTitle || '') + (x.Profile || '')); })) { out.push('<span class="hf-chip">Atmos</span>'); }
        else if (a.some(function (x) { return x.Channels >= 6; })) { out.push('<span class="hf-chip">5.1</span>'); }
        return out.join('');
    }
    function detailsScreen(id) {
        var s = { choice: {} };
        s.render = function (root) {
            setShade('home');
            var sc = el('div', 'hf-scroll'), inner = el('div', 'hf-scroll-inner');
            sc.appendChild(inner); root.appendChild(sc);
            return api('GET', 'Items/' + id, { userId: uid(), Fields: 'Overview,Genres,Studios,People,MediaSources,MediaStreams,Taglines,ProviderIds,DateCreated,RemoteTrailers,ChildCount' }).then(function (it) {
                s.item = it;
                var bdId = it.BackdropImageTags && it.BackdropImageTags.length ? it.Id : it.ParentBackdropItemId, bdTag = it.BackdropImageTags && it.BackdropImageTags.length ? it.BackdropImageTags[0] : (it.ParentBackdropImageTags || [])[0];
                if (bdId) { setBackground([img(bdId, 'Backdrop', { q: { maxWidth: 1920 } }, bdTag)], false); }
                var top = el('div', 'hf-details hf-details-top');
                var logoId = it.ImageTags && it.ImageTags.Logo ? it.Id : it.ParentLogoItemId, logoTag = it.ImageTags && it.ImageTags.Logo ? it.ImageTags.Logo : it.ParentLogoImageTag;
                var title = it.Type === 'Episode' ? (it.SeriesName || '') : it.Name;
                var ud = it.UserData || {};
                var meta = [
                    it.Type === 'Episode' ? 'S' + it.ParentIndexNumber + ':E' + it.IndexNumber + ' · ' + esc(it.Name) : '',
                    it.ProductionYear, it.OfficialRating ? '<span class="hf-chip">' + esc(it.OfficialRating) + '</span>' : '',
                    it.CommunityRating ? '★ ' + it.CommunityRating.toFixed(1) : '',
                    it.RunTimeTicks ? runtime(it.RunTimeTicks) : '',
                    it.RunTimeTicks && it.Type !== 'Series' ? endsAt(it.RunTimeTicks - (ud.PlaybackPositionTicks || 0)) : '',
                    streamsInfo(it)
                ].filter(Boolean);
                top.innerHTML = (logoId && logoTag ? '<img class="title-logo" src="' + esc(img(logoId, 'Logo', { q: { maxWidth: 900 } }, logoTag)) + '" alt="">' : '<h1>' + esc(title) + '</h1>') +
                    (it.Taglines && it.Taglines[0] ? '<p class="hf-tagline">' + esc(it.Taglines[0]) + '</p>' : '') +
                    '<div class="hf-meta">' + meta.map(function (m) { return '<span>' + m + '</span>'; }).join('') + '</div>' +
                    '<p class="hf-overview">' + esc(it.Overview || '') + '</p>' +
                    '<p class="hf-facts">' + [(it.Genres || []).length ? '<b>Genres</b>' + esc(it.Genres.slice(0, 4).join(', ')) : '', (it.People || []).filter(function (p) { return p.Type === 'Director'; }).length ? '<b>Director</b>' + esc(it.People.filter(function (p) { return p.Type === 'Director'; }).map(function (p) { return p.Name; }).slice(0, 2).join(', ')) : '', (it.Studios || []).length ? '<b>Studio</b>' + esc(it.Studios[0].Name) : ''].filter(Boolean).join(' &nbsp; ') + '</p>' +
                    '<div class="hf-btns"></div>';
                inner.appendChild(top);
                var btns = top.querySelector('.hf-btns');
                var addBtn = function (html, fn, cls) { var b = el('button', 'f hf-btn' + (cls ? ' ' + cls : ''), html); b.onclick = fn; btns.appendChild(b); return b; };
                if (it.Type === 'Series') {
                    addBtn('<span class="ico">▶</span>Play', function () { playSeries(it); }, 'primary autofocus');
                } else if (it.MediaType === 'Video' || it.Type === 'Movie' || it.Type === 'Episode') {
                    var resumeAt = ud.PlaybackPositionTicks || 0;
                    addBtn('<span class="ico">▶</span>' + (resumeAt ? 'Resume from ' + ticksToTime(resumeAt) : 'Play'), function () { playItem(it.Id, { start: resumeAt, choice: s.choice }); }, 'primary autofocus');
                    if (resumeAt) { addBtn('Start over', function () { playItem(it.Id, { start: 0, choice: s.choice }); }); }
                    trackButtons(it, addBtn, s.choice);
                }
                var fav = addBtn(ud.IsFavorite ? '♥ Favorite' : '♡ Favorite', function () {
                    var on = !ud.IsFavorite;
                    api(on ? 'POST' : 'DELETE', 'UserFavoriteItems/' + it.Id, { userId: uid() }).then(function () { ud.IsFavorite = on; fav.innerHTML = on ? '♥ Favorite' : '♡ Favorite'; });
                });
                var watched = addBtn(ud.Played ? '✓ Watched' : 'Mark watched', function () {
                    var on = !ud.Played;
                    api(on ? 'POST' : 'DELETE', 'UserPlayedItems/' + it.Id, { userId: uid() }).then(function () { ud.Played = on; watched.innerHTML = on ? '✓ Watched' : 'Mark watched'; });
                });
                var tail = Promise.resolve();
                if (it.Type === 'Series') { tail = seasonsBlock(inner, it); }
                return tail.then(function () {
                    var cast = (it.People || []).filter(function (p) { return p.Type === 'Actor'; }).slice(0, 20);
                    if (cast.length) {
                        var r = el('div', 'hf-row hf-section', '<h2>Cast</h2>'), t = el('div', 'hf-row-track');
                        cast.forEach(function (p) {
                            var b = el('button', 'f hf-person', '<div class="img"' + (p.PrimaryImageTag ? ' style="background-image:url(\'' + esc(img(p.Id, 'Primary', { q: { maxHeight: 300 } }, p.PrimaryImageTag)) + '\')"' : '') + '></div><b>' + esc(p.Name) + '</b><span>' + esc(p.Role || '') + '</span>');
                            b.onclick = function () { show(libraryScreen({ Name: p.Name, PersonId: p.Id })); };
                            t.appendChild(b);
                        });
                        r.appendChild(t); inner.appendChild(r);
                    }
                    if (it.Type === 'Movie' || it.Type === 'Series') {
                        return api('GET', 'Items/' + it.Id + '/Similar', { userId: uid(), Limit: 16, Fields: FIELDS }).then(function (r) { if (r.Items && r.Items.length) { var rr = row('More like this', r.Items, 'poster'); rr.classList.add('hf-section'); inner.appendChild(rr); } }, function () { /* none */ });
                    }
                });
            });
        };
        s.resume = function () { setShade('home'); };
        return s;
    }
    function trackButtons(it, addBtn, choice) {
        var sources = it.MediaSources || [];
        if (sources.length > 1) {
            var vb = addBtn('Version: ' + esc(sources[0].Name || '1'), function () {
                openMenu('Version', sources.map(function (m, i) { return { label: m.Name || ('Version ' + (i + 1)), checked: (choice.source || sources[0].Id) === m.Id }; }), function (_, i) { choice.source = sources[i].Id; choice.audio = choice.sub = undefined; vb.innerHTML = 'Version: ' + esc(sources[i].Name || i + 1); });
            });
        }
        var streams = function () { var ms = sources.filter(function (m) { return m.Id === choice.source; })[0] || sources[0] || {}; return ms.MediaStreams || []; };
        var audio = streams().filter(function (x) { return x.Type === 'Audio'; }), subs = streams().filter(function (x) { return x.Type === 'Subtitle'; });
        if (audio.length > 1) {
            var ab = addBtn('Audio', function () {
                var a = streams().filter(function (x) { return x.Type === 'Audio'; });
                openMenu('Audio', a.map(function (x) { return { label: x.DisplayTitle || x.Language || ('Track ' + x.Index), checked: choice.audio === x.Index || (choice.audio == null && x.IsDefault) }; }), function (_, i) { choice.audio = a[i].Index; });
            });
        }
        if (subs.length) {
            addBtn('Subtitles', function () {
                var sl = streams().filter(function (x) { return x.Type === 'Subtitle'; });
                openMenu('Subtitles', [{ label: 'Off', checked: choice.sub === -1 }].concat(sl.map(function (x) { return { label: x.DisplayTitle || x.Language || ('Track ' + x.Index), checked: choice.sub === x.Index }; })), function (_, i) { choice.sub = i === 0 ? -1 : sl[i - 1].Index; });
            });
        }
    }
    function seasonsBlock(inner, series) {
        return api('GET', 'Shows/' + series.Id + '/Seasons', { userId: uid(), Fields: 'ChildCount' }).then(function (r) {
            var seasons = r.Items || [];
            if (!seasons.length) { return; }
            var block = el('div', 'hf-row hf-section');
            var tabs = el('div', 'hf-tabs'), eps = el('div', 'hf-row-track');
            block.appendChild(tabs); block.appendChild(eps);
            inner.appendChild(block);
            var pick = function (i) {
                qsa('.hf-tab', tabs).forEach(function (t, n) { t.classList.toggle('active', n === i); });
                eps.innerHTML = '<div class="hf-empty">Loading…</div>';
                return api('GET', 'Shows/' + series.Id + '/Episodes', { userId: uid(), SeasonId: seasons[i].Id, Fields: 'Overview,MediaSourceCount' }).then(function (er) {
                    eps.innerHTML = '';
                    (er.Items || []).forEach(function (ep) {
                        var ud = ep.UserData || {}, pct = ud.PlayedPercentage || 0;
                        var b = el('button', 'f hf-ep', '<div class="img"' + (ep.ImageTags && ep.ImageTags.Primary ? ' style="background-image:url(\'' + esc(img(ep.Id, 'Primary', { q: { maxWidth: 640 } }, ep.ImageTags.Primary)) + '\')"' : '') + '>' +
                            (ud.Played ? '<div class="hf-played">✓</div>' : '') + (pct > 0 && pct < 100 ? '<div class="hf-progress"><i style="width:' + pct + '%"></i></div>' : '') + '</div>' +
                            '<h3>' + (ep.IndexNumber != null ? ep.IndexNumber + '. ' : '') + esc(ep.Name) + '</h3><p>' + esc(ep.Overview || '') + '</p>');
                        b.onclick = function () { show(detailsScreen(ep.Id)); };
                        eps.appendChild(b);
                    });
                    if (!eps.children.length) { eps.innerHTML = '<div class="hf-empty">No episodes.</div>'; }
                });
            };
            seasons.forEach(function (se, i) { var t = el('button', 'f hf-tab', esc(se.Name)); t.onclick = function () { pick(i); }; tabs.appendChild(t); });
            var start = 0; seasons.forEach(function (se, i) { if (se.UserData && !se.UserData.Played && start === 0 && i > 0 && seasons[i - 1].UserData && seasons[i - 1].UserData.Played) { start = i; } });
            return pick(start);
        });
    }
    function playSeries(series) {
        api('GET', 'Shows/NextUp', { userId: uid(), SeriesId: series.Id, Limit: 1 }).then(function (r) {
            var ep = r.Items && r.Items[0];
            if (ep) { playItem(ep.Id, { start: (ep.UserData || {}).PlaybackPositionTicks || 0 }); return; }
            return api('GET', 'Shows/' + series.Id + '/Episodes', { userId: uid(), Limit: 1 }).then(function (er) { if (er.Items && er.Items[0]) { playItem(er.Items[0].Id); } });
        });
    }

    // ================================================================== search
    function searchScreen() {
        var s = {};
        s.render = function (root) {
            setShade('full');
            root.appendChild(topBar('search'));
            var sc = el('div', 'hf-scroll'), inner = el('div', 'hf-scroll-inner');
            sc.appendChild(inner); root.appendChild(sc);
            var box = el('div', 'hf-search hf-details-top', '<input class="f hf-input autofocus" placeholder="Search movies, shows, people…">');
            inner.appendChild(box);
            var results = el('div'); inner.appendChild(results);
            var input = box.querySelector('input'), t = null, seq = 0;
            var run = function () {
                var term = input.value.trim(), my = ++seq;
                if (term.length < 2) { results.innerHTML = ''; return; }
                api('GET', 'Items', { userId: uid(), searchTerm: term, Recursive: true, IncludeItemTypes: 'Movie,Series,Episode,BoxSet', Limit: 60, Fields: FIELDS, EnableImageTypes: 'Primary,Backdrop,Thumb' }).then(function (r) {
                    if (my !== seq) { return; }
                    results.innerHTML = '';
                    var items = r.Items || [];
                    var groups = [['Movies', 'Movie', 'poster'], ['Shows', 'Series', 'poster'], ['Collections', 'BoxSet', 'poster'], ['Episodes', 'Episode', 'wide']];
                    groups.forEach(function (g) { var list = items.filter(function (i) { return i.Type === g[1]; }); if (list.length) { results.appendChild(row(g[0], list, g[2])); } });
                    if (!items.length) { results.appendChild(el('div', 'hf-empty', 'No results for “' + esc(term) + '”.')); }
                });
            };
            input.addEventListener('input', function () { clearTimeout(t); t = setTimeout(run, 400); });
            input.onenter = function () { run(); input.blur(); setTimeout(function () { var f = qsa('.hf-card', results)[0]; if (f) { setFocus(f); } }, 500); };
        };
        s.resume = function () { setShade('full'); };
        return s;
    }

    // ================================================================== settings
    var prefs = extend({ maxBitrate: 120000000, subtitles: true }, store('hf-prefs') || {});
    function savePrefs() { store('hf-prefs', prefs); }
    function settingsScreen() {
        var s = {};
        s.render = function (root) {
            setShade('full');
            root.appendChild(topBar('settings'));
            var sc = el('div', 'hf-scroll'), inner = el('div', 'hf-scroll-inner');
            sc.appendChild(inner); root.appendChild(sc);
            inner.appendChild(el('div', 'hf-page-head', '<h1>Settings</h1>'));
            var list = el('div', 'hf-list'); inner.appendChild(list);
            var item = function (label, note, fn) { var b = el('button', 'f hf-item', '<span>' + esc(label) + '</span><em>' + esc(note || '') + '</em>'); b.onclick = fn; list.appendChild(b); return b; };
            var rates = [[120000000, 'Maximum'], [60000000, '60 Mbps'], [40000000, '40 Mbps (4K)'], [20000000, '20 Mbps'], [10000000, '10 Mbps (1080p)'], [4000000, '4 Mbps (720p)'], [1500000, '1.5 Mbps']];
            var rateName = function () { var m = rates.filter(function (r) { return r[0] === prefs.maxBitrate; })[0]; return m ? m[1] : 'Maximum'; };
            var q = item('Streaming quality', rateName(), function () { openMenu('Streaming quality', rates.map(function (r) { return { label: r[1], checked: r[0] === prefs.maxBitrate }; }), function (_, i) { prefs.maxBitrate = rates[i][0]; savePrefs(); q.querySelector('em').textContent = rateName(); }); });
            var sb = item('Subtitles', prefs.subtitles ? 'Show when the language differs' : 'Off unless chosen', function () { prefs.subtitles = !prefs.subtitles; savePrefs(); sb.querySelector('em').textContent = prefs.subtitles ? 'Show when the language differs' : 'Off unless chosen'; });
            item('Switch user', auth && auth.Name, function () { signOut(false); });
            if (canChangeServer()) { item('Change server', SERVER.replace(/^https?:\/\//, ''), changeServer); }
            item('About', 'HallFlix TV ' + VERSION + ' · ' + DEVICE_NAME + (CFG.version ? ' · Artwork Studio ' + CFG.version : ''), function () { });
        };
        s.resume = function () { setShade('full'); };
        return s;
    }

    // ================================================================== playback
    function deviceProfile() {
        var vcodecs = PLATFORM === 'android' ? 'h264,hevc,vp9,av1,mpeg4,mpeg2video' : PLATFORM === 'webos' || PLATFORM === 'tizen' ? 'h264,hevc,vp9,av1' : 'h264,vp9,av1';
        var acodecs = PLATFORM === 'android' ? 'aac,mp3,ac3,eac3,flac,opus,vorbis,alac,dts,truehd' : PLATFORM === 'webos' || PLATFORM === 'tizen' ? 'aac,mp3,ac3,eac3,flac,opus,vorbis' : 'aac,mp3,flac,opus,vorbis';
        var containers = PLATFORM === 'browser' ? 'mp4,m4v,webm' : 'mp4,m4v,mkv,mov,webm,ts,m2ts,avi';
        var hlsVideo = PLATFORM === 'browser' ? 'h264' : 'h264,hevc';
        return {
            Name: 'HallFlix TV (' + PLATFORM + ')',
            MaxStreamingBitrate: prefs.maxBitrate, MaxStaticBitrate: 200000000, MusicStreamingTranscodingBitrate: 384000,
            DirectPlayProfiles: [{ Container: containers, Type: 'Video', VideoCodec: vcodecs, AudioCodec: acodecs }, { Container: 'mp3,aac,flac,m4a,ogg,opus,wav', Type: 'Audio' }],
            TranscodingProfiles: [
                { Container: 'ts', Type: 'Video', AudioCodec: PLATFORM === 'browser' ? 'aac' : 'aac,ac3,eac3', VideoCodec: hlsVideo, Context: 'Streaming', Protocol: 'hls', MaxAudioChannels: '6', MinSegments: 1, BreakOnNonKeyFrames: true },
                { Container: 'mp3', Type: 'Audio', AudioCodec: 'mp3', Context: 'Streaming', Protocol: 'http' }
            ],
            ContainerProfiles: [], CodecProfiles: [],
            SubtitleProfiles: [{ Format: 'vtt', Method: 'External' }, { Format: 'srt', Method: 'External' }, { Format: 'ass', Method: 'External' }, { Format: 'ssa', Method: 'External' }, { Format: 'subrip', Method: 'External' }, { Format: 'pgssub', Method: 'Encode' }, { Format: 'dvdsub', Method: 'Encode' }, { Format: 'dvbsub', Method: 'Encode' }]
        };
    }
    function pickSubtitle(ms, choice) {
        if (choice && choice.sub != null) { return choice.sub; }
        if (!prefs.subtitles) { return -1; }
        var st = ms.MediaStreams || [], subs = st.filter(function (x) { return x.Type === 'Subtitle'; });
        var forced = subs.filter(function (x) { return x.IsForced; })[0];
        if (forced) { return forced.Index; }
        var def = subs.filter(function (x) { return x.IsDefault; })[0];
        return def ? def.Index : -1;
    }
    function getStream(itemId, opts) {
        opts = opts || {};
        var choice = opts.choice || {};
        var body = { UserId: uid(), DeviceProfile: deviceProfile(), MaxStreamingBitrate: prefs.maxBitrate, StartTimeTicks: opts.start || 0, AutoOpenLiveStream: true, EnableDirectPlay: true, EnableDirectStream: true, EnableTranscoding: true, AllowVideoStreamCopy: true, AllowAudioStreamCopy: true };
        if (choice.source) { body.MediaSourceId = choice.source; }
        if (choice.audio != null) { body.AudioStreamIndex = choice.audio; }
        if (choice.sub != null) { body.SubtitleStreamIndex = choice.sub; }
        return api('POST', 'Items/' + itemId + '/PlaybackInfo', { userId: uid() }, body).then(function (info) {
            var ms = (info.MediaSources || [])[0];
            if (!ms) { throw new Error(info.ErrorCode || 'This title can’t be played'); }
            var subIndex = choice.sub != null ? choice.sub : pickSubtitle(ms, choice);
            var direct = ms.SupportsDirectPlay || ms.SupportsDirectStream;
            var src, method;
            if (direct && !(subIndex >= 0 && (ms.MediaStreams || []).some(function (x) { return x.Index === subIndex && x.DeliveryMethod === 'Encode'; }))) {
                method = ms.SupportsDirectPlay ? 'DirectPlay' : 'DirectStream';
                src = url('Videos/' + itemId + '/stream' + (ms.Container ? '.' + ms.Container.split(',')[0] : ''), { Static: true, MediaSourceId: ms.Id, PlaySessionId: info.PlaySessionId, DeviceId: DEVICE_ID, ApiKey: auth.AccessToken, Tag: ms.ETag });
            } else if (ms.TranscodingUrl) {
                method = 'Transcode';
                src = SERVER + ms.TranscodingUrl + (/[?&]api_?key=/i.test(ms.TranscodingUrl) ? '' : '&ApiKey=' + auth.AccessToken);
            } else { throw new Error('No way to play this title on this TV'); }
            var subs = (ms.MediaStreams || []).filter(function (x) { return x.Type === 'Subtitle' && (x.DeliveryMethod === 'External' || x.IsExternal || x.IsTextSubtitleStream); }).map(function (x) {
                return { index: x.Index, label: x.DisplayTitle || x.Language || 'Subtitles', lang: x.Language || '', url: url('Videos/' + itemId + '/' + ms.Id + '/Subtitles/' + x.Index + '/0/Stream.vtt', { ApiKey: auth.AccessToken }) };
            });
            return { itemId: itemId, src: src, method: method, mediaSourceId: ms.Id, playSessionId: info.PlaySessionId, subs: subs, subIndex: subIndex, audioIndex: choice.audio != null ? choice.audio : ms.DefaultAudioStreamIndex, ms: ms, start: opts.start || 0, isHls: /\.m3u8/i.test(src) };
        });
    }
    function introsFor(itemId) {
        return api('GET', 'Items/' + itemId + '/Intros', { userId: uid() }).then(function (r) { return (r && r.Items) || []; }, function () { return []; });
    }
    function playItem(itemId, opts) {
        opts = opts || {};
        player.open();
        var item;
        api('GET', 'Items/' + itemId, { userId: uid() }).then(function (it) {
            item = it;
            // pre-rolls (Pre-Roll Videos plugin) only before a fresh start
            return (opts.start ? Promise.resolve([]) : introsFor(itemId));
        }).then(function (intros) {
            return Promise.all(intros.map(function (i) { return getStream(i.Id, {}).then(function (st) { st.intro = true; st.item = i; return st; }, function () { return null; }); })).then(function (list) {
                return getStream(itemId, opts).then(function (main) { main.item = item; return list.filter(Boolean).concat([main]); });
            });
        }).then(function (queue) { player.start(queue); }, function (e) { player.close(); toast(e.message.slice(0, 140)); });
    }

    var player = {
        on: false, queue: [], idx: 0, video: null, el: null, osdTimer: null, progTimer: null, hls: null, cur: null, upNext: null,
        open: function () {
            if (!this.el) { this.build(); }
            this.on = true; this.el.classList.add('on'); this.spin(true);
            if (stack.length) { var t = stack[stack.length - 1]; if (t.pause) { t.pause(); } }
            setBackground([], false);
        },
        build: function () {
            var p = this.el = el('div', '', '<video playsinline></video><div class="hf-spinner hf-player-spin"></div><div class="hf-osd"><div class="top"><span class="hf-tag" style="display:none">PRE-ROLL</span><h2></h2><p></p></div>' +
                '<div class="bottom"><div class="f hf-bar"><div class="buf"></div><div class="pos"></div><div class="knob"></div></div><div class="hf-times"><span class="t-pos">0:00</span><span class="t-end"></span><span class="t-dur">0:00</span></div>' +
                '<div class="ctrls hf-btns"></div></div></div><div class="hf-upnext"><div class="img"></div><b></b><p style="color:var(--muted);margin:.4em 0 1em"></p><div class="hf-btns"></div></div>');
            p.id = 'hfPlayer'; document.body.appendChild(p);
            this.video = p.querySelector('video');
            var self = this, v = this.video;
            v.addEventListener('playing', function () { self.spin(false); });
            v.addEventListener('waiting', function () { self.spin(true); });
            v.addEventListener('timeupdate', function () { self.updateBar(); });
            v.addEventListener('ended', function () { self.next(); });
            v.addEventListener('error', function () { if (self.on && self.cur) { self.fail(); } });
            var ctrls = p.querySelector('.ctrls');
            var b = function (html, fn, cls) { var x = el('button', 'f hf-btn' + (cls ? ' ' + cls : ''), html); x.onclick = fn; ctrls.appendChild(x); return x; };
            b('⏪ 10', function () { self.seekBy(-10); });
            this.ppBtn = b('⏸ Pause', function () { self.toggle(); }, 'autofocus');
            b('30 ⏩', function () { self.seekBy(30); });
            this.audioBtn = b('Audio', function () { self.chooseAudio(); });
            this.subBtn = b('Subtitles', function () { self.chooseSubs(); });
            this.skipBtn = b('Skip pre-roll ⏭', function () { self.next(); });
            this.nextBtn = b('Next episode ⏭', function () { self.playNext(); });
            p.querySelector('.hf-bar').onclick = function () { self.toggle(); };
        },
        spin: function (on) { if (this.el) { this.el.querySelector('.hf-player-spin').classList.toggle('on', on); } },
        start: function (queue) { this.queue = queue; this.idx = 0; this.playCurrent(); },
        playCurrent: function () {
            var self = this, st = this.cur = this.queue[this.idx];
            if (!st) { this.stop(false); return; }
            var it = st.item || {};
            this.el.querySelector('.hf-tag').style.display = st.intro ? '' : 'none';
            this.el.querySelector('h2').textContent = st.intro ? (it.Name || 'Pre-roll') : (it.Type === 'Episode' ? it.SeriesName : it.Name);
            this.el.querySelector('.top p').textContent = st.intro ? 'Your movie starts in a moment' : (it.Type === 'Episode' ? 'S' + it.ParentIndexNumber + ':E' + it.IndexNumber + ' · ' + it.Name : (it.ProductionYear || ''));
            this.skipBtn.style.display = st.intro ? '' : 'none';
            this.nextBtn.style.display = !st.intro && it.Type === 'Episode' ? '' : 'none';
            var audio = (st.ms.MediaStreams || []).filter(function (x) { return x.Type === 'Audio'; });
            this.audioBtn.style.display = !st.intro && audio.length > 1 ? '' : 'none';
            this.subBtn.style.display = !st.intro && (st.ms.MediaStreams || []).some(function (x) { return x.Type === 'Subtitle'; }) ? '' : 'none';
            this.el.querySelector('.hf-upnext').classList.remove('on'); this.upNext = null;
            if (NATIVE) { this.playNative(); return; }
            this.cleanup();
            var v = this.video;
            if (st.isHls && !(v.canPlayType('application/vnd.apple.mpegurl')) && window.Hls === undefined) {
                // load hls.js on demand (desktop browsers; TVs play HLS themselves)
                var sc = document.createElement('script'); sc.src = 'hls.min.js'; sc.onload = function () { self.playCurrent(); }; sc.onerror = function () { self.fail(); }; document.body.appendChild(sc); return;
            }
            if (st.isHls && window.Hls && Hls.isSupported() && !v.canPlayType('application/vnd.apple.mpegurl')) {
                this.hls = new Hls({ startPosition: st.method === 'Transcode' ? 0 : st.start / 1e7 });
                this.hls.loadSource(st.src); this.hls.attachMedia(v);
                this.hls.on(Hls.Events.ERROR, function (_, d) { if (d.fatal) { self.fail(); } });
            } else {
                v.src = st.src + (st.method !== 'Transcode' && st.start ? '#t=' + (st.start / 1e7) : '');
            }
            st.offset = st.method === 'Transcode' ? st.start / 1e7 : 0;   // transcodes start at the resume point
            qsa('track', v).forEach(function (t) { t.remove(); });
            st.subs.forEach(function (s) { var t = document.createElement('track'); t.kind = 'subtitles'; t.label = s.label; t.srclang = s.lang; t.src = s.url; t.setAttribute('data-index', s.index); v.appendChild(t); });
            var applySubs = function () { for (var i = 0; i < v.textTracks.length; i++) { v.textTracks[i].mode = String(st.subs[i] && st.subs[i].index) === String(st.subIndex) ? 'showing' : 'hidden'; } };
            v.addEventListener('loadedmetadata', function once() { v.removeEventListener('loadedmetadata', once); if (st.method !== 'Transcode' && st.start && Math.abs(v.currentTime - st.start / 1e7) > 3) { try { v.currentTime = st.start / 1e7; } catch (e) { /* ignore */ } } applySubs(); });
            var pr = v.play(); if (pr && pr.catch) { pr.catch(function () { /* autoplay blocked: OSD shows */ self.showOsd(); }); }
            this.report('Playing');
            clearInterval(this.progTimer); this.progTimer = setInterval(function () { self.report('Playing/Progress'); }, 10000);
            this.showOsd();
        },
        // Android: the app's own player (ExoPlayer) plays the queue and reports back through nativeEvent()
        playNative: function () {
            var st = this.cur;
            this.spin(false);
            NATIVE.play(JSON.stringify({ url: st.src, title: this.el.querySelector('h2').textContent, subtitle: this.el.querySelector('.top p').textContent, startMs: st.method === 'Transcode' ? 0 : Math.round(st.start / 1e4), offsetMs: st.method === 'Transcode' ? Math.round(st.start / 1e4) : 0, subs: st.subs, subIndex: st.subIndex, intro: !!st.intro }));
            this.report('Playing');
        },
        nativeEvent: function (name, data) {
            var d = typeof data === 'string' ? JSON.parse(data || '{}') : (data || {});
            if (!this.cur) { return; }
            this.nativePos = (d.positionMs || 0) * 1e4 + (this.cur.method === 'Transcode' ? this.cur.start : 0);
            this.nativePaused = !!d.paused;
            if (name === 'progress') { this.report('Playing/Progress'); }
            else if (name === 'ended') { this.next(); }
            else if (name === 'stopped') { this.stop('native'); }
            else if (name === 'error') { this.fail(); }
        },
        posTicks: function () { if (NATIVE) { return this.nativePos || 0; } var st = this.cur || {}; return Math.round(((this.video.currentTime || 0) + (st.offset || 0)) * 1e7); },
        report: function (what) {
            var st = this.cur; if (!st || st.intro) { return; }
            api('POST', 'Sessions/' + what, null, { ItemId: st.itemId, MediaSourceId: st.mediaSourceId, PlaySessionId: st.playSessionId, PositionTicks: this.posTicks(), IsPaused: NATIVE ? !!this.nativePaused : this.video.paused, PlayMethod: st.method, AudioStreamIndex: st.audioIndex, SubtitleStreamIndex: st.subIndex, CanSeek: true }).catch(function () { /* ignore */ });
        },
        updateBar: function () {
            var st = this.cur; if (!st) { return; }
            var dur = (st.item && st.item.RunTimeTicks ? st.item.RunTimeTicks / 1e7 : this.video.duration) || 0, pos = this.posTicks() / 1e7;
            var bar = this.el.querySelector('.hf-bar'), pct = dur ? Math.min(100, pos / dur * 100) : 0;
            bar.querySelector('.pos').style.width = pct + '%'; bar.querySelector('.knob').style.left = pct + '%';
            try { var b = this.video.buffered; if (b.length) { bar.querySelector('.buf').style.width = Math.min(100, ((b.end(b.length - 1) + (st.offset || 0)) / dur) * 100) + '%'; } } catch (e) { /* ignore */ }
            this.el.querySelector('.t-pos').textContent = ticksToTime(pos * 1e7);
            this.el.querySelector('.t-dur').textContent = ticksToTime(dur * 1e7);
            this.el.querySelector('.t-end').textContent = dur ? endsAt((dur - pos) * 1e7) : '';
            this.ppBtn.innerHTML = this.video.paused ? '▶ Play' : '⏸ Pause';
            // "Up next" card 30 seconds before the end of an episode
            if (!st.intro && st.item && st.item.Type === 'Episode' && dur && dur - pos < 30 && !this.upNext) { this.prepareNext(true); }
        },
        showOsd: function () {
            var o = this.el.querySelector('.hf-osd'), self = this;
            o.classList.add('on');
            if (!current || !this.el.contains(current)) { current = null; setFocus(this.ppBtn, true); }
            clearTimeout(this.osdTimer); this.osdTimer = setTimeout(function () { if (!self.video.paused && !$overlay.classList.contains('on')) { o.classList.remove('on'); } }, 5000);
        },
        osdOn: function () { return this.el.querySelector('.hf-osd').classList.contains('on'); },
        key: function (e) {
            var k = e.keyCode;
            if ($overlay.classList.contains('on')) { return false; }
            if (isKey(e, KEY.BACK)) { if (this.osdOn() && !this.video.paused) { this.el.querySelector('.hf-osd').classList.remove('on'); return true; } this.stop(true); return true; }
            if (isKey(e, KEY.PLAY) || isKey(e, KEY.PAUSE)) { this.toggle(); this.showOsd(); return true; }
            if (isKey(e, KEY.STOP)) { this.stop(true); return true; }
            if (isKey(e, KEY.FF)) { this.seekBy(30); return true; }
            if (isKey(e, KEY.RW)) { this.seekBy(-10); return true; }
            if (!this.osdOn()) {
                if (k === KEY.LEFT) { this.seekBy(-10); return true; }
                if (k === KEY.RIGHT) { this.seekBy(30); return true; }
                if (k === KEY.ENTER || k === KEY.UP || k === KEY.DOWN) { this.showOsd(); return true; }
                return true;
            }
            this.showOsd();
            if (current && current.classList.contains('hf-bar') && (k === KEY.LEFT || k === KEY.RIGHT)) { this.seekBy(k === KEY.LEFT ? -10 : 30); return true; }
            return false;   // D-pad moves between controls
        },
        toggle: function () { var v = this.video; if (v.paused) { var p = v.play(); if (p && p.catch) { p.catch(function () { }); } } else { v.pause(); } this.report('Playing/Progress'); this.updateBar(); },
        seekBy: function (sec) {
            var st = this.cur, v = this.video; if (!st) { return; }
            if (st.method === 'Transcode') {
                // a transcode can only jump by asking the server for a new stream at that point
                var target = Math.max(0, this.posTicks() + sec * 1e7), self = this;
                clearTimeout(this.seekT); this.pendingSeek = target;
                this.spin(true);
                this.seekT = setTimeout(function () { self.restartAt(self.pendingSeek, {}); }, 700);
                return;
            }
            v.currentTime = Math.max(0, Math.min((v.duration || 1e9) - 1, v.currentTime + sec));
            this.showOsd(); this.updateBar();
        },
        restartAt: function (ticks, change) {
            var st = this.cur, self = this;
            var choice = extend({ source: st.mediaSourceId, audio: st.audioIndex, sub: st.subIndex }, change);
            api('POST', 'Sessions/Playing/Stopped', null, { ItemId: st.itemId, MediaSourceId: st.mediaSourceId, PlaySessionId: st.playSessionId, PositionTicks: this.posTicks() }).catch(function () { });
            getStream(st.itemId, { start: ticks, choice: choice }).then(function (ns) { ns.item = st.item; self.queue[self.idx] = ns; self.playCurrent(); }, function (e) { toast(e.message); });
        },
        chooseAudio: function () {
            var st = this.cur, self = this, a = (st.ms.MediaStreams || []).filter(function (x) { return x.Type === 'Audio'; });
            openMenu('Audio', a.map(function (x) { return { label: x.DisplayTitle || x.Language || 'Track ' + x.Index, checked: x.Index === st.audioIndex }; }), function (_, i) { if (a[i].Index !== st.audioIndex) { self.restartAt(self.posTicks(), { audio: a[i].Index }); } });
        },
        chooseSubs: function () {
            var st = this.cur, self = this, sl = (st.ms.MediaStreams || []).filter(function (x) { return x.Type === 'Subtitle'; });
            openMenu('Subtitles', [{ label: 'Off', checked: st.subIndex < 0 }].concat(sl.map(function (x) { return { label: x.DisplayTitle || x.Language || 'Track ' + x.Index, checked: x.Index === st.subIndex }; })), function (_, i) {
                var idx = i === 0 ? -1 : sl[i - 1].Index;
                var external = st.subs.some(function (s) { return s.index === idx; });
                if (NATIVE || !(idx < 0 || external)) { self.restartAt(self.posTicks(), { sub: idx }); return; }
                st.subIndex = idx;
                var v = self.video; for (var n = 0; n < v.textTracks.length; n++) { v.textTracks[n].mode = st.subs[n] && st.subs[n].index === idx ? 'showing' : 'hidden'; }
                self.report('Playing/Progress');
            });
        },
        next: function () {
            var st = this.cur;
            if (st && !st.intro) { this.report('Playing/Stopped'); }
            if (this.idx < this.queue.length - 1) { this.idx++; this.playCurrent(); return; }
            if (st && st.item && st.item.Type === 'Episode') { this.prepareNext(false); return; }
            this.stop(false);
        },
        prepareNext: function (early) {
            var st = this.cur, self = this;
            this.upNext = 'loading';
            api('GET', 'Shows/NextUp', { userId: uid(), SeriesId: st.item.SeriesId, Limit: 1, EnableResumable: false, DisableFirstEpisode: true }).then(function (r) {
                var ep = r.Items && r.Items[0];
                if (!ep || ep.Id === st.itemId) { self.upNext = 'none'; if (!early) { self.stop(false); } return; }
                self.upNext = ep;
                if (NATIVE) { if (!early) { self.playNext(); } return; }   // the Android player goes straight on
                var box = self.el.querySelector('.hf-upnext');
                box.querySelector('.img').style.backgroundImage = ep.ImageTags && ep.ImageTags.Primary ? 'url("' + img(ep.Id, 'Primary', { q: { maxWidth: 640 } }, ep.ImageTags.Primary) + '")' : '';
                box.querySelector('b').textContent = 'Up next: S' + ep.ParentIndexNumber + ':E' + ep.IndexNumber + ' · ' + ep.Name;
                var btns = box.querySelector('.hf-btns'); btns.innerHTML = '';
                var go = el('button', 'f hf-btn primary', 'Play now'); go.onclick = function () { self.playNext(); }; btns.appendChild(go);
                box.classList.add('on');
                if (!early) { var n = 10; box.querySelector('p').textContent = 'Starting in ' + n + 's'; self.countdown = setInterval(function () { n--; box.querySelector('p').textContent = 'Starting in ' + n + 's'; if (n <= 0) { self.playNext(); } }, 1000); }
                else { box.querySelector('p').textContent = 'Plays when this episode ends'; }
            }, function () { self.upNext = 'none'; if (!early) { self.stop(false); } });
        },
        playNext: function () {
            clearInterval(this.countdown);
            var ep = this.upNext && this.upNext.Id ? this.upNext : null;
            if (!ep) { if (this.cur && this.cur.item && this.cur.item.Type === 'Episode') { this.prepareNext(false); } return; }
            this.report('Playing/Stopped');
            this.cleanup(); this.cur = null;
            playItem(ep.Id, {});
        },
        fail: function () { toast('This video won’t play here. Try a lower streaming quality in Settings.'); if (this.cur && this.cur.intro) { this.next(); } else { this.stop(true); } },
        cleanup: function () {
            clearInterval(this.progTimer); clearInterval(this.countdown); clearTimeout(this.seekT);
            if (this.hls) { try { this.hls.destroy(); } catch (e) { /* ignore */ } this.hls = null; }
            if (this.video) { try { this.video.pause(); this.video.removeAttribute('src'); this.video.load(); } catch (e) { /* ignore */ } }
        },
        stop: function (user) {
            if (this.cur && !this.cur.intro) { this.report('Playing/Stopped'); }
            if (NATIVE && user !== 'native') { try { NATIVE.stop(); } catch (e) { /* ignore */ } }
            this.cleanup(); this.cur = null; this.close();
            var top = stack[stack.length - 1];
            if (top) { top.el.style.display = ''; if (top.resume) { top.resume(); } if (top.refresh) { top.refresh(); } }
        },
        close: function () {
            this.on = false;
            if (this.el) { this.el.classList.remove('on'); this.el.querySelector('.hf-osd').classList.remove('on'); }
            current = null;
            var top = stack[stack.length - 1];
            if (top && top.lastFocus && top.el.contains(top.lastFocus)) { setFocus(top.lastFocus, true); } else { focusFirst(); }
        }
    };

    // ================================================================== start
    function startApp() {
        if (!auth) { replace(loginScreen()); return Promise.resolve(); }
        return loadUser().then(function () { replace(homeScreen()); }, function (e) { if (e.status === 401) { signOut(true); } else { replace(loginScreen()); toast(e.message.slice(0, 120)); } });
    }
    function boot() {
        api('GET', 'ArtworkStudio/AppConfig').catch(function () { return {}; }).then(function (c) {
            CFG = c || {};
            applyDesign();
            return startApp();
        }).then(function () {
            var b = document.getElementById('hfBoot'); b.className = 'gone'; setTimeout(function () { b.style.display = 'none'; }, 500);
        });
    }
    boot();
})();
