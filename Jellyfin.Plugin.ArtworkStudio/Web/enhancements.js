/* Artwork Studio \u2014 Extras: optional enhancements to the Jellyfin web app.
 * Every feature has its own switch (Artwork Studio \u2192 Extras) and stays out of the way while a
 * video is playing (Jellyfin marks that with html.transparentDocument). */
(function () {
    'use strict';
    if (window.__artworkStudioExtras) { return; }
    window.__artworkStudioExtras = true;

    var cfg = window.__artworkStudioCfg || {};
    var X = cfg.extras || {};
    var T = cfg.theme || {};
    var brand = cfg.brand || {};
    var me = document.currentScript;
    var base = me && me.src ? me.src.replace(/ArtworkStudio\/ClientScript.*$/i, '') : '../';
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var canHover = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    // ------------------------------------------------------------------ helpers
    function safeColor(v) { return /^#[0-9a-f]{6}$/i.test(v || '') ? v : ''; }
    var presetList = window.__artworkStudioPresets && window.__artworkStudioPresets.list;
    var ACCENT = safeColor(T.AccentColor) || (T.Preset && presetList && presetList[T.Preset] ? presetList[T.Preset].settings.AccentColor : '') || '#00a4dc';
    function rgb(h) { var n = parseInt(String(h).replace('#', '').substring(0, 6), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    function lum(h) { var c = rgb(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
    function onColor(h) { return lum(h) > 0.5 ? '#000' : '#fff'; }
    var A = rgb(ACCENT).join(',');

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function api() { return window.ApiClient; }
    function uid() { var a = api(); try { return a && a.getCurrentUserId && a.getCurrentUserId(); } catch (e) { return null; } }
    function pageFile(page, f) { return base + 'ArtworkStudio/Backdrops/' + page + '/' + encodeURIComponent(f); }
    function isVideoUrl(u) { return /\.(mp4|webm)(\?|$)/i.test(u || ''); }
    function route() {
        var h = location.hash || '', q = h.indexOf('?');
        return {
            route: (q < 0 ? h : h.substring(0, q)).toLowerCase().replace(/^#!?\/?/, '').replace(/\.html$/, ''),
            params: new URLSearchParams(q < 0 ? '' : h.substring(q + 1))
        };
    }
    function playing() { return document.documentElement.classList.contains('transparentDocument') || route().route === 'video'; }
    function imgUrl(id, type, w, tag) {
        var q = { maxWidth: w || 1280, quality: 85 };
        if (tag) { q.tag = tag; }
        return api().getUrl('Items/' + id + '/Images/' + type, q);
    }
    function goDetails(id, autoplay) {
        if (autoplay) { try { sessionStorage.setItem('as-autoplay', JSON.stringify({ id: id, t: Date.now() })); } catch (e) { /* ignore */ } }
        var sid = '';
        try { sid = api().serverId ? api().serverId() : ''; } catch (e) { /* ignore */ }
        location.hash = '#/details?id=' + encodeURIComponent(id) + (sid ? '&serverId=' + encodeURIComponent(sid) : '');
    }
    function fmtDuration(sec) {
        sec = Math.max(0, Math.round(sec));
        var h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
        if (m === 60) { h += 1; m = 0; }
        return h ? h + 'h ' + m + 'm' : m + 'm';
    }
    function fmtClock(d) { try { return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch (e) { return d.getHours() + ':' + ('0' + d.getMinutes()).slice(-2); } }
    function hashStr(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; } return h; }
    function mk(tag, cls, html) { var e = document.createElement(tag); if (cls) { e.className = cls; } if (html != null) { e.innerHTML = html; } return e; }
    var itemCache = {};
    function getItem(id) {
        if (itemCache[id]) { return itemCache[id]; }
        itemCache[id] = api().getItem(uid(), id).catch(function (e) { delete itemCache[id]; throw e; });
        return itemCache[id];
    }

    // ------------------------------------------------------------------ styles
    var css = [];
    css.push(
        // Spotlight
        '#asSpotlight{position:relative;width:100%;height:' + Math.min(85, Math.max(35, X.SpotlightHeight || 62)) + 'vh;min-height:320px;max-height:900px;margin:0 0 1.4em;overflow:hidden;border-radius:0;color:#fff;background:#000;isolation:isolate}' +
        '#asSpotlight .as-spot-layer{position:absolute;top:0;left:0;right:0;bottom:0;background-size:cover;background-position:center 25%;opacity:0;transition:opacity 1.1s ease}' +
        '#asSpotlight .as-spot-layer.as-on{opacity:1}' +
        '#asSpotlight .as-spot-trailer{position:absolute;top:0;left:0;right:0;bottom:0;opacity:0;transition:opacity 1.2s ease;pointer-events:none;overflow:hidden}' +
        '#asSpotlight .as-spot-trailer.as-on{opacity:1}' +
        '#asSpotlight .as-spot-trailer video,#asSpotlight .as-spot-trailer iframe{position:absolute;top:50%;left:50%;width:100%;height:100%;object-fit:cover;border:0;transform:translate(-50%,-50%)}' +
        '#asSpotlight .as-spot-trailer iframe{width:max(100%,calc(' + (Math.min(85, Math.max(35, X.SpotlightHeight || 62))) + 'vh*1.78));height:max(100%,56.25vw);transform:translate(-50%,-50%) scale(1.15)}' +
        '#asSpotlight .as-spot-shade{position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(90deg,rgba(0,0,0,.82) 0%,rgba(0,0,0,.45) 38%,rgba(0,0,0,0) 65%),linear-gradient(0deg,rgba(0,0,0,.7) 0%,rgba(0,0,0,0) 40%);pointer-events:none}' +
        '#asSpotlight .as-spot-info{position:absolute;left:4%;bottom:12%;width:min(44em,58%);z-index:2}' +
        '#asSpotlight .as-spot-logo img{max-width:min(28em,100%);max-height:9em;object-fit:contain;object-position:left bottom;display:block;margin-bottom:.8em;filter:drop-shadow(0 4px 14px rgba(0,0,0,.6))}' +
        '#asSpotlight .as-spot-logo h2{font-size:clamp(1.8em,4vw,3.4em);margin:0 0 .3em;line-height:1.05;text-shadow:0 3px 14px rgba(0,0,0,.7)}' +
        '#asSpotlight .as-spot-meta{display:flex;flex-wrap:wrap;gap:.5em .9em;align-items:center;font-size:.92em;opacity:.95;margin-bottom:.7em}' +
        '#asSpotlight .as-chip{border:1px solid rgba(255,255,255,.55);border-radius:4px;padding:.05em .45em;font-size:.85em}' +
        '#asSpotlight .as-spot-ov{font-size:1em;line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;text-shadow:0 2px 8px rgba(0,0,0,.7);margin-bottom:1.1em}' +
        '#asSpotlight .as-spot-btns{display:flex;gap:.7em;flex-wrap:wrap}' +
        '#asSpotlight .as-spot-btns button{display:inline-flex;align-items:center;gap:.45em;border:0;border-radius:999px;padding:.7em 1.5em;font:inherit;font-weight:700;cursor:pointer;transition:transform .15s,background .15s}' +
        '#asSpotlight .as-spot-btns button:hover,#asSpotlight .as-spot-btns button:focus{transform:scale(1.05)}' +
        '#asSpotlight .as-spot-play{background:#fff;color:#000}' +
        '#asSpotlight .as-spot-more{background:rgba(255,255,255,.22);color:#fff;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}' +
        '#asSpotlight .as-spot-dots{position:absolute;right:4%;bottom:6%;display:flex;gap:.45em;z-index:2}' +
        '#asSpotlight .as-spot-dots button{width:.62em;height:.62em;padding:0;border-radius:50%;border:0;background:rgba(255,255,255,.4);cursor:pointer}' +
        '#asSpotlight .as-spot-dots button.on{background:' + ACCENT + ';transform:scale(1.25)}' +
        '#asSpotlight .as-spot-mute{position:absolute;right:4%;bottom:12%;z-index:2;width:2.6em;height:2.6em;border-radius:50%;border:1px solid rgba(255,255,255,.5);background:rgba(0,0,0,.35);color:#fff;cursor:pointer;display:none;font-size:1em}' +
        '#asSpotlight.as-has-trailer .as-spot-mute{display:block}' +
        '@media (max-width:700px){#asSpotlight .as-spot-info{width:auto;right:4%;bottom:14%}#asSpotlight .as-spot-ov{-webkit-line-clamp:2}}' +

        // Hover trailers
        '#asHoverTrailer{position:fixed;z-index:999;border-radius:12px;overflow:hidden;background:#000;box-shadow:0 18px 50px rgba(0,0,0,.65);pointer-events:none;opacity:0;transform:scale(.92);transition:opacity .25s,transform .25s}' +
        '#asHoverTrailer.as-on{opacity:1;transform:scale(1)}' +
        '#asHoverTrailer video,#asHoverTrailer iframe{position:absolute;top:50%;left:50%;width:100%;height:100%;object-fit:cover;border:0;transform:translate(-50%,-50%) scale(1.2)}' +
        '#asHoverTrailer .as-ht-title{position:absolute;left:0;right:0;bottom:0;padding:1.4em .8em .55em;background:linear-gradient(transparent,rgba(0,0,0,.85));color:#fff;font-weight:700;font-size:.9em}' +

        // Badges
        '.as-badges{position:absolute;top:.45em;left:.45em;display:flex;flex-wrap:wrap;gap:.25em;z-index:3;pointer-events:none;max-width:calc(100% - .9em)}' +
        '.as-badges span{font-size:.62em;font-weight:800;letter-spacing:.04em;padding:.22em .45em;border-radius:4px;background:rgba(0,0,0,.72);color:#fff;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);line-height:1.2}' +
        '.as-badges .as-b-new{background:' + ACCENT + ';color:' + onColor(ACCENT) + '}' +
        '.as-badges .as-b-dv{background:linear-gradient(90deg,#6a3df0,#c94bff)}' +
        '.as-badges .as-b-hdr{background:linear-gradient(90deg,#e8a33d,#f5d061);color:#000}' +
        '.as-badges .as-b-4k{background:rgba(255,255,255,.92);color:#000}' +
        '.as-rating{position:absolute;bottom:.45em;right:.45em;z-index:3;font-size:.66em;font-weight:800;padding:.2em .45em;border-radius:4px;background:rgba(0,0,0,.72);color:#ffd257;pointer-events:none}' +

        // Animated library covers
        '.as-libanim{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;pointer-events:none;z-index:1}' +

        // Surprise me
        '.as-surprise .material-icons{font-size:1.45em}' +
        '#asSurpriseMenu{position:fixed;z-index:1001;min-width:17em;max-width:min(22em,92vw);background:rgba(22,22,28,.96);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);color:#fff;border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:.6em;box-shadow:0 16px 44px rgba(0,0,0,.6);font-size:.95em}' +
        '#asSurpriseMenu .as-sm-opt{display:flex;align-items:center;gap:.6em;width:100%;text-align:left;border:0;background:none;color:inherit;font:inherit;padding:.6em .7em;border-radius:9px;cursor:pointer}' +
        '#asSurpriseMenu .as-sm-opt:hover,#asSurpriseMenu .as-sm-opt:focus{background:rgba(255,255,255,.09)}' +
        '#asSurpriseMenu .as-sm-row{display:flex;align-items:center;gap:.5em;padding:.5em .7em;font-size:.88em;opacity:.85}' +
        '#asSurpriseMenu .as-sm-genres{display:flex;flex-wrap:wrap;gap:.35em;padding:.3em .5em .5em}' +
        '#asSurpriseMenu .as-sm-genres button{border:1px solid rgba(255,255,255,.2);background:none;color:inherit;font:inherit;font-size:.82em;border-radius:999px;padding:.3em .75em;cursor:pointer}' +
        '#asSurpriseMenu .as-sm-genres button:hover{background:' + ACCENT + ';border-color:' + ACCENT + ';color:' + onColor(ACCENT) + '}' +
        '#asSurpriseMenu h4{margin:.5em .7em .2em;font-size:.75em;text-transform:uppercase;letter-spacing:.12em;opacity:.6}' +

        // Details page
        '.as-detail-logo{display:block;max-width:min(30em,90%);max-height:9em;object-fit:contain;object-position:left center;margin:0 0 .6em;filter:drop-shadow(0 4px 14px rgba(0,0,0,.55))}' +
        '.as-hide-title{display:none!important}' +
        '.as-endsat{display:inline-flex;align-items:center;gap:.45em;margin:.6em 0 .2em;padding:.35em .8em;border-radius:999px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.12);font-size:.92em}' +
        '.as-endsat .as-ea-bar{display:inline-block;width:4em;height:4px;border-radius:2px;background:rgba(255,255,255,.2);overflow:hidden}' +
        '.as-endsat .as-ea-bar i{display:block;height:100%;background:' + ACCENT + '}' +

        // Pause screen
        '#asPause{position:fixed;top:0;left:0;right:0;bottom:0;z-index:0;pointer-events:none;opacity:0;transition:opacity .6s ease;background:linear-gradient(90deg,rgba(0,0,0,.78) 0%,rgba(0,0,0,.35) 45%,rgba(0,0,0,0) 70%)}' +
        '#asPause.as-on{opacity:1}' +
        '#asPause .as-p-in{position:absolute;left:6%;bottom:24%;width:min(40em,55%);color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.6)}' +
        '#asPause .as-p-label{font-size:.78em;text-transform:uppercase;letter-spacing:.22em;opacity:.7;margin-bottom:.9em}' +
        '#asPause img{max-width:min(24em,100%);max-height:8em;object-fit:contain;object-position:left bottom;display:block;margin-bottom:.7em}' +
        '#asPause h2{font-size:2.2em;margin:0 0 .25em}' +
        '#asPause .as-p-sub{font-size:1.1em;font-weight:600;margin-bottom:.4em}' +
        '#asPause .as-p-meta{opacity:.8;margin-bottom:.7em}' +
        '#asPause .as-p-ov{line-height:1.55;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;opacity:.92}' +

        // Branded loading screen
        '#asLoader{position:fixed;top:0;left:0;right:0;bottom:0;z-index:998;background:#000;display:flex;align-items:center;justify-content:center;opacity:1;transition:opacity .5s ease}' +
        '#asLoader.as-out{opacity:0;pointer-events:none}' +
        '#asLoader img,#asLoader video{max-width:min(60vw,640px);max-height:50vh;object-fit:contain}' +
        '#asLoader .as-l-pulse{animation:asPulse 1.6s ease-in-out infinite}' +
        '#asLoader .as-l-name{font-size:2.6em;font-weight:800;letter-spacing:.06em;color:#fff}' +
        '@keyframes asPulse{0%,100%{opacity:.55;transform:scale(.96)}50%{opacity:1;transform:scale(1.03)}}' +

        // Animated "Who's watching?"
        '@keyframes asProfileIn{from{opacity:0;transform:translateY(18px) scale(.94)}to{opacity:1;transform:none}}' +

        // Quick search
        '#asSearch{position:fixed;top:0;left:0;right:0;bottom:0;z-index:1002;background:rgba(0,0,0,.55);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);display:flex;justify-content:center;align-items:flex-start;padding-top:11vh}' +
        '#asSearch .as-s-box{width:min(40em,92vw);background:rgba(22,22,28,.97);border:1px solid rgba(255,255,255,.1);border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.6);overflow:hidden;color:#fff}' +
        '#asSearch input{width:100%;box-sizing:border-box;border:0;outline:0;background:transparent;color:#fff;font:inherit;font-size:1.25em;padding:1em 1.1em;border-bottom:1px solid rgba(255,255,255,.08)}' +
        '#asSearch .as-s-list{max-height:60vh;overflow:auto;padding:.4em}' +
        '#asSearch .as-s-row{display:flex;align-items:center;gap:.8em;padding:.45em .6em;border-radius:10px;cursor:pointer}' +
        '#asSearch .as-s-row.sel,#asSearch .as-s-row:hover{background:rgba(' + A + ',.22)}' +
        '#asSearch .as-s-thumb{width:2.6em;height:3.9em;border-radius:5px;background:#333 center/cover;flex:0 0 auto}' +
        '#asSearch .as-s-row small{display:block;opacity:.65}' +
        '#asSearch .as-s-hint{font-size:.78em;opacity:.55;padding:.6em 1.1em;border-top:1px solid rgba(255,255,255,.06)}' +

        // Announcement banners (same look as Design \u2192 announcement)
        '.as-announce{display:flex;align-items:center;gap:.8em;margin:1em 3.3% .5em;padding:.85em 1.1em;border-radius:10px;color:#fff;font-size:1.02em;line-height:1.45;box-shadow:0 6px 20px rgba(0,0,0,.25)}' +
        '.as-announce a{color:#fff;text-decoration:underline}.as-announce .as-announce-text{flex:1;white-space:pre-line}' +
        '.as-announce button{background:rgba(255,255,255,.18);border:0;color:#fff;border-radius:50%;width:2em;height:2em;cursor:pointer;font-size:1em;flex:0 0 auto}' +

        // Seasonal particles
        '#asSeason{position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:5}' +

        // Never during playback
        'html.transparentDocument #asHoverTrailer,html.transparentDocument #asSeason,html.transparentDocument #asSurpriseMenu,html.transparentDocument #asSpotlight{display:none!important}');

    if (X.CinematicBackdrop && !reduceMotion) {
        css.push('@keyframes asKen{0%{transform:scale(1.03) translate3d(0,0,0)}100%{transform:scale(1.14) translate3d(-1.6%,-1.2%,0)}}' +
            '.backdropContainer .backdropImage{animation:asKen 34s ease-in-out infinite alternate;transform-origin:60% 40%}' +
            '#asSpotlight .as-spot-layer.as-on{animation:asKen 26s ease-in-out infinite alternate;transform-origin:65% 35%}' +
            'html.transparentDocument .backdropImage{animation:none!important}');
    }
    if (X.UpNextStyle) {
        css.push('.upNextDialog{background:rgba(16,16,22,.82)!important;-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);border:1px solid rgba(255,255,255,.1)!important;border-radius:18px!important;padding:1.2em 1.4em!important;box-shadow:0 20px 60px rgba(0,0,0,.6)!important;min-width:min(30em,90vw)}' +
            '.upNextDialog-poster{border-radius:12px!important;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.5)}' +
            '.upNextDialog-nextVideoText,.upNextDialog-title{font-weight:700!important;font-size:1.15em!important}' +
            '.upNextDialog-countdownText{font-weight:800!important;color:' + ACCENT + '!important}' +
            '.upNextDialog .btnStartNow{background:' + ACCENT + '!important;color:' + onColor(ACCENT) + '!important;border-radius:999px!important;font-weight:700!important;padding:.65em 1.4em!important}' +
            '.upNextDialog .btnHide{border-radius:999px!important;background:rgba(255,255,255,.12)!important;padding:.65em 1.4em!important}');
    }
    if (X.AnimatedProfiles && !reduceMotion) {
        var delays = '';
        for (var i = 1; i <= 12; i++) { delays += '#divUsers .card:nth-child(' + i + '){animation-delay:' + ((i - 1) * 70) + 'ms}'; }
        css.push('#divUsers .card{animation:asProfileIn .55s cubic-bezier(.2,.8,.2,1) both}' + delays +
            '#divUsers .cardScalable{transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s}' +
            '#divUsers .card:hover .cardScalable,#divUsers .card:focus .cardScalable{transform:scale(1.08);box-shadow:0 0 0 3px ' + ACCENT + ',0 14px 34px rgba(' + A + ',.45)}' +
            '#divUsers:hover .card:not(:hover) .cardScalable{opacity:.6;filter:saturate(.6)}' +
            '#divUsers .card:hover .cardText{color:#fff}');
    }
    // Logo as the loading spinner
    var spinnerSrc = cfg.loader && !isVideoUrl(cfg.loader) ? pageFile('loader', cfg.loader) : (brand.logo ? pageFile('logo', brand.logo) : (brand.favicon ? pageFile('favicon', brand.favicon) : ''));
    if (X.LogoSpinner && spinnerSrc) {
        css.push('.docspinner{border:0!important;background:url("' + spinnerSrc + '") center/contain no-repeat!important;width:5.5em!important;height:5.5em!important;margin:-2.75em 0 0 -2.75em!important;animation:asPulse 1.5s ease-in-out infinite!important}' +
            '.docspinner>*{display:none!important}');
    }

    var styleEl = document.createElement('style');
    styleEl.id = 'artworkStudioExtras';
    styleEl.textContent = css.join('\n');
    document.head.appendChild(styleEl);

    // ------------------------------------------------------------------ trailers (shared)
    function ytId(url) { var m = String(url || '').match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/); return m && m[1]; }
    // Every YouTube trailer of a title, chained so the next one is tried if one can't be embedded
    function youTube(item) {
        var ids = [];
        (item.RemoteTrailers || []).forEach(function (t) { var id = ytId(t.Url); if (id && ids.indexOf(id) < 0) { ids.push(id); } });
        var chain = null;
        for (var i = Math.min(ids.length, 4) - 1; i >= 0; i--) { chain = { type: 'yt', id: ids[i], next: chain }; }
        return chain;
    }
    function realTrailers(item) {
        if (item.LocalTrailerCount > 0 && api().getLocalTrailers) {
            return api().getLocalTrailers(uid(), item.Id).then(function (list) {
                if (list && list[0]) {
                    return { type: 'video', src: api().getUrl('Videos/' + list[0].Id + '/stream', { static: true, api_key: api().accessToken() }), next: youTube(item) };
                }
                return youTube(item);
            }).catch(function () { return youTube(item); });
        }
        return Promise.resolve(youTube(item));
    }

    // ---- Clips from the title itself, streamed from your own server (no YouTube involved)
    var CLIP_LEN = Math.min(120, Math.max(8, X.ClipSeconds || 30));
    function playableFor(item) {
        if (item.Type !== 'Series') { return Promise.resolve(item); }
        // a show: use a random episode that has a video file
        return api().getItems(uid(), { ParentId: item.Id, IncludeItemTypes: 'Episode', Recursive: true, SortBy: 'Random', Limit: 1, IsMissing: false, Fields: 'MediaSources' })
            .then(function (r) { return (r.Items || [])[0] || null; });
    }
    function clipChain(item) {
        return playableFor(item).then(function (it) {
            if (!it || !it.RunTimeTicks) { return null; }
            var run = it.RunTimeTicks / 1e7;
            // somewhere between 15% and 65% of the way in, clear of opening and closing credits
            var start = Math.round(run * (0.15 + Math.random() * 0.5));
            var ms = it.MediaSources && it.MediaSources[0];
            var a = api(), token = a.accessToken();
            var direct = { type: 'clip', start: start, src: a.getUrl('Videos/' + it.Id + '/stream', { static: true, mediaSourceId: ms ? ms.Id : it.Id, api_key: token }) + '#t=' + start };
            if (X.ClipTranscode !== false) {
                var session = 'as' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
                var dev = a.deviceId ? a.deviceId() : 'artworkstudio';
                direct.next = {
                    type: 'clip', start: 0, transcode: { deviceId: dev, playSessionId: session },
                    src: a.getUrl('Videos/' + it.Id + '/stream.mp4', {
                        mediaSourceId: ms ? ms.Id : it.Id, deviceId: dev, playSessionId: session, api_key: token,
                        videoCodec: 'h264', audioCodec: 'aac', audioBitRate: 96000, maxAudioChannels: 2,
                        maxWidth: 1280, videoBitRate: 2500000, startTimeTicks: start * 1e7,
                        enableAutoStreamCopy: true, allowVideoStreamCopy: true, allowAudioStreamCopy: false, breakOnNonKeyFrames: true
                    })
                };
            }
            return direct;
        }).catch(function () { return null; });
    }
    function appendChain(first, rest) {
        if (!first) { return rest; }
        var c = first; while (c.next) { c = c.next; } c.next = rest; return first;
    }
    // Where previews come from (Extras -> Preview source)
    function trailerFor(item) {
        var src = X.PreviewSource || 'clips';
        if (src === 'trailers') { return realTrailers(item); }
        if (src === 'clips') { return clipChain(item); }
        if (src === 'trailers-then-clips') { return Promise.all([realTrailers(item), clipChain(item)]).then(function (r) { return appendChain(r[0], r[1]); }); }
        return Promise.all([clipChain(item), realTrailers(item)]).then(function (r) { return appendChain(r[0], r[1]); });
    }

    // Stop a preview cleanly: stop downloading, and tell the server to end any conversion it started
    function killMedia(root) {
        if (!root) { return; }
        Array.prototype.forEach.call(root.tagName === 'VIDEO' ? [root] : root.querySelectorAll('video'), function (v) {
            if (v.__asKill) { v.__asKill(); v.__asKill = null; }
            try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) { /* ignore */ }
        });
    }

    // YouTube reports what its player is doing through postMessage; we only reveal a trailer once
    // it is actually playing, and move on quietly if YouTube refuses it (embedding disabled, error 153...).
    var ytFrames = [];
    window.addEventListener('message', function (e) {
        if (!/^https:\/\/www\.youtube(-nocookie)?\.com$/.test(e.origin)) { return; }
        var d; try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch (err) { return; }
        if (!d) { return; }
        ytFrames.forEach(function (f) {
            if (!f.iframe.isConnected || f.iframe.contentWindow !== e.source) { return; }
            var state = d.event === 'onStateChange' ? d.info : (d.event === 'infoDelivery' && d.info ? d.info.playerState : undefined);
            if (d.event === 'onError' || (d.event === 'infoDelivery' && d.info && d.info.errorCode)) { f.fail(); }
            else if (state === 1) { f.ready(); }
        });
    });
    function trailerNode(t, onReady, onFail) {
        if (t.type === 'video' || t.type === 'clip') {
            var v = document.createElement('video'), settled = false;
            v.muted = true; v.autoplay = true; v.loop = t.type !== 'clip'; v.playsInline = true; v.preload = 'auto';
            v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
            var fail = function () {
                if (settled) { return; }
                settled = true; clearTimeout(guard); killMedia(v); v.remove();
                if (onFail) { onFail(t.next); }
            };
            if (t.transcode) {
                v.__asKill = function () {
                    try {
                        fetch(api().getUrl('Videos/ActiveEncodings', { deviceId: t.transcode.deviceId, playSessionId: t.transcode.playSessionId }),
                            { method: 'DELETE', headers: { 'X-Emby-Token': api().accessToken() } }).catch(function () {});
                    } catch (e) { /* ignore */ }
                };
            }
            v.addEventListener('playing', function () {
                if (settled) { return; }
                // a file the browser can only partly decode plays sound with no picture: treat that as a failure
                setTimeout(function () {
                    if (settled) { return; }
                    if (!v.videoWidth) { fail(); return; }
                    settled = true; clearTimeout(guard);
                    if (onReady) { onReady(v); }
                }, 450);
            });
            v.addEventListener('error', fail);
            if (t.type === 'clip') {
                var began = null;
                v.addEventListener('timeupdate', function () {
                    if (began == null && v.currentTime > 0) { began = v.currentTime; }
                    if (began != null && v.currentTime - began >= CLIP_LEN) {
                        // clip finished: loop it for hover previews, let the spotlight move on
                        if (v.__asOnEnd) { v.__asOnEnd(); } else { try { v.currentTime = began; } catch (e) { /* ignore */ } }
                    }
                });
            }
            var guard = setTimeout(fail, t.transcode ? 14000 : 8000);   // nothing to show in time: try the next source
            v.src = t.src;
            var p = v.play(); if (p && p.catch) { p.catch(function () {}); }
            return v;
        }
        var f = document.createElement('iframe');
        f.allow = 'autoplay; encrypted-media; picture-in-picture';
        f.setAttribute('frameborder', '0');
        // YouTube needs to know which site is embedding it (otherwise "Error 153"), even though
        // Jellyfin's pages otherwise send no referrer.
        f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
        f.referrerPolicy = 'strict-origin-when-cross-origin';
        f.src = 'https://www.youtube-nocookie.com/embed/' + t.id + '?autoplay=1&mute=1&controls=0&loop=1&playlist=' + t.id +
            '&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&disablekb=1&enablejsapi=1&start=6' +
            '&origin=' + encodeURIComponent(location.origin) + '&widget_referrer=' + encodeURIComponent(location.origin + location.pathname);
        var done = false, entry;
        var finish = function () { done = true; clearTimeout(entry.timer); ytFrames = ytFrames.filter(function (x) { return x !== entry; }); };
        entry = {
            iframe: f,
            ready: function () { if (done) { return; } finish(); if (onReady) { onReady(f); } },
            fail: function () { if (done) { return; } finish(); f.remove(); if (onFail) { onFail(t.next); } },
            timer: null
        };
        ytFrames.push(entry);
        f.addEventListener('load', function () {
            // ask the player to start reporting its state
            try { f.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*'); } catch (err) { /* ignore */ }
        }, { once: true });
        entry.timer = setTimeout(function () { entry.fail(); }, 9000);   // never got going: give up quietly
        return f;
    }

    // ------------------------------------------------------------------ Spotlight banner
    var spot = { items: null, loadedAt: 0, idx: 0, timer: null, tTimer: null, el: null, hover: false, muted: true, media: null, loading: false };
    function spotQuery() {
        var count = Math.min(20, Math.max(3, X.SpotlightCount || 8));
        var q = {
            IncludeItemTypes: 'Movie,Series', Recursive: true, Limit: count * 2, ImageTypes: 'Backdrop', ImageTypeLimit: 1,
            Fields: 'Overview,Genres,RemoteTrailers,CommunityRating,OfficialRating,ProductionYear,RunTimeTicks,ChildCount,LocalTrailerCount',
            EnableImageTypes: 'Backdrop,Logo,Primary'
        };
        switch (X.SpotlightSource) {
            case 'random': q.SortBy = 'Random'; break;
            case 'unwatched': q.SortBy = 'Random'; q.Filters = 'IsUnplayed'; break;
            case 'favorites': q.SortBy = 'Random'; q.Filters = 'IsFavorite'; break;
            default: q.SortBy = 'DateCreated,SortName'; q.SortOrder = 'Descending';
        }
        return { q: q, count: count };
    }
    function loadSpot() {
        if (spot.items && Date.now() - spot.loadedAt < 600000) { return Promise.resolve(spot.items); }
        var sq = spotQuery();
        return api().getItems(uid(), sq.q).then(function (r) {
            spot.items = (r.Items || []).filter(function (i) { return i.BackdropImageTags && i.BackdropImageTags.length; }).slice(0, sq.count);
            spot.loadedAt = Date.now();
            return spot.items;
        });
    }
    function stopSpotTrailer() {
        clearTimeout(spot.tTimer);
        if (spot.el) {
            var box = spot.el.querySelector('.as-spot-trailer');
            box.classList.remove('as-on');
            spot.el.classList.remove('as-has-trailer');
            killMedia(box);
            setTimeout(function () { if (!box.classList.contains('as-on')) { box.innerHTML = ''; } }, 900);
        }
        spot.media = null;
    }
    function startSpotTrailer(item) {
        if (!spot.el || !X.SpotlightTrailers || reduceMotion || playing() || document.hidden) { return; }
        trailerFor(item).then(function (t) {
            if (!t || !spot.el || spot.items[spot.idx] !== item) { return; }
            var box = spot.el.querySelector('.as-spot-trailer');
            var add = function (tt) {
                killMedia(box);
                box.innerHTML = '';
                var node = trailerNode(tt, function (n) {
                    if (spot.items[spot.idx] !== item) { killMedia(n); return; }
                    spot.media = n;
                    n.__asOnEnd = function () { stopSpotTrailer(); showSpot(spot.idx + 1); scheduleSpot(); };
                    box.classList.add('as-on');
                    spot.el.classList.add('as-has-trailer');
                    spot.muted = true; updateMute();
                }, function (fb) { if (fb) { add(fb); } });
                box.appendChild(node);
            };
            add(t);
        });
    }
    function updateMute() {
        if (!spot.el) { return; }
        var b = spot.el.querySelector('.as-spot-mute');
        b.textContent = spot.muted ? '\ud83d\udd07' : '\ud83d\udd0a';
        b.title = spot.muted ? 'Unmute trailer' : 'Mute trailer';
        var m = spot.media;
        if (!m) { return; }
        if (m.tagName === 'VIDEO') { m.muted = spot.muted; }
        else { try { m.contentWindow.postMessage(JSON.stringify({ event: 'command', func: spot.muted ? 'mute' : 'unMute', args: [] }), '*'); } catch (e) { /* ignore */ } }
    }
    function showSpot(i) {
        var items = spot.items; if (!items || !items.length || !spot.el) { return; }
        spot.idx = (i + items.length) % items.length;
        var item = items[spot.idx];
        stopSpotTrailer();
        var layers = spot.el.querySelectorAll('.as-spot-layer');
        var next = layers[0].classList.contains('as-on') ? layers[1] : layers[0];
        var prev = next === layers[0] ? layers[1] : layers[0];
        var url = imgUrl(item.Id, 'Backdrop/0', 1920, item.BackdropImageTags[0]);
        var pre = new Image();
        pre.onload = pre.onerror = function () {
            next.style.backgroundImage = 'url("' + url + '")';
            next.classList.add('as-on'); prev.classList.remove('as-on');
        };
        pre.src = url;
        var logo = spot.el.querySelector('.as-spot-logo');
        logo.innerHTML = item.ImageTags && item.ImageTags.Logo
            ? '<img alt="' + esc(item.Name) + '" src="' + imgUrl(item.Id, 'Logo', 900, item.ImageTags.Logo) + '">'
            : '<h2>' + esc(item.Name) + '</h2>';
        var meta = [];
        if (item.ProductionYear) { meta.push('<span>' + item.ProductionYear + '</span>'); }
        if (item.OfficialRating) { meta.push('<span class="as-chip">' + esc(item.OfficialRating) + '</span>'); }
        if (item.CommunityRating) { meta.push('<span>\u2605 ' + item.CommunityRating.toFixed(1) + '</span>'); }
        if (item.Type === 'Series' && item.ChildCount) { meta.push('<span>' + item.ChildCount + ' season' + (item.ChildCount > 1 ? 's' : '') + '</span>'); }
        else if (item.RunTimeTicks) { meta.push('<span>' + fmtDuration(item.RunTimeTicks / 1e7) + '</span>'); }
        if (item.Genres && item.Genres.length) { meta.push('<span>' + esc(item.Genres.slice(0, 3).join(' \u00b7 ')) + '</span>'); }
        spot.el.querySelector('.as-spot-meta').innerHTML = meta.join('');
        spot.el.querySelector('.as-spot-ov').textContent = item.Overview || '';
        Array.prototype.forEach.call(spot.el.querySelectorAll('.as-spot-dots button'), function (d, n) { d.classList.toggle('on', n === spot.idx); });
        spot.tTimer = setTimeout(function () { startSpotTrailer(item); }, 3500);
    }
    function scheduleSpot() {
        clearInterval(spot.timer);
        spot.timer = setInterval(function () {
            if (!spot.el || !spot.el.isConnected || !spot.el.offsetParent) { return; }
            if (spot.hover || spot.media) { return; }   // hold while hovered or a trailer plays
            showSpot(spot.idx + 1);
        }, Math.max(5, X.SpotlightSeconds || 9) * 1000);
    }
    function buildSpot(container) {
        var el = mk('div', '', '<div class="as-spot-layer"></div><div class="as-spot-layer"></div><div class="as-spot-trailer"></div><div class="as-spot-shade"></div>' +
            '<div class="as-spot-info"><div class="as-spot-logo"></div><div class="as-spot-meta"></div><div class="as-spot-ov"></div>' +
            '<div class="as-spot-btns"><button type="button" class="as-spot-play">\u25b6 Play</button><button type="button" class="as-spot-more">More info</button></div></div>' +
            '<div class="as-spot-dots"></div><button type="button" class="as-spot-mute"></button>');
        el.id = 'asSpotlight';
        el.addEventListener('mouseenter', function () { spot.hover = true; });
        el.addEventListener('mouseleave', function () { spot.hover = false; });
        el.addEventListener('click', function (e) {
            var item = spot.items && spot.items[spot.idx]; if (!item) { return; }
            if (e.target.closest('.as-spot-play')) { stopSpotTrailer(); goDetails(item.Id, true); }
            else if (e.target.closest('.as-spot-more')) { stopSpotTrailer(); goDetails(item.Id, false); }
            else if (e.target.closest('.as-spot-mute')) { spot.muted = !spot.muted; updateMute(); }
            else if (e.target.closest('.as-spot-dots button')) { showSpot(+e.target.dataset.i); scheduleSpot(); }
        });
        container.insertBefore(el, container.firstChild);
        spot.el = el;
        return el;
    }
    function spotlightTick() {
        if (!X.Spotlight || !uid()) { return; }
        var existing = document.getElementById('asSpotlight');
        if (route().route !== 'home' || playing()) {
            if (spot.media) { stopSpotTrailer(); }
            return;
        }
        var container = document.querySelector('.page:not(.hide) .homeSectionsContainer');
        if (!container) { return; }
        if (existing && existing.parentElement === container) { return; }
        if (existing) { existing.remove(); }
        if (spot.loading) { return; }
        spot.loading = true;
        loadSpot().then(function (items) {
            spot.loading = false;
            if (!items.length || route().route !== 'home') { return; }
            var c = document.querySelector('.page:not(.hide) .homeSectionsContainer');
            if (!c || document.getElementById('asSpotlight')) { return; }
            var el = buildSpot(c);
            el.querySelector('.as-spot-dots').innerHTML = items.map(function (_, n) { return '<button type="button" data-i="' + n + '" title="' + esc(items[n].Name) + '"></button>'; }).join('');
            showSpot(0);
            scheduleSpot();
        }).catch(function () { spot.loading = false; });
    }

    // Spotlight "Play": open the title and press Play once its page is ready
    function autoplayTick() {
        var raw; try { raw = sessionStorage.getItem('as-autoplay'); } catch (e) { return; }
        if (!raw) { return; }
        var want = {}; try { want = JSON.parse(raw); } catch (e) { /* ignore */ }
        if (!want.id || Date.now() - want.t > 15000) { try { sessionStorage.removeItem('as-autoplay'); } catch (e) { /* ignore */ } return; }
        var r = route();
        if (r.route !== 'details' || r.params.get('id') !== want.id) { return; }
        var btn = Array.prototype.filter.call(document.querySelectorAll('.itemDetailPage:not(.hide) .btnPlay, #itemDetailPage:not(.hide) .btnPlay'), function (b) { return b.offsetParent && !b.classList.contains('hide'); })[0];
        if (btn) { try { sessionStorage.removeItem('as-autoplay'); } catch (e) { /* ignore */ } btn.click(); }
    }

    // ------------------------------------------------------------------ Hover trailers
    var hov = { card: null, timer: null, el: null };
    function closeHover() {
        clearTimeout(hov.timer); hov.card = null;
        if (hov.el) { var e = hov.el; hov.el = null; killMedia(e); e.classList.remove('as-on'); setTimeout(function () { e.remove(); }, 260); }
    }
    function openHover(card, id) {
        getItem(id).then(trailerFor).then(function (t) {
            if (!t || hov.card !== card || playing()) { return; }
            var box = card.querySelector('.cardScalable') || card;
            var r = box.getBoundingClientRect();
            var w = Math.min(560, Math.max(300, r.width * 1.9)), h = w * 9 / 16;
            var left = Math.min(window.innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2));
            var top = Math.min(window.innerHeight - h - 8, Math.max(8, r.top + r.height / 2 - h / 2));
            var el = mk('div');
            el.id = 'asHoverTrailer';
            el.style.cssText = 'left:' + left + 'px;top:' + top + 'px;width:' + w + 'px;height:' + h + 'px';
            var name = (card.querySelector('.cardText') || {}).textContent || '';
            var add = function (tt) {
                killMedia(el);
                Array.prototype.forEach.call(el.querySelectorAll('video,iframe'), function (n) { n.remove(); });
                el.insertBefore(trailerNode(tt, function () { el.classList.add('as-on'); }, function (fb) { if (fb) { add(fb); } else { closeHover(); } }), el.firstChild);
            };
            el.appendChild(mk('div', 'as-ht-title', esc(name)));
            if (hov.el) { hov.el.remove(); }
            hov.el = el;
            document.body.appendChild(el);
            add(t);
        }).catch(function () { /* ignore */ });
    }
    if (X.HoverTrailers && canHover) {
        document.addEventListener('mouseover', function (e) {
            if (playing() || !uid()) { return; }
            var card = e.target.closest && e.target.closest('.card[data-id]');
            if (!card || card === hov.card) { return; }
            if (card.closest('#asSpotlight,#divUsers,#asSearch') || !/^(Movie|Series)$/.test(card.dataset.type || '')) { return; }
            closeHover();
            hov.card = card;
            hov.timer = setTimeout(function () { if (hov.card === card) { openHover(card, card.dataset.id); } }, Math.max(300, X.HoverDelay || 900));
        }, true);
        document.addEventListener('mouseout', function (e) {
            if (!hov.card) { return; }
            if (e.relatedTarget && hov.card.contains(e.relatedTarget)) { return; }
            if (e.target.closest && e.target.closest('.card[data-id]') === hov.card) { closeHover(); }
        }, true);
        window.addEventListener('scroll', closeHover, true);
        window.addEventListener('blur', closeHover);
    }

    // ------------------------------------------------------------------ Badges + animated library covers
    var BADGE_TYPES = /^(Movie|Episode|Series|Season|Video|MusicVideo|BoxSet)$/;
    var badgeWait = {}, badgeTimer = null;
    function scanCards() {
        if (!uid()) { return; }
        var libanim = cfg.libanim || {};
        Array.prototype.forEach.call(document.querySelectorAll('.card[data-id]:not([data-as-s])'), function (card) {
            card.setAttribute('data-as-s', '1');
            var id = card.dataset.id;
            // animated library cover
            if (X.AnimatedLibraryCovers && libanim[id]) {
                var holder = card.querySelector('.cardImageContainer') || card.querySelector('.cardScalable');
                if (holder && !holder.querySelector('.as-libanim')) {
                    var src = pageFile('lib-' + id, libanim[id]), node;
                    if (isVideoUrl(src)) {
                        node = document.createElement('video');
                        node.muted = true; node.loop = true; node.autoplay = !reduceMotion; node.playsInline = true;
                        node.setAttribute('muted', ''); node.setAttribute('playsinline', '');
                    } else { node = document.createElement('img'); node.alt = ''; }
                    node.className = 'as-libanim'; node.src = src;
                    if (getComputedStyle(holder).position === 'static') { holder.style.position = 'relative'; }
                    holder.appendChild(node);
                }
            }
            if (!X.Badges || !BADGE_TYPES.test(card.dataset.type || '') || card.closest('#divUsers,#asSpotlight,#asSearch')) { return; }
            (badgeWait[id] = badgeWait[id] || []).push(card);
        });
        if (Object.keys(badgeWait).length && !badgeTimer) { badgeTimer = setTimeout(flushBadges, 250); }
    }
    function flushBadges() {
        badgeTimer = null;
        var ids = Object.keys(badgeWait).slice(0, 40);
        if (!ids.length) { return; }
        var waiting = {}; ids.forEach(function (id) { waiting[id] = badgeWait[id]; delete badgeWait[id]; });
        api().getItems(uid(), { Ids: ids.join(','), Fields: 'MediaSources,DateCreated,DateLastMediaAdded', EnableUserData: false, EnableImages: false }).then(function (r) {
            (r.Items || []).forEach(function (item) { (waiting[item.Id] || []).forEach(function (card) { applyBadges(card, item); }); });
        }).catch(function () { /* ignore */ }).then(function () {
            if (Object.keys(badgeWait).length) { badgeTimer = setTimeout(flushBadges, 150); }
        });
    }
    function badgesFor(item) {
        var out = [];
        if (X.BadgeNew !== false) {
            var d = item.Type === 'Series' ? (item.DateLastMediaAdded || item.DateCreated) : item.DateCreated;
            if (d && Date.now() - Date.parse(d) < Math.max(1, X.BadgeNewDays || 14) * 864e5) { out.push(['NEW', 'as-b-new']); }
        }
        if (X.BadgeQuality !== false) {
            var streams = (item.MediaSources && item.MediaSources[0] && item.MediaSources[0].MediaStreams) || item.MediaStreams || [];
            var v = streams.filter(function (s) { return s.Type === 'Video'; })[0];
            if (v) {
                if ((v.Width || 0) >= 3200 || (v.Height || 0) >= 1700) { out.push(['4K', 'as-b-4k']); }
                var range = (v.VideoRangeType || '') + ' ' + (v.VideoRange || '');
                if (/DOVI/i.test(range)) { out.push(['DOLBY VISION', 'as-b-dv']); }
                else if (/HDR|HLG/i.test(range)) { out.push(['HDR', 'as-b-hdr']); }
            }
            if (streams.some(function (s) { return s.Type === 'Audio' && /atmos/i.test((s.DisplayTitle || '') + ' ' + (s.Profile || '') + ' ' + (s.Title || '')); })) { out.push(['ATMOS', '']); }
        }
        return out;
    }
    function applyBadges(card, item) {
        var box = card.querySelector('.cardScalable') || card.querySelector('.cardBox');
        if (!box) { return; }
        Array.prototype.forEach.call(box.querySelectorAll(':scope > .as-badges, :scope > .as-rating'), function (n) { n.remove(); });
        var list = badgesFor(item);
        if (getComputedStyle(box).position === 'static') { box.style.position = 'relative'; }
        if (list.length) {
            box.appendChild(mk('div', 'as-badges', list.map(function (b) { return '<span class="' + b[1] + '">' + b[0] + '</span>'; }).join('')));
        }
        if (X.BadgeRating !== false && item.CommunityRating) {
            box.appendChild(mk('div', 'as-rating', '\u2605 ' + item.CommunityRating.toFixed(1)));
        }
    }
    var scanQueued = false;
    if (window.MutationObserver) {
        new MutationObserver(function () {
            if (scanQueued) { return; }
            scanQueued = true;
            setTimeout(function () { scanQueued = false; scanCards(); }, 350);
        }).observe(document.body, { childList: true, subtree: true });
    }

    // ------------------------------------------------------------------ Surprise me
    var genres = null;
    function closeSurprise() { var m = document.getElementById('asSurpriseMenu'); if (m) { m.remove(); } }
    function surprise(types, genre) {
        var unwatched = true; try { unwatched = localStorage.getItem('as-surprise-all') !== '1'; } catch (e) { /* ignore */ }
        var q = { IncludeItemTypes: types, Recursive: true, SortBy: 'Random', Limit: 1, ImageTypeLimit: 1 };
        if (unwatched) { q.Filters = 'IsUnplayed'; }
        if (genre) { q.Genres = genre; }
        closeSurprise();
        api().getItems(uid(), q).then(function (r) {
            var it = (r.Items || [])[0];
            if (it) { goDetails(it.Id, false); }
            else { toast('Nothing found for that pick' + (unwatched ? ' (unwatched only).' : '.')); }
        });
    }
    function openSurprise(btn) {
        closeSurprise();
        var r = btn.getBoundingClientRect();
        var all = false; try { all = localStorage.getItem('as-surprise-all') === '1'; } catch (e) { /* ignore */ }
        var m = mk('div', '', '<h4>Surprise me</h4>' +
            '<button class="as-sm-opt" data-t="Movie">\ud83c\udfac Random movie</button>' +
            '<button class="as-sm-opt" data-t="Series">\ud83d\udcfa Random show</button>' +
            '<button class="as-sm-opt" data-t="Episode">\u25b6\ufe0f Random episode</button>' +
            '<label class="as-sm-row"><input type="checkbox" class="as-sm-unw"' + (all ? '' : ' checked') + '> Only things I haven\u2019t watched</label>' +
            '<h4>By genre</h4><div class="as-sm-genres"><span style="opacity:.6;font-size:.85em;padding:.3em">Loading\u2026</span></div>');
        m.id = 'asSurpriseMenu';
        m.style.top = (r.bottom + 8) + 'px';
        m.style.right = Math.max(8, window.innerWidth - r.right - 8) + 'px';
        document.body.appendChild(m);
        m.addEventListener('click', function (e) {
            e.stopPropagation();
            var o = e.target.closest('[data-t]'); if (o) { surprise(o.dataset.t); return; }
            var g = e.target.closest('[data-g]'); if (g) { surprise('Movie,Series', g.dataset.g); }
        });
        m.querySelector('.as-sm-unw').addEventListener('change', function () { try { localStorage.setItem('as-surprise-all', this.checked ? '0' : '1'); } catch (e) { /* ignore */ } });
        (genres ? Promise.resolve(genres) : api().getGenres(uid(), { IncludeItemTypes: 'Movie,Series', Recursive: true, SortBy: 'SortName' }).then(function (res) { genres = (res.Items || []).map(function (g) { return g.Name; }); return genres; }))
            .then(function (list) {
                var box = m.querySelector('.as-sm-genres'); if (!box) { return; }
                box.innerHTML = list.slice(0, 18).map(function (g) { return '<button data-g="' + esc(g) + '">' + esc(g) + '</button>'; }).join('') || '<span style="opacity:.6">No genres</span>';
            }).catch(function () { /* ignore */ });
    }
    function surpriseTick() {
        if (!X.SurpriseMe || !uid() || playing()) { return; }
        var right = document.querySelector('.skinHeader .headerRight');
        if (!right || right.querySelector('.as-surprise')) { return; }
        var b = mk('button', 'headerButton headerButtonRight paper-icon-button-light as-surprise', '<span class="material-icons casino" aria-hidden="true">casino</span>');
        b.type = 'button'; b.title = 'Surprise me';
        b.addEventListener('click', function (e) { e.stopPropagation(); if (document.getElementById('asSurpriseMenu')) { closeSurprise(); } else { openSurprise(b); } });
        right.insertBefore(b, right.firstChild);
    }
    document.addEventListener('click', closeSurprise);

    var toastEl = null;
    function toast(msg) {
        if (!toastEl) { toastEl = mk('div'); toastEl.style.cssText = 'position:fixed;left:50%;bottom:8%;transform:translateX(-50%);z-index:1003;background:rgba(20,20,26,.95);color:#fff;padding:.8em 1.3em;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.5);transition:opacity .3s;opacity:0;pointer-events:none'; document.body.appendChild(toastEl); }
        toastEl.textContent = msg; toastEl.style.opacity = 1;
        clearTimeout(toastEl._t); toastEl._t = setTimeout(function () { toastEl.style.opacity = 0; }, 2800);
    }

    // ------------------------------------------------------------------ Movie & show pages
    var det = { id: null, item: null, amb: null };
    function detailsPage() { return document.querySelector('.itemDetailPage:not(.hide),#itemDetailPage:not(.hide)'); }
    function clearDetails() {
        Array.prototype.forEach.call(document.querySelectorAll('.as-detail-logo,.as-endsat'), function (n) { n.remove(); });
        Array.prototype.forEach.call(document.querySelectorAll('.as-hide-title'), function (n) { n.classList.remove('as-hide-title'); });
        var s = document.getElementById('asAmbient'); if (s) { s.remove(); }
        det.id = null; det.item = null;
    }
    function ambientFrom(item) {
        if (!X.AmbientColor) { return; }
        var tag = item.ImageTags && item.ImageTags.Primary;
        var url = tag ? imgUrl(item.Id, 'Primary', 120, tag) : (item.BackdropImageTags && item.BackdropImageTags[0] ? imgUrl(item.Id, 'Backdrop/0', 200, item.BackdropImageTags[0]) : null);
        if (!url) { return; }
        var img = new Image();
        img.onload = function () {
            if (det.item !== item) { return; }
            try {
                var c = document.createElement('canvas'); c.width = 48; c.height = 48;
                var g = c.getContext('2d'); g.drawImage(img, 0, 0, 48, 48);
                var d = g.getImageData(0, 0, 48, 48).data, best = null, buckets = {};
                for (var i = 0; i < d.length; i += 4) {
                    var r = d[i], gg = d[i + 1], b = d[i + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 510, s = mx === mn ? 0 : (mx - mn) / (255 - Math.abs(mx + mn - 255));
                    if (s < 0.3 || l < 0.15 || l > 0.85) { continue; }
                    var hue = mx === r ? ((gg - b) / (mx - mn) + 6) % 6 : mx === gg ? (b - r) / (mx - mn) + 2 : (r - gg) / (mx - mn) + 4;
                    var k = Math.round(hue * 4) % 24, w = s * (1 - Math.abs(l - 0.5));
                    var bk = buckets[k] = buckets[k] || { w: 0, r: 0, g: 0, b: 0 };
                    bk.w += w; bk.r += r * w; bk.g += gg * w; bk.b += b * w;
                }
                Object.keys(buckets).forEach(function (k) { if (!best || buckets[k].w > best.w) { best = buckets[k]; } });
                if (!best) { return; }
                var col = [best.r / best.w, best.g / best.w, best.b / best.w].map(Math.round).join(',');
                var st = document.getElementById('asAmbient') || document.head.appendChild(mk('style'));
                st.id = 'asAmbient';
                st.textContent = ':is(.itemDetailPage,#itemDetailPage):not(.hide){background:radial-gradient(120% 85% at 12% 0%,rgba(' + col + ',.34),rgba(' + col + ',0) 62%),linear-gradient(0deg,rgba(' + col + ',.16),rgba(' + col + ',0) 45%)!important;transition:background .8s}' +
                    ':is(.itemDetailPage,#itemDetailPage):not(.hide) .mainDetailButtons .btnPlay{background:rgb(' + col + ')!important;color:#fff!important}' +
                    'html.transparentDocument :is(.itemDetailPage,#itemDetailPage){background:none!important}';
            } catch (e) { /* ignore */ }
        };
        img.src = url;
    }
    function detailLogo(page, item) {
        if (!X.DetailLogo || page.querySelector('.as-detail-logo')) { return; }
        var native = page.querySelector('.detailLogo');
        if (native && native.offsetParent && /url\(/.test(getComputedStyle(native).backgroundImage || '')) { return; }
        var logoId = item.ImageTags && item.ImageTags.Logo ? item.Id : item.ParentLogoItemId;
        var logoTag = item.ImageTags && item.ImageTags.Logo ? item.ImageTags.Logo : item.ParentLogoImageTag;
        if (!logoId || !logoTag) { return; }
        var holder = page.querySelector('.nameContainer') || page.querySelector('.detailPagePrimaryContainer');
        if (!holder) { return; }
        var img = mk('img', 'as-detail-logo'); img.alt = item.Name;
        img.src = imgUrl(logoId, 'Logo', 900, logoTag);
        img.onload = function () {
            if (/^(Movie|Series|BoxSet)$/.test(item.Type)) {
                Array.prototype.forEach.call(holder.querySelectorAll('h1,h2,h3,.itemName,.parentName'), function (h) {
                    if (h.textContent.trim() === (item.Name || '').trim()) { h.classList.add('as-hide-title'); }
                });
            }
        };
        holder.insertBefore(img, holder.firstChild);
    }
    function endsAt(page, item) {
        if (!X.EndsAt || !item.RunTimeTicks) { return; }
        var buttons = page.querySelector('.mainDetailButtons');
        if (!buttons) { return; }
        var pos = (item.UserData && item.UserData.PlaybackPositionTicks) || 0;
        var left = Math.max(0, item.RunTimeTicks - pos) / 1e7;
        var pct = pos ? Math.min(100, pos / item.RunTimeTicks * 100) : 0;
        var end = new Date(Date.now() + left * 1000);
        var html = (pct ? '<span class="as-ea-bar"><i style="width:' + pct.toFixed(1) + '%"></i></span>' + fmtDuration(left) + ' left' : fmtDuration(left)) +
            ' \u00b7 Ends at ' + fmtClock(end);
        var chip = page.querySelector('.as-endsat');
        if (!chip) { chip = mk('div', 'as-endsat'); buttons.parentNode.insertBefore(chip, buttons.nextSibling); }
        if (chip.innerHTML !== html) { chip.innerHTML = html; }
    }
    var lastEnds = 0;
    function detailsTick() {
        var r = route();
        if (r.route !== 'details' || playing() || !uid()) { if (det.id) { clearDetails(); } return; }
        var id = r.params.get('id'), page = detailsPage();
        if (!id || !page) { return; }
        if (det.id !== id) {
            clearDetails();
            det.id = id;
            getItem(id).then(function (item) {
                if (det.id !== id) { return; }
                det.item = item;
                // fresh user data (resume position) for the time remaining
                return api().getItem(uid(), id).then(function (fresh) { det.item = fresh; ambientFrom(fresh); }).catch(function () { ambientFrom(item); });
            });
            return;
        }
        if (!det.item) { return; }
        detailLogo(page, det.item);
        if (Date.now() - lastEnds > 20000 || !page.querySelector('.as-endsat')) { lastEnds = Date.now(); endsAt(page, det.item); }
    }

    // ------------------------------------------------------------------ Playback: pause screen + loading screen
    var pb = { video: null, pauseTimer: null, overlay: null, np: null, loader: null, loaderTimer: null, wasVideo: false };
    function nowPlaying() {
        var a = api();
        return a.getSessions({ deviceId: a.deviceId() }).then(function (s) {
            var np = s && s[0] && s[0].NowPlayingItem;
            if (!np) { return null; }
            return getItem(np.Id).catch(function () { return np; });
        });
    }
    function hidePause() {
        clearTimeout(pb.pauseTimer);
        if (pb.overlay) { pb.overlay.classList.remove('as-on'); }
    }
    function showPause() {
        nowPlaying().then(function (item) {
            if (!item || !pb.video || !pb.video.paused || pb.video.ended) { return; }
            var host = document.querySelector('#videoOsdPage:not(.hide)') || document.body;
            if (!pb.overlay || !pb.overlay.isConnected) { pb.overlay = mk('div'); pb.overlay.id = 'asPause'; host.insertBefore(pb.overlay, host.firstChild); }
            var logoId = item.ImageTags && item.ImageTags.Logo ? item.Id : item.ParentLogoItemId;
            var logoTag = item.ImageTags && item.ImageTags.Logo ? item.ImageTags.Logo : item.ParentLogoImageTag;
            var title = item.SeriesName || item.Name;
            var sub = item.Type === 'Episode' ? ((item.ParentIndexNumber != null ? 'Season ' + item.ParentIndexNumber + ' \u00b7 ' : '') + (item.IndexNumber != null ? 'Episode ' + item.IndexNumber + ' \u2014 ' : '') + item.Name) : '';
            var meta = [item.ProductionYear, item.OfficialRating, item.RunTimeTicks ? fmtDuration(item.RunTimeTicks / 1e7) : ''].filter(Boolean).join(' \u00b7 ');
            pb.overlay.innerHTML = '<div class="as-p-in"><div class="as-p-label">Paused</div>' +
                (logoId && logoTag ? '<img alt="" src="' + imgUrl(logoId, 'Logo', 800, logoTag) + '">' : '<h2>' + esc(title) + '</h2>') +
                (sub ? '<div class="as-p-sub">' + esc(sub) + '</div>' : '') +
                (meta ? '<div class="as-p-meta">' + esc(meta) + '</div>' : '') +
                '<div class="as-p-ov">' + esc(item.Overview || '') + '</div></div>';
            requestAnimationFrame(function () { pb.overlay.classList.add('as-on'); });
        }).catch(function () { /* ignore */ });
    }
    function bindVideo(v) {
        if (v.__asBound) { return; }
        v.__asBound = true;
        v.addEventListener('pause', function () {
            if (!X.PauseScreen) { return; }
            clearTimeout(pb.pauseTimer);
            pb.pauseTimer = setTimeout(function () { if (v.paused && !v.ended && v.currentTime > 0.5) { showPause(); } }, Math.max(1, X.PauseDelay || 3) * 1000);
        });
        ['play', 'playing', 'seeking', 'emptied', 'ended'].forEach(function (ev) { v.addEventListener(ev, hidePause); });
        v.addEventListener('playing', hideLoader);
    }
    function loaderMedia() {
        if (cfg.loader) {
            var src = pageFile('loader', cfg.loader);
            return isVideoUrl(src) ? '<video src="' + src + '" autoplay muted loop playsinline></video>' : '<img alt="" src="' + src + '">';
        }
        if (brand.logo) { return '<img class="as-l-pulse" alt="" src="' + pageFile('logo', brand.logo) + '">'; }
        return '<div class="as-l-name as-l-pulse">' + esc(T.SiteName || 'Loading') + '</div>';
    }
    function showLoader() {
        if (!X.BrandedLoader || pb.loader) { return; }
        pb.loader = mk('div', '', loaderMedia());
        pb.loader.id = 'asLoader';
        document.body.appendChild(pb.loader);
        clearTimeout(pb.loaderTimer);
        pb.loaderTimer = setTimeout(hideLoader, 25000);
    }
    function hideLoader() {
        clearTimeout(pb.loaderTimer);
        var l = pb.loader; if (!l) { return; }
        pb.loader = null;
        l.classList.add('as-out');
        setTimeout(function () { l.remove(); }, 550);
    }
    function playbackTick() {
        var onVideo = route().route === 'video';
        if (onVideo && !pb.wasVideo) {
            var v0 = document.querySelector('.videoPlayerContainer video,video.htmlvideoplayer');
            if (!(v0 && !v0.paused && v0.currentTime > 0)) { showLoader(); }
        }
        if (!onVideo && pb.wasVideo) { hideLoader(); hidePause(); if (pb.overlay) { pb.overlay.remove(); pb.overlay = null; } }
        pb.wasVideo = onVideo;
        // an error or other dialog should never sit behind the loading screen
        if (pb.loader && document.querySelector('.dialogContainer .dialog')) { hideLoader(); }
        var v = document.querySelector('.videoPlayerContainer video,video.htmlvideoplayer');
        if (v) { pb.video = v; bindVideo(v); if (!v.paused && v.currentTime > 0) { hideLoader(); } }
    }

    // ------------------------------------------------------------------ Seasonal themes
    var SEASONS = [
        { id: 'newyear', name: 'New Year', from: [12, 31], to: [1, 2], accent: '#f5c542', fx: 'confetti' },
        { id: 'valentines', name: 'Valentine\u2019s', from: [2, 7], to: [2, 14], accent: '#ff4f8b', fx: 'hearts' },
        { id: 'stpatricks', name: 'St Patrick\u2019s', from: [3, 14], to: [3, 17], accent: '#2ecc71', fx: 'clovers' },
        { id: 'july4', name: 'Fourth of July', from: [7, 1], to: [7, 4], accent: '#e63946', fx: 'stars' },
        { id: 'halloween', name: 'Halloween', from: [10, 1], to: [10, 31], accent: '#ff7a00', fx: 'bats' },
        { id: 'thanksgiving', name: 'Thanksgiving', from: [11, 20], to: [11, 28], accent: '#d9822b', fx: 'leaves' },
        { id: 'christmas', name: 'Christmas', from: [12, 1], to: [12, 26], accent: '#e63946', fx: 'snow' }
    ];
    window.__artworkStudioSeasons = SEASONS;
    function activeSeason() {
        if (!X.Seasonal || X.SeasonMode === 'off') { return null; }
        if (X.SeasonMode && X.SeasonMode !== 'auto') { return SEASONS.filter(function (s) { return s.id === X.SeasonMode; })[0] || null; }
        var d = new Date(), md = (d.getMonth() + 1) * 100 + d.getDate();
        return SEASONS.filter(function (s) {
            var a = s.from[0] * 100 + s.from[1], b = s.to[0] * 100 + s.to[1];
            return a <= b ? (md >= a && md <= b) : (md >= a || md <= b);
        })[0] || null;
    }
    var season = activeSeason();
    if (season && X.SeasonAccent) {
        var sa = season.accent;
        var sStyle = mk('style'); sStyle.id = 'artworkStudioSeason';
        sStyle.textContent = '.button-submit:not([disabled]),.raised.button-submit{background-color:' + sa + '!important;color:' + onColor(sa) + '!important}' +
            '.emby-tab-button-active,.button-link{color:' + sa + '!important}.itemProgressBarForeground{background-color:' + sa + '!important}' +
            '.emby-checkbox:checked+span+.checkboxOutline{background-color:' + sa + '!important;border-color:' + sa + '!important}';
        document.head.appendChild(sStyle);
    }
    var fx = { canvas: null, ctx: null, parts: [], raf: 0, on: false };
    var GLYPHS = { bats: ['\ud83e\udd87'], leaves: ['\ud83c\udf42', '\ud83c\udf41'], hearts: ['\ud83d\udc97', '\u2764\ufe0f'], clovers: ['\u2618\ufe0f'], stars: ['\u2726'] };
    function fxAllowed() {
        if (!season || !X.SeasonEffects || reduceMotion || document.hidden || playing()) { return false; }
        var r = route().route;
        return r === 'home' || !!document.querySelector('#loginPage:not(.hide),.loginPage:not(.hide),.as-login-page:not(.hide)');
    }
    function makePart(w, h, first) {
        var f = season.fx;
        var p = { x: Math.random() * w, y: first ? Math.random() * h : -30, s: 0.6 + Math.random() * 0.9, r: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.04, sway: Math.random() * Math.PI * 2 };
        if (f === 'snow') { p.size = 1.5 + Math.random() * 3; p.vy = 0.4 + Math.random() * 0.9; }
        else if (f === 'confetti') { p.size = 5 + Math.random() * 5; p.vy = 1 + Math.random() * 1.6; p.col = ['#f5c542', '#ff4f8b', '#4fd1ff', '#7c5cff', '#2ecc71'][Math.floor(Math.random() * 5)]; }
        else if (f === 'bats') { p.size = 14 + Math.random() * 12; p.vy = (Math.random() - 0.5) * 0.4; p.vx = 0.8 + Math.random() * 1.4; p.x = first ? Math.random() * w : -40; p.y = Math.random() * h * 0.6; }
        else { p.size = 12 + Math.random() * 10; p.vy = 0.5 + Math.random() * 0.9; }
        p.g = (GLYPHS[f] || [''])[Math.floor(Math.random() * (GLYPHS[f] || ['']).length)];
        return p;
    }
    function fxFrame() {
        if (!fx.on) { return; }
        var c = fx.canvas, g = fx.ctx, w = c.width, h = c.height;
        g.clearRect(0, 0, w, h);
        fx.parts.forEach(function (p, i) {
            p.sway += 0.012;
            if (season.fx === 'bats') { p.x += p.vx; p.y += p.vy + Math.sin(p.sway * 3) * 0.6; }
            else { p.y += p.vy * p.s; p.x += Math.sin(p.sway) * 0.5; }
            p.r += p.vr;
            if (p.y > h + 30 || p.x > w + 50) { fx.parts[i] = makePart(w, h, false); return; }
            g.save(); g.translate(p.x, p.y); g.rotate(season.fx === 'bats' ? 0 : p.r); g.globalAlpha = season.fx === 'snow' ? 0.8 : 0.85;
            if (season.fx === 'snow') { g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, p.size, 0, Math.PI * 2); g.fill(); }
            else if (season.fx === 'confetti') { g.fillStyle = p.col; g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); }
            else if (season.fx === 'stars') { g.fillStyle = Math.random() > 0.5 ? '#ffd257' : '#9ecbff'; g.font = p.size + 'px sans-serif'; g.fillText(p.g, 0, 0); }
            else { g.font = p.size + 'px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; g.fillText(p.g, 0, 0); }
            g.restore();
        });
        fx.raf = requestAnimationFrame(fxFrame);
    }
    function seasonTick() {
        var want = fxAllowed();
        if (want && !fx.on) {
            if (!fx.canvas) { fx.canvas = mk('canvas'); fx.canvas.id = 'asSeason'; fx.ctx = fx.canvas.getContext('2d'); }
            fx.canvas.width = window.innerWidth; fx.canvas.height = window.innerHeight;
            document.body.appendChild(fx.canvas);
            var n = season.fx === 'snow' ? 55 : season.fx === 'bats' ? 9 : season.fx === 'confetti' ? 45 : 22;
            fx.parts = []; for (var i = 0; i < n; i++) { fx.parts.push(makePart(fx.canvas.width, fx.canvas.height, true)); }
            fx.on = true; fx.raf = requestAnimationFrame(fxFrame);
        } else if (!want && fx.on) {
            fx.on = false; cancelAnimationFrame(fx.raf);
            if (fx.canvas) { fx.canvas.remove(); }
        }
    }
    window.addEventListener('resize', function () { if (fx.on && fx.canvas) { fx.canvas.width = window.innerWidth; fx.canvas.height = window.innerHeight; } });

    // ------------------------------------------------------------------ Quick search (Ctrl+K or /)
    var qs = { el: null, sel: 0, rows: [], timer: null, q: '' };
    function closeSearch() { if (qs.el) { qs.el.remove(); qs.el = null; } }
    function openSearch() {
        if (qs.el) { return; }
        qs.el = mk('div', '', '<div class="as-s-box"><input type="search" placeholder="Search movies, shows, episodes\u2026" autocomplete="off" spellcheck="false">' +
            '<div class="as-s-list"></div><div class="as-s-hint">\u2191\u2193 to move \u00b7 Enter to open \u00b7 Esc to close</div></div>');
        qs.el.id = 'asSearch';
        document.body.appendChild(qs.el);
        var input = qs.el.querySelector('input');
        input.focus();
        qs.el.addEventListener('mousedown', function (e) { if (e.target === qs.el) { closeSearch(); } });
        input.addEventListener('input', function () { clearTimeout(qs.timer); qs.timer = setTimeout(function () { runSearch(input.value.trim()); }, 200); });
        input.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); qs.sel = Math.max(0, Math.min(qs.rows.length - 1, qs.sel + (e.key === 'ArrowDown' ? 1 : -1))); paintSel(); }
            else if (e.key === 'Enter') { e.preventDefault(); pick(qs.sel); }
            else if (e.key === 'Escape') { e.preventDefault(); closeSearch(); }
        });
        qs.el.querySelector('.as-s-list').addEventListener('click', function (e) { var r = e.target.closest('[data-n]'); if (r) { pick(+r.dataset.n); } });
    }
    function paintSel() {
        if (!qs.el) { return; }
        Array.prototype.forEach.call(qs.el.querySelectorAll('.as-s-row'), function (r, n) { r.classList.toggle('sel', n === qs.sel); if (n === qs.sel) { r.scrollIntoView({ block: 'nearest' }); } });
    }
    function pick(n) {
        var r = qs.rows[n]; if (!r) { return; }
        closeSearch();
        if (r.all) { location.hash = '#/search.html?query=' + encodeURIComponent(qs.q); } else { goDetails(r.item.Id, false); }
    }
    function runSearch(q) {
        qs.q = q;
        var list = qs.el && qs.el.querySelector('.as-s-list'); if (!list) { return; }
        if (!q) { list.innerHTML = ''; qs.rows = []; return; }
        api().getItems(uid(), { searchTerm: q, IncludeItemTypes: 'Movie,Series,Episode,BoxSet', Recursive: true, Limit: 12, Fields: 'ProductionYear,PrimaryImageAspectRatio', ImageTypeLimit: 1, EnableImageTypes: 'Primary' }).then(function (res) {
            if (!qs.el || qs.q !== q) { return; }
            var items = res.Items || [];
            qs.rows = items.map(function (it) { return { item: it }; }).concat([{ all: true }]);
            qs.sel = 0;
            var typeName = { Movie: 'Movie', Series: 'Show', Episode: 'Episode', BoxSet: 'Collection' };
            list.innerHTML = items.map(function (it, n) {
                var thumb = it.ImageTags && it.ImageTags.Primary ? imgUrl(it.Id, 'Primary', 120, it.ImageTags.Primary) : '';
                var sub = [typeName[it.Type] || it.Type, it.Type === 'Episode' ? it.SeriesName : it.ProductionYear].filter(Boolean).join(' \u00b7 ');
                return '<div class="as-s-row" data-n="' + n + '"><div class="as-s-thumb"' + (thumb ? ' style="background-image:url(\'' + thumb + '\')"' : '') + '></div><div><b>' + esc(it.Name) + '</b><small>' + esc(sub) + '</small></div></div>';
            }).join('') + '<div class="as-s-row" data-n="' + items.length + '"><div class="as-s-thumb" style="display:flex;align-items:center;justify-content:center">\ud83d\udd0d</div><div><b>All results for \u201c' + esc(q) + '\u201d</b><small>Open the full search page</small></div></div>';
            paintSel();
        }).catch(function () { /* ignore */ });
    }
    if (X.QuickSearch) {
        document.addEventListener('keydown', function (e) {
            if (qs.el || !uid() || playing()) { return; }
            var t = e.target, typing = t && (/^(input|textarea|select)$/i.test(t.tagName) || t.isContentEditable);
            if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); openSearch(); return; }
            if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); openSearch(); }
        });
    }

    // ------------------------------------------------------------------ Scheduled announcements
    function annActive(a) {
        if (!a || !a.Text) { return false; }
        var now = Date.now();
        var s = a.Start ? Date.parse(a.Start) : NaN, e = a.End ? Date.parse(a.End) : NaN;
        if (!isNaN(s) && now < s) { return false; }
        if (!isNaN(e) && now > e) { return false; }
        return true;
    }
    var ANN = { info: '#1e6fd9', success: '#2e9d57', warning: '#c98a14', accent: ACCENT };
    function linkify(el, text) {
        var re = /(https?:\/\/[^\s<]+)/g, last = 0, m;
        while ((m = re.exec(text))) {
            el.appendChild(document.createTextNode(text.substring(last, m.index)));
            var a = document.createElement('a'); a.href = m[1]; a.target = '_blank'; a.rel = 'noopener'; a.textContent = m[1];
            el.appendChild(a); last = m.index + m[1].length;
        }
        el.appendChild(document.createTextNode(text.substring(last)));
    }
    function announceTick() {
        var list = X.Announcements || [];
        if (!list.length || route().route !== 'home') { return; }
        var c = document.querySelector('.page:not(.hide) .homeSectionsContainer');
        if (!c) { return; }
        list.forEach(function (a) {
            var key = 'as-sched-' + hashStr(a.Text + '|' + a.Start + '|' + a.End);
            var node = c.querySelector('[data-as-key="' + key + '"]');
            var dismissed = false; try { dismissed = a.Dismissible && localStorage.getItem(key) === '1'; } catch (e) { /* ignore */ }
            if (!annActive(a) || dismissed) { if (node) { node.remove(); } return; }
            if (node) { return; }
            node = mk('div', 'as-announce as-sched');
            node.setAttribute('data-as-key', key);
            node.style.background = ANN[a.Style] || ANN.info;
            var txt = mk('div', 'as-announce-text'); linkify(txt, a.Text); node.appendChild(txt);
            if (a.Dismissible) {
                var x = mk('button'); x.type = 'button'; x.title = 'Dismiss'; x.textContent = '\u2715';
                x.onclick = function () { try { localStorage.setItem(key, '1'); } catch (e) { /* ignore */ } node.remove(); };
                node.appendChild(x);
            }
            var sp = c.querySelector('#asSpotlight');
            c.insertBefore(node, sp ? sp.nextSibling : c.firstChild);
        });
    }

    // ------------------------------------------------------------------ main loop
    function tick() {
        try { spotlightTick(); } catch (e) { /* keep going */ }
        try { autoplayTick(); } catch (e) { /* keep going */ }
        try { surpriseTick(); } catch (e) { /* keep going */ }
        try { detailsTick(); } catch (e) { /* keep going */ }
        try { playbackTick(); } catch (e) { /* keep going */ }
        try { seasonTick(); } catch (e) { /* keep going */ }
        try { announceTick(); } catch (e) { /* keep going */ }
        try { if (!playing()) { scanCards(); } } catch (e) { /* keep going */ }
        if (playing()) { closeHover(); closeSurprise(); }
    }
    window.addEventListener('hashchange', function () { closeHover(); closeSurprise(); setTimeout(tick, 60); });
    document.addEventListener('viewshow', function () { setTimeout(tick, 60); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) { stopSpotTrailer(); } seasonTick(); });
    setInterval(tick, 700);
    tick();
})();
