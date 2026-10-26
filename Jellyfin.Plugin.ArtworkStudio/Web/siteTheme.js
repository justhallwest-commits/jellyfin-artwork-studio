/* Artwork Studio — site design: logos, favicon, tab title, colours, fonts, cards,
 * backdrop blur, login page, home announcement and custom CSS. */
(function () {
    'use strict';
    if (window.__artworkStudioTheme) { return; }
    window.__artworkStudioTheme = true;

    var cfg = window.__artworkStudioCfg || {};
    var t = cfg.theme || {};
    var brand = cfg.brand || {};
    if (t.Enabled === false) { return; }

    var me = document.currentScript;
    var base = me && me.src ? me.src.replace(/ArtworkStudio\/ClientScript.*$/i, '') : '../';
    function brandUrl(slot, file) { return file ? base + 'ArtworkStudio/Backdrops/' + slot + '/' + encodeURIComponent(file) : null; }
    var logo = brandUrl('logo', brand.logo);
    var loginLogo = brandUrl('loginlogo', brand.loginLogo) || logo;
    var favicon = brandUrl('favicon', brand.favicon);

    function cssString(v) { return '"' + String(v).replace(/["\\\n\r]/g, '') + '"'; }
    function safeColor(v) { return /^#[0-9a-f]{3,8}$/i.test(v || '') ? v : ''; }
    function hexToRgb(h) {
        h = h.replace('#', '');
        if (h.length === 3) { h = h.split('').map(function (c) { return c + c; }).join(''); }
        var n = parseInt(h.substring(0, 6), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(',');
    }

    // ---------------------------------------------------------------- CSS
    var css = [];
    var accent = safeColor(t.AccentColor);
    var bg = safeColor(t.BackgroundColor);

    if (logo) {
        css.push('.pageTitleWithDefaultLogo,.pageTitleWithLogo{background-image:url(' + cssString(logo) + ')!important;background-size:contain!important;background-repeat:no-repeat!important;background-position:left center!important}');
    }
    var logoRule = null;
    if (t.LogoHeight > 0) {
        var h = Math.min(8, Math.max(0.5, t.LogoHeight));
        css.push('.pageTitleWithDefaultLogo,.pageTitleWithLogo{height:' + h + 'em!important;width:' + (h * 5) + 'em!important;max-width:55vw!important;flex-shrink:0}');
        // Once the logo has loaded, size the box to the logo's own shape so it isn't letterboxed
        if (logo) {
            var probe = new Image();
            probe.onload = function () {
                if (!probe.naturalHeight) { return; }
                var w = (h * probe.naturalWidth / probe.naturalHeight).toFixed(2);
                logoRule = logoRule || document.head.appendChild(document.createElement('style'));
                logoRule.textContent = '.pageTitleWithDefaultLogo,.pageTitleWithLogo{width:' + w + 'em!important}';
            };
            probe.src = logo;
        }
    }

    if (accent) {
        var rgb = hexToRgb(accent);
        css.push(':root{--as-accent:' + accent + ';--as-accent-rgb:' + rgb + '}');
        css.push(
            '.button-submit:not([disabled]),.raised.button-submit,.emby-button.button-submit{background-color:' + accent + '!important;color:#fff!important}' +
            '.itemProgressBarForeground,.playedIndicator,.countIndicator,.mdl-slider-background-lower,.sliderBubble,.emby-select-withcolor>option:checked{background-color:' + accent + '!important}' +
            '.emby-checkbox:checked+span+.checkboxOutline{background-color:' + accent + '!important;border-color:' + accent + '!important}' +
            '.emby-checkbox:focus+span+.checkboxOutline{border-color:' + accent + '!important}' +
            '.emby-tab-button-active,.emby-tab-button:focus,.emby-tab-button.emby-button-foreground,.button-link,.paper-icon-button-light:hover:not(:disabled),.navMenuOption-selected,.sectionTitleTextButton:hover,a.button-link{color:' + accent + '!important}' +
            '.navMenuOption-selected{background-color:rgba(' + rgb + ',.2)!important}' +
            '.emby-input:focus,.emby-textarea:focus,.emby-select-withcolor:focus{border-color:' + accent + '!important}' +
            '.mdl-slider::-webkit-slider-thumb{background:' + accent + '!important}.mdl-slider::-moz-range-thumb{background:' + accent + '!important}' +
            '.emby-scroller .card:focus .cardBox,.card.show-focus:focus .cardBox{border-color:' + accent + '!important}' +
            '.progressring-spiner{border-color:' + accent + '!important}');
    }

    if (bg) {
        // Only on <html>: colouring <body> would paint over the backdrop layers
        css.push('html{background-color:' + bg + '!important}.backgroundContainer:not(.withBackdrop){background-color:' + bg + '!important}');
    }

    if (t.HeaderStyle === 'glass') {
        css.push('.skinHeader{background:rgba(' + (bg ? hexToRgb(bg) : '16,16,16') + ',.55)!important;-webkit-backdrop-filter:blur(14px) saturate(140%);backdrop-filter:blur(14px) saturate(140%)}');
    } else if (t.HeaderStyle === 'solid') {
        css.push('.skinHeader{background:' + (bg || '#101010') + '!important}');
    } else if (t.HeaderStyle === 'transparent') {
        css.push('.skinHeader{background:transparent!important;box-shadow:none!important}.skinHeader.semiTransparent{background:linear-gradient(rgba(0,0,0,.6),transparent)!important}');
    }

    var fonts = [];
    if (t.BodyFont) {
        fonts.push(t.BodyFont);
        css.push('html,body,button,input,select,textarea,.emby-button,.emby-input,.emby-select{font-family:' + cssString(t.BodyFont) + ',"Noto Sans",sans-serif!important}');
    }
    if (t.HeadingFont) {
        fonts.push(t.HeadingFont);
        css.push('h1,h2,h3,.sectionTitle,.pageTitle,.itemName,.parentName,.headerTabs .emby-tab-button,.sectionTitle-cards{font-family:' + cssString(t.HeadingFont) + ',"Noto Sans",sans-serif!important}');
    }

    if (t.CardRadius >= 0) {
        var r = Math.min(40, t.CardRadius) + 'px';
        css.push('.cardContent,.cardImageContainer,.cardScalable,.cardOverlayContainer,.cardContent-shadow,.cardImage,.cardPadder{border-radius:' + r + '!important}.cardScalable{overflow:hidden}');
    }
    if (t.CardHover) {
        css.push('@media (hover:hover){.cardScalable{transition:transform .2s ease,box-shadow .2s ease}.card:hover .cardScalable{transform:scale(1.05);box-shadow:0 10px 28px rgba(0,0,0,.55);z-index:2}}');
    }
    if (t.BackdropBlur > 0) {
        css.push('#asLibBackdrop>div,.backdropImage,.as-loginbg::before{filter:blur(' + Math.min(40, t.BackdropBlur) + 'px);transform:scale(1.08)}');
    }

    // Login page
    var lh = t.LoginLogoHeight > 0 ? Math.min(30, Math.max(1, t.LoginLogoHeight)) : 6;
    css.push('.as-login-brand{text-align:center;margin:1.5em auto 1em;max-width:min(92vw,' + Math.max(30, lh * 4) + 'em)}' +
        '.as-login-brand img{height:' + lh + 'em;max-height:40vh;max-width:min(90vw,' + (lh * 6) + 'em);width:auto;object-fit:contain;display:block;margin:0 auto .8em}' +
        '.as-login-brand p{margin:.3em 0;font-size:1.05em;opacity:.9;white-space:pre-line}');
    if (t.LoginGlass) {
        css.push('#loginPage .manualLoginForm,#loginPage .readOnlyContent,.loginPage .manualLoginForm{background:rgba(20,20,20,.55);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border-radius:16px;padding:1.5em!important;border:1px solid rgba(255,255,255,.08);box-shadow:0 20px 60px rgba(0,0,0,.45)}');
    }
    if (t.HideForgotPassword) { css.push('#loginPage .btnForgotPassword,.loginPage .btnForgotPassword{display:none!important}'); }
    if (t.HideQuickConnect) { css.push('#loginPage .btnQuick,.loginPage .btnQuick{display:none!important}'); }

    // Announcement
    var annColors = { info: '#1e6fd9', success: '#2e9d57', warning: '#c98a14', accent: accent || '#00a4dc' };
    css.push('.as-announce{display:flex;align-items:center;gap:.8em;margin:1em 3.3% .5em;padding:.85em 1.1em;border-radius:10px;color:#fff;font-size:1.02em;line-height:1.45;box-shadow:0 6px 20px rgba(0,0,0,.25)}' +
        '.as-announce a{color:#fff;text-decoration:underline}.as-announce .as-announce-text{flex:1;white-space:pre-line}' +
        '.as-announce button{background:rgba(255,255,255,.18);border:0;color:#fff;border-radius:50%;width:2em;height:2em;cursor:pointer;font-size:1em;flex:0 0 auto}');

    if (t.CustomCss) { css.push(t.CustomCss); }

    var style = document.createElement('style');
    style.id = 'artworkStudioTheme';
    style.textContent = css.join('\n');
    document.head.appendChild(style);

    if (fonts.length) {
        var fam = fonts.filter(function (f, i) { return fonts.indexOf(f) === i; })
            .map(function (f) { return 'family=' + encodeURIComponent(f.trim()).replace(/%20/g, '+') + ':wght@400;500;600;700'; }).join('&');
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?' + fam + '&display=swap';
        document.head.appendChild(link);
    }

    // ---------------------------------------------------------------- favicon & tab title
    if (favicon) {
        var setIcon = function () {
            var links = document.querySelectorAll('link[rel~="icon"],link[rel="apple-touch-icon"],link[rel="shortcut icon"]');
            if (!links.length) {
                var l = document.createElement('link'); l.rel = 'icon'; document.head.appendChild(l); links = [l];
            }
            Array.prototype.forEach.call(links, function (l) { if (l.href !== favicon) { l.href = favicon; l.removeAttribute('type'); } });
        };
        setIcon();
        setTimeout(setIcon, 2000);
    }
    if (t.SiteName) {
        var fixTitle = function () {
            var title = document.title || '';
            if (/Jellyfin/.test(title)) { document.title = title.replace(/Jellyfin/g, t.SiteName); }
            else if (!title) { document.title = t.SiteName; }
        };
        fixTitle();
        var titleEl = document.querySelector('title');
        if (titleEl && window.MutationObserver) { new MutationObserver(fixTitle).observe(titleEl, { childList: true, characterData: true, subtree: true }); }
        setInterval(fixTitle, 1500);
        var appName = document.querySelector('meta[name="application-name"],meta[name="apple-mobile-web-app-title"]');
        if (appName) { appName.setAttribute('content', t.SiteName); }
    }

    // ---------------------------------------------------------------- login branding
    function loginBrand() {
        if (!loginLogo && !t.LoginMessage) { return; }
        var page = document.querySelector('#loginPage:not(.hide),.loginPage:not(.hide)');
        if (!page || page.querySelector('.as-login-brand')) { return; }
        var holder = page.querySelector('.padded-left') || page.firstElementChild || page;
        var box = document.createElement('div');
        box.className = 'as-login-brand';
        if (loginLogo) {
            var img = document.createElement('img');
            img.src = loginLogo; img.alt = t.SiteName || '';
            box.appendChild(img);
        }
        if (t.LoginMessage) {
            var p = document.createElement('p');
            p.textContent = t.LoginMessage;
            box.appendChild(p);
        }
        holder.insertBefore(box, holder.firstChild);
    }

    // ---------------------------------------------------------------- home announcement
    function announceKey() {
        var s = t.Announcement || '', h = 0;
        for (var i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
        return 'as-announce-dismissed-' + h;
    }
    function linkify(el, text) {
        var re = /(https?:\/\/[^\s<]+)/g, last = 0, m;
        while ((m = re.exec(text))) {
            el.appendChild(document.createTextNode(text.substring(last, m.index)));
            var a = document.createElement('a'); a.href = m[1]; a.target = '_blank'; a.rel = 'noopener'; a.textContent = m[1];
            el.appendChild(a);
            last = m.index + m[1].length;
        }
        el.appendChild(document.createTextNode(text.substring(last)));
    }
    function announce() {
        if (!t.Announcement) { return; }
        try { if (t.AnnouncementDismissible && localStorage.getItem(announceKey())) { return; } } catch (e) { /* ignore */ }
        var container = document.querySelector('.page:not(.hide) .homeSectionsContainer');
        if (!container || container.querySelector('.as-announce')) { return; }
        var box = document.createElement('div');
        box.className = 'as-announce';
        box.style.background = annColors[t.AnnouncementStyle] || annColors.info;
        var text = document.createElement('div');
        text.className = 'as-announce-text';
        linkify(text, t.Announcement);
        box.appendChild(text);
        if (t.AnnouncementDismissible) {
            var x = document.createElement('button');
            x.type = 'button'; x.title = 'Dismiss'; x.textContent = '\u2715';
            x.onclick = function () {
                try { localStorage.setItem(announceKey(), '1'); } catch (e) { /* ignore */ }
                Array.prototype.forEach.call(document.querySelectorAll('.as-announce'), function (n) { n.remove(); });
            };
            box.appendChild(x);
        }
        container.insertBefore(box, container.firstChild);
    }

    function tick() { loginBrand(); announce(); }
    document.addEventListener('viewshow', function () { setTimeout(tick, 50); });
    window.addEventListener('hashchange', function () { setTimeout(tick, 50); });
    setInterval(tick, 1000);
    tick();
})();
