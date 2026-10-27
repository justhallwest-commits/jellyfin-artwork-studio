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
    // Black text on light accents (e.g. white / pastel), white text otherwise
    function onAccent(h) {
        var c = hexToRgb(h).split(',').map(function (v) { v = v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
        return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) > 0.5 ? '#000' : '#fff';
    }
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
            '.button-submit:not([disabled]),.raised.button-submit,.emby-button.button-submit{background-color:' + accent + '!important;color:' + onAccent(accent) + '!important}' +
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

    // Profile picture / icon at the top right of the top bar
    if (t.HeaderUserSize > 0) {
        var hu = Math.min(5, Math.max(0.8, t.HeaderUserSize));
        css.push('.skinHeader .headerUserButton{width:auto!important;height:auto!important;min-width:0!important;padding:.25em!important;overflow:visible!important}' +
            '.skinHeader .headerUserButton>div,.skinHeader .headerUserButton>.headerUserButtonRound,.skinHeader .headerUserButton>img{width:' + hu + 'em!important;height:' + hu + 'em!important;' +
            'min-width:' + hu + 'em!important;background-size:cover!important;background-position:center!important;border-radius:50%!important;margin:0!important;padding:0!important;font-size:1em!important}' +
            '.skinHeader .headerUserButton>.material-icons,.skinHeader .headerUserButton>span{font-size:' + hu + 'em!important;width:auto!important;height:auto!important}' +
            '.skinHeader .headerRight{align-items:center!important}');
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
    // Home screen library covers ("My Media")
    var libSel = ['CollectionFolder', 'UserView', 'Folder', 'ManualPlaylistsFolder'].map(function (ty) { return '.homeSectionsContainer .card[data-type="' + ty + '"]'; });
    function libCss(suffix, body) { return libSel.map(function (x) { return x + suffix; }).join(',') + '{' + body + '}'; }
    if (t.LibraryCardSize > 0) {
        css.push(libCss('', 'width:clamp(110px,' + Math.min(95, t.LibraryCardSize) + 'vw,95vw)!important;max-width:none!important;flex:0 0 auto!important'));
    }
    var shapes = { wide: 56.25, ultrawide: 42.86, square: 100, poster: 150 };
    if (shapes[t.LibraryCardShape]) {
        css.push(libCss(' .cardPadder', 'padding-bottom:' + shapes[t.LibraryCardShape] + '%!important'));
        css.push(libCss(' .cardImageContainer', 'background-size:cover!important;background-position:center!important'));
    }
    if (t.LibraryHideNames) { css.push(libCss(' .cardFooter', 'display:none!important')); }

    if (t.BackdropBlur > 0) {
        // Page backgrounds (login, home, libraries); movie / show backdrops only when asked
        css.push('#asLibBackdrop>div,#asLoginSplit>div,.as-loginbg::before' + (t.BlurItemBackdrops ? ',.backdropImage' : '') +
            '{filter:blur(' + Math.min(40, t.BackdropBlur) + 'px);transform:scale(1.08)}');
    }

    // Login page
    var lh = t.LoginLogoHeight > 0 ? Math.min(30, Math.max(1, t.LoginLogoHeight)) : 6;
    css.push('.as-login-brand{text-align:center;margin:1.5em auto 1em;max-width:min(92vw,' + Math.max(30, lh * 4) + 'em)}' +
        '.as-login-brand img{height:' + lh + 'em;max-height:40vh;max-width:min(90vw,' + (lh * 6) + 'em);width:auto;object-fit:contain;display:block;margin:0 auto .8em}' +
        '.as-login-brand p{margin:.3em 0;font-size:1.05em;opacity:.9;white-space:pre-line}');
    // .as-login-box is added to the column that holds the whole sign-in window
    var B = '.as-login-box';
    var boxW = t.LoginBoxWidth > 0 ? Math.min(70, Math.max(18, t.LoginBoxWidth)) : ((t.LoginTidy !== false || t.LoginGlass) ? 30 : 0);
    if (boxW) { css.push(B + '{max-width:min(94vw,' + boxW + 'em)!important;margin-left:auto!important;margin-right:auto!important;box-sizing:border-box}'); }
    if (t.LoginTextSize && t.LoginTextSize !== 100) { css.push(B + '{font-size:' + Math.min(180, Math.max(70, t.LoginTextSize)) + '%}'); }
    if (t.LoginTidy !== false) {
        var gap = t.LoginSpacing > 0 ? Math.min(4, t.LoginSpacing) : 1.3;
        css.push(
            B + ' h1,' + B + ' h2{line-height:1.3!important;margin:.3em 0 .9em!important;text-align:center;white-space:normal!important}' +
            B + ' .inputContainer,' + B + ' .checkboxContainer,' + B + ' .selectContainer{margin:0 0 ' + gap + 'em!important}' +
            B + ' .inputLabel{display:block!important;position:static!important;transform:none!important;line-height:1.35!important;margin:0 0 .4em!important}' +
            B + ' .emby-input{line-height:1.4!important;height:auto!important;padding:.65em .8em!important;box-sizing:border-box}' +
            B + ' .checkboxContainer label{display:flex!important;align-items:center;gap:.4em;line-height:1.35}' +
            B + ' .button-submit:not(.hide),' + B + ' .readOnlyContent .emby-button:not(.hide),' + B + ' .readOnlyContent .raised:not(.hide){display:block!important;width:100%!important;margin:' + (gap * 0.55).toFixed(2) + 'em 0 0!important;line-height:1.3!important;white-space:normal!important}' +
            B + ' .readOnlyContent{margin-top:' + gap + 'em!important}' +
            B + ' .disclaimerContainer,' + B + ' .disclaimer{margin-top:1em;line-height:1.5;white-space:normal}' +
            B + ' .cardText{line-height:1.35!important;white-space:normal!important;overflow:visible!important;height:auto!important;padding:.45em .2em .2em!important;text-align:center}' +
            B + ' .cardFooter{position:static!important}' +
            B + ' #divUsers:not(.hide){display:flex!important;flex-wrap:wrap!important;justify-content:center!important;gap:1em;margin-bottom:.5em}');
    }
    if (t.LoginUserSize > 0) {
        var us = Math.min(24, Math.max(3, t.LoginUserSize));
        css.push(':is(#loginPage,.loginPage,.as-login-page) #divUsers .card{width:' + us + 'em!important;max-width:42vw!important;margin:0!important;flex:0 0 auto}' +
            ':is(#loginPage,.loginPage,.as-login-page) #divUsers .cardImageIcon{font-size:' + (us * 0.45).toFixed(2) + 'em!important}');
        if (t.LoginTidy === false) { css.push(':is(#loginPage,.loginPage,.as-login-page) #divUsers:not(.hide){display:flex!important;flex-wrap:wrap;justify-content:center;gap:1em}'); }
    }
    if (t.LoginUserRound) {
        css.push(':is(#loginPage,.loginPage,.as-login-page) #divUsers .cardScalable,:is(#loginPage,.loginPage,.as-login-page) #divUsers .cardImageContainer,:is(#loginPage,.loginPage,.as-login-page) #divUsers .cardContent,:is(#loginPage,.loginPage,.as-login-page) #divUsers .cardPadder{border-radius:50%!important;overflow:hidden}' +
            ':is(#loginPage,.loginPage,.as-login-page) #divUsers .cardBox{box-shadow:none!important;background:transparent!important}');
    }
    if (t.LoginGlass) {
        css.push(B + '{background:rgba(20,20,20,.58);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border-radius:18px;padding:2em 2.2em!important;border:1px solid rgba(255,255,255,.08);box-shadow:0 20px 60px rgba(0,0,0,.45);margin-top:2em!important;margin-bottom:2em!important}' +
            '@media (max-width:600px){' + B + '{padding:1.3em 1.1em!important}}');
    }
    if (t.HideForgotPassword) { css.push(':is(#loginPage,.loginPage,.as-login-page) .btnForgotPassword{display:none!important}'); }
    if (t.HideQuickConnect) { css.push(':is(#loginPage,.loginPage,.as-login-page) .btnQuick{display:none!important}'); }

    // Announcement
    var annColors = { info: '#1e6fd9', success: '#2e9d57', warning: '#c98a14', accent: accent || '#00a4dc' };
    css.push('.as-announce{display:flex;align-items:center;gap:.8em;margin:1em 3.3% .5em;padding:.85em 1.1em;border-radius:10px;color:#fff;font-size:1.02em;line-height:1.45;box-shadow:0 6px 20px rgba(0,0,0,.25)}' +
        '.as-announce a{color:#fff;text-decoration:underline}.as-announce .as-announce-text{flex:1;white-space:pre-line}' +
        '.as-announce button{background:rgba(255,255,255,.18);border:0;color:#fff;border-radius:50%;width:2em;height:2em;cursor:pointer;font-size:1em;flex:0 0 auto}');

    // Theme preset (style layer that follows the final accent / background colours)
    var presets = window.__artworkStudioPresets;
    if (t.Preset && presets && presets.list[t.Preset]) {
        css.push(presets.css(t.Preset, accent, bg, t.CardRadius, { loginGlass: t.LoginGlass }));
    }

    // ---- Split-screen login: the sign-in page becomes a solid panel, and the image is shown by our
    // own element (#asLoginSplit) on the other side, fading into the panel colour.
    var splitMode = /^split/.test(t.LoginLayout || '');
    if (splitMode) {
        var right = t.LoginLayout === 'split-right';
        var sw = Math.min(70, Math.max(25, t.LoginSplitWidth || 38));
        var panel = bg || (presets && t.Preset && presets.list[t.Preset] ? presets.list[t.Preset].settings.BackgroundColor : '') || '#0a0a0a';
        var pr = hexToRgb(panel), ac = accent || '#00a4dc', acr = hexToRgb(ac);
        var muted = (presets && t.Preset && presets.list[t.Preset]) ? presets.list[t.Preset].style.muted : '#9a9a9a';
        var dimA = cfg.dim == null ? 0.45 : cfg.dim / 100;
        // :is() takes the specificity of its strongest argument, so this matches by our own class
        // but out-ranks rules from other themes that target #loginPage.
        var P = ':is(.as-login-page,#asLogin#asLogin#asLogin).as-login-split:not(.hide)', SB = P + ' .as-login-box';
        var side = right ? 'right' : 'left', other = right ? 'left' : 'right';
        var panelW = 'min(100vw,max(380px,' + sw + 'vw))';
        var fade = Math.min(60, Math.max(4, t.LoginFadeWidth || 24)) + 'vw';
        var maskDir = right ? '270deg' : '90deg';
        css.push(
            // image side
            '#asLoginSplit{position:fixed;top:0;bottom:0;' + side + ':calc(' + panelW + ' - ' + fade + ');' + other + ':0;z-index:2;pointer-events:none;overflow:hidden;background:rgb(' + pr + ');' +
                '-webkit-mask-image:linear-gradient(' + maskDir + ',transparent 0,rgba(0,0,0,.04) calc(var(--as-fade,' + fade + ') * .12),rgba(0,0,0,.14) calc(var(--as-fade,' + fade + ') * .26),rgba(0,0,0,.32) calc(var(--as-fade,' + fade + ') * .42),rgba(0,0,0,.55) calc(var(--as-fade,' + fade + ') * .58),rgba(0,0,0,.78) calc(var(--as-fade,' + fade + ') * .74),rgba(0,0,0,.93) calc(var(--as-fade,' + fade + ') * .88),#000 var(--as-fade,' + fade + '));mask-image:linear-gradient(' + maskDir + ',transparent 0,rgba(0,0,0,.04) calc(var(--as-fade,' + fade + ') * .12),rgba(0,0,0,.14) calc(var(--as-fade,' + fade + ') * .26),rgba(0,0,0,.32) calc(var(--as-fade,' + fade + ') * .42),rgba(0,0,0,.55) calc(var(--as-fade,' + fade + ') * .58),rgba(0,0,0,.78) calc(var(--as-fade,' + fade + ') * .74),rgba(0,0,0,.93) calc(var(--as-fade,' + fade + ') * .88),#000 var(--as-fade,' + fade + '))}' +
            '#asLoginSplit>div{position:absolute;top:0;left:0;right:0;bottom:0;background-size:cover;background-position:center;opacity:0;transition:opacity 1.2s ease}' +
            '#asLoginSplit>div.as-on{opacity:1}' +
            '#asLoginSplit::after{content:"";position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,' + dimA + ')}' +
            'body.as-split-login #asLibBackdrop{display:none!important}' +
            '.as-login-split.as-loginbg::before,.as-login-split.as-loginbg::after{display:none!important}' +
            // the sign-in page itself is the panel
            P + '{width:' + panelW + '!important;max-width:100vw!important;min-height:100vh;min-height:100dvh;box-sizing:border-box!important;margin:0' + (right ? ' 0 0 auto' : '') + '!important;' +
                (right ? 'left:auto!important;right:0!important;' : 'left:0!important;right:auto!important;') +
                'padding:3em clamp(1.5em,4.5vw,5em)!important;display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:flex-start!important;' +
                'background:rgb(' + pr + ')!important;background-image:none!important;overflow-y:auto;text-align:left!important;border:0!important;box-shadow:none!important;transform:none!important}' +
            'body.as-split-login,body.as-split-login .backgroundContainer{background-color:rgb(' + pr + ')!important}' +
            // leftover decorations from other themes: extra text / splash images drawn with ::before/::after
            P + '::before,' + P + '::after{content:none!important;display:none!important;background:none!important}' +
            P + ' :not(.checkboxOutline):not(.as-login-kicker)::before,' + P + ' :not(.checkboxOutline):not(.as-login-kicker)::after{content:none!important;background-image:none!important}' +
            // splash images other themes put behind the whole sign-in screen
            'html:has(.as-login-split:not(.hide)),html:has(.as-login-split:not(.hide)) body,html:has(.as-login-split:not(.hide)) .backgroundContainer,html:has(.as-login-split:not(.hide)) .backdropContainer,html:has(.as-login-split:not(.hide)) .mainAnimatedPages,html:has(.as-login-split:not(.hide)) .skinBody{background-image:none!important;background-color:rgb(' + pr + ')!important}' +
            'html:has(.as-login-split:not(.hide)) body::before,html:has(.as-login-split:not(.hide)) body::after,html:has(.as-login-split:not(.hide)) .backgroundContainer::before,html:has(.as-login-split:not(.hide)) .backgroundContainer::after{background-image:none!important;content:none!important}' +
            // everything inside lines up in one column, whatever the page is built from
            P + '>*{width:100%!important;max-width:30em!important;margin-left:0!important;margin-right:0!important;padding-left:0!important;padding-right:0!important;box-sizing:border-box;position:static!important;transform:none!important;flex:none!important;float:none!important}' +
            P + ' .padded-left,' + P + ' .padded-right{padding-left:0!important;padding-right:0!important}' +
            P + ' .margin-auto-y{margin-top:0!important;margin-bottom:0!important}' +
            P + ' form,' + P + ' form>div,' + P + ' .manualLoginForm,' + P + ' .visualLoginForm,' + P + ' .visualLoginForm>div,' + P + ' .readOnlyContent,' + P + ' .readOnlyContent>div,' + P + ' .padded-bottom-page{max-width:none!important;width:100%!important;margin-left:0!important;margin-right:0!important;padding-left:0!important;padding-right:0!important;box-sizing:border-box}' +
            P + ' .as-login-box{width:100%!important;max-width:30em!important;min-height:0!important;margin:0!important;padding:0!important;background:none!important;border:0!important;border-radius:0!important;box-shadow:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}' +
            P + ' img{max-width:100%}' +
            P + ' h1 img,' + P + ' h2 img{display:block!important;margin:0 0 .6em!important;position:static!important}' +
            // brand block always stacks above the heading
            P + ' .as-login-brand{display:block!important;width:100%;text-align:left;margin:0 0 1.6em!important;flex:none}' +
            P + ' .as-login-brand img{display:block;margin:0 0 .9em!important;height:' + (t.LoginLogoHeight > 0 ? Math.min(30, t.LoginLogoHeight) : 3.5) + 'em;width:auto;max-width:100%;object-fit:contain;object-position:left center}' +
            P + ' .as-login-brand p{margin:.2em 0 0;line-height:1.5}' +
            '.as-login-kicker{display:flex;align-items:center;gap:.9em;font-size:.72em;font-weight:700;letter-spacing:.22em;text-transform:uppercase;margin:0 0 1.4em}' +
            '.as-login-kicker i{display:block;width:1.9em;height:2px;background:' + ac + '}' +
            // headings, labels, inputs
            P + ' h1,' + P + ' h2{display:block;text-align:left!important;font-size:1.55em!important;font-weight:700!important;line-height:1.3!important;margin:0 0 1.1em!important;white-space:normal!important}' +
            P + ' .inputContainer{margin:0 0 1.3em!important}' +
            P + ' .inputLabel{display:block!important;position:static!important;transform:none!important;text-transform:uppercase;font-size:.72em!important;letter-spacing:.12em;font-weight:600;line-height:1.4!important;color:' + muted + '!important;margin:0 0 .55em!important}' +
            P + ' .emby-input{width:100%!important;box-sizing:border-box;background:rgba(255,255,255,.035)!important;border:1px solid rgba(255,255,255,.12)!important;border-radius:12px!important;padding:.85em 1em!important;font-size:1.05em;line-height:1.4!important;height:auto!important}' +
            P + ' .emby-input:focus{border-color:' + ac + '!important;box-shadow:0 0 0 3px rgba(' + acr + ',.18)}' +
            // "Remember me" as a switch
            P + ' .checkboxContainer{margin:.2em 0 .4em!important}' +
            P + ' .emby-checkbox-label{position:relative;padding-left:3.3em!important;min-height:1.6em;display:flex!important;align-items:center;font-size:.9em;line-height:1.4}' +
            P + ' .checkboxOutline{width:2.5em!important;height:1.35em!important;border-radius:1em!important;top:50%!important;left:0!important;transform:translateY(-50%);border:0!important;background:rgba(255,255,255,.18)!important;transition:background .2s}' +
            P + ' .checkboxOutline .checkboxIcon{display:none!important}' +
            P + ' .checkboxOutline::after{content:"";position:absolute;top:.17em;left:.17em;width:1em;height:1em;border-radius:50%;background:#fff;transition:left .2s}' +
            P + ' .emby-checkbox:checked+span+.checkboxOutline{background:' + ac + '!important}' +
            P + ' .emby-checkbox:checked+span+.checkboxOutline::after{left:1.33em}' +
            // buttons (only ones Jellyfin is showing: .hide stays hidden)
            P + ' .button-submit:not(.hide){display:block!important;border-radius:999px!important;padding:.95em 1em!important;font-weight:700!important;width:100%!important;margin:1.2em 0 0!important;box-shadow:0 10px 26px rgba(' + acr + ',.35)!important}' +
            P + ' .raised:not(.button-submit):not(.btnForgotPassword):not(.hide){display:block!important;background:transparent!important;border:1px solid rgba(255,255,255,.25)!important;border-radius:999px!important;padding:.9em 1em!important;width:100%!important;font-weight:600;margin:.9em 0 0!important;line-height:1.3!important}' +
            P + ' .btnForgotPassword:not(.hide){display:block!important;background:none!important;border:0!important;border-top:1px solid rgba(255,255,255,.09)!important;border-radius:0!important;box-shadow:none!important;width:100%!important;text-align:left!important;padding:1.3em 0 0!important;margin:1.4em 0 0!important;font-size:.82em!important;font-weight:400!important;color:' + muted + '!important}' +
            // user pictures ("Who's watching?")
            P + ' .visualLoginForm:not(.hide){display:block!important}' +
            P + ' #divUsers:not(.hide){display:flex!important;flex-wrap:wrap!important;justify-content:flex-start!important;align-items:flex-start!important;gap:1.2em!important;width:100%!important;margin:0 0 1em!important;padding:0!important}' +
            P + ' #divUsers .card{width:' + (t.LoginUserSize > 0 ? Math.min(24, t.LoginUserSize) : 7.5) + 'em!important;max-width:42%!important;flex:0 0 auto!important;margin:0!important;padding:0!important;position:relative!important}' +
            P + ' #divUsers .cardBox,' + P + ' #divUsers .cardScalable{position:relative!important;margin:0!important}' +
            P + ' #divUsers .cardPadder{display:block!important;padding-bottom:100%!important}' +
            P + ' #divUsers .cardImageContainer,' + P + ' #divUsers .cardContent{position:absolute!important;top:0;left:0;right:0;bottom:0;display:flex!important;align-items:center;justify-content:center;background-size:cover!important;background-position:center!important}' +
            P + ' #divUsers .cardText{text-align:center!important}' +
            // phones: the image becomes a banner across the top
            '@media (max-width:820px){#asLoginSplit{left:0!important;right:0!important;bottom:auto!important;height:34vh;-webkit-mask-image:linear-gradient(180deg,#000 55%,transparent);mask-image:linear-gradient(180deg,#000 55%,transparent)}' +
                P + '{width:100%!important;padding-top:calc(30vh + 1em)!important;justify-content:flex-start!important}}');
    }

    // Never reveal parts of the login page that Jellyfin has hidden
    css.push(':is(#loginPage,.loginPage,.as-login-page,#asLogin#asLogin#asLogin#asLogin) .hide.hide.hide.hide.hide.hide{display:none!important}');

    if (t.CustomCss) { css.push(t.CustomCss); }

    var style = document.createElement('style');
    style.id = 'artworkStudioTheme';
    style.textContent = css.join('\n');
    document.head.appendChild(style);

    // One request per font, so a font with a single weight (e.g. Bebas Neue) can't break the others
    var SINGLE_WEIGHT = ['bebas neue', 'anton'];
    fonts.filter(function (f, i) { return fonts.indexOf(f) === i; }).forEach(function (f) {
        var name = f.trim();
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(name).replace(/%20/g, '+') +
            (SINGLE_WEIGHT.indexOf(name.toLowerCase()) >= 0 ? '' : ':wght@300;400;500;600;700;800') + '&display=swap';
        document.head.appendChild(link);
    });

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
    // The visible sign-in page, whatever it is built from
    function findLoginPage() {
        var p = document.querySelector('#loginPage:not(.hide),.loginPage:not(.hide)');
        if (p) { return p; }
        var f = document.querySelector('.manualLoginForm,#divUsers,.visualLoginForm');
        var pg = f && f.closest('.page,[data-role="page"]');
        return pg && !pg.classList.contains('hide') && pg.offsetParent !== null ? pg : null;
    }
    function loginBrand() {
        var page = findLoginPage();
        if (!page) { return; }
        if (!page.classList.contains('as-login-page')) { page.classList.add('as-login-page'); }
        // The column that holds the sign-in forms: walk up from the form to the page's direct child
        var holder = page.querySelector('.manualLoginForm,.visualLoginForm');
        while (holder && holder.parentElement && holder.parentElement !== page) { holder = holder.parentElement; }
        if (!holder || holder === page) { holder = page.querySelector('.padded-left') || page.firstElementChild || page; }
        Array.prototype.forEach.call(page.querySelectorAll('.as-login-box'), function (el) { if (el !== holder) { el.classList.remove('as-login-box'); } });
        if (!holder.classList.contains('as-login-box')) { holder.classList.add('as-login-box'); }
        var split = /^split/.test(t.LoginLayout || '');
        if (split && !page.classList.contains('as-login-split')) { page.classList.add('as-login-split'); }
        var kicker = split && !loginLogo && t.SiteName;
        if (!loginLogo && !t.LoginMessage && !kicker) { return; }
        var existing = page.querySelector('.as-login-brand');
        if (existing) {
            if (existing.parentElement !== holder) { holder.insertBefore(existing, holder.firstChild); }
            return;
        }
        var box = document.createElement('div');
        box.className = 'as-login-brand';
        if (kicker) {
            var k = document.createElement('div');
            k.className = 'as-login-kicker';
            k.appendChild(document.createElement('i'));
            k.appendChild(document.createTextNode(t.SiteName));
            box.appendChild(k);
        }
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
