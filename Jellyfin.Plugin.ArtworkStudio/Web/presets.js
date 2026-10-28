/* Artwork Studio \u2014 theme presets.
 * Fresh recreations of the look of popular community Jellyfin themes, written for Artwork Studio
 * so they work on any Jellyfin version this plugin supports. Presets only style the interface:
 * they never change logos, backdrops, artwork, sizes, announcements or custom CSS.
 *
 * "settings" are copied into the Design form when a preset is chosen (the user can still tweak them).
 * "style" drives the extra CSS below, which follows the user's final accent / background colours,
 * so tinting to match uploaded images carries through the whole theme. */
(function () {
    'use strict';

    var PRESETS = {
        jellyflix: {
            name: 'JellyFlix', credit: 'prayag17',
            desc: 'Streaming-service look: black and red, bold titles, posters that pop on hover.',
            settings: { AccentColor: '#e50914', BackgroundColor: '#141414', HeaderStyle: 'transparent', BodyFont: 'Roboto', HeadingFont: 'Roboto', CardRadius: 4, CardHover: true, BackdropBlur: 0, LoginGlass: true },
            style: { text: '#ffffff', muted: '#b3b3b3', accent2: '#b20710', glass: false, buttons: 'rounded', playWhite: true, titles: 'bold', hover: 'zoom', shadow: true, surfaceLift: 0.06 }
        },
        darkflix: {
            name: 'DarkFlix', credit: 'DevilsDesigns',
            desc: 'A moodier, all-black take on the streaming look with a deep red glow.',
            settings: { AccentColor: '#c11119', BackgroundColor: '#000000', HeaderStyle: 'transparent', BodyFont: 'Inter', HeadingFont: 'Bebas Neue', CardRadius: 2, CardHover: false, BackdropBlur: 0, LoginGlass: true },
            style: { text: '#f5f5f5', muted: '#9a9a9a', accent2: '#7a0a0f', glass: false, buttons: 'square', titles: 'upper', titleScale: 1.35, hover: 'glow', shadow: true, vignette: 0.95, surfaceLift: 0.05 }
        },
        elegantfin: {
            name: 'ElegantFin', credit: 'lscambo13',
            desc: 'Refined and calm: soft glass panels, gentle lavender accents, generous spacing.',
            settings: { AccentColor: '#8b8cf8', BackgroundColor: '#0f1015', HeaderStyle: 'glass', BodyFont: 'Inter', HeadingFont: 'Inter', CardRadius: 12, CardHover: false, BackdropBlur: 6, LoginGlass: true },
            style: { text: '#ececf1', muted: '#a1a3b3', accent2: '#c084fc', glass: true, glassBlur: 18, buttons: 'pill', titles: 'medium', hover: 'lift', shadow: true, spacious: true, surfaceLift: 0.07 }
        },
        neutralfin: {
            name: 'NeutralFin', credit: 'KartoffelChipss',
            desc: 'ElegantFin\u2019s layout in pure black and soft greys \u2014 lets your artwork supply the colour.',
            settings: { AccentColor: '#e5e5e5', BackgroundColor: '#000000', HeaderStyle: 'glass', BodyFont: 'Inter', HeadingFont: 'Inter', CardRadius: 12, CardHover: false, BackdropBlur: 4, LoginGlass: true },
            style: { text: '#f2f2f2', muted: '#9e9e9e', accent2: '#9e9e9e', glass: true, glassBlur: 18, buttons: 'pill', titles: 'medium', hover: 'lift', shadow: true, spacious: true, surfaceLift: 0.08 }
        },
        jamfin: {
            name: 'Jamfin', credit: 'community',
            desc: 'Heavy glassmorphism: frosted translucent panels floating over blurred backdrops.',
            settings: { AccentColor: '#7c9cff', BackgroundColor: '#0b0d1a', HeaderStyle: 'glass', BodyFont: 'Outfit', HeadingFont: 'Outfit', CardRadius: 18, CardHover: false, BackdropBlur: 12, LoginGlass: true },
            style: { text: '#f1f3ff', muted: '#aab0d6', accent2: '#ff7ad9', glass: true, glassBlur: 28, buttons: 'pill', titles: 'gradient', hover: 'glow', shadow: true, ambient: true, surfaceLift: 0.09 }
        },
        betterui: {
            name: 'better-jellyfin-ui', credit: 'community',
            desc: 'iOS-style: large bold titles, rounded everything, soft shadows and smooth motion.',
            settings: { AccentColor: '#0a84ff', BackgroundColor: '#000000', HeaderStyle: 'glass', BodyFont: 'Inter', HeadingFont: 'Inter', CardRadius: 14, CardHover: false, BackdropBlur: 0, LoginGlass: true },
            style: { text: '#ffffff', muted: '#8e8e93', accent2: '#5e5ce6', glass: true, glassBlur: 22, buttons: 'pill', titles: 'large', hover: 'lift', shadow: true, surfaceLift: 0.11 }
        },
        ultrachromic: {
            name: 'Ultrachromic', credit: 'CTalvio',
            desc: 'Cinematic: strong backdrop blur, bold uppercase section headers with an accent bar.',
            settings: { AccentColor: '#b062ff', BackgroundColor: '#0e0e10', HeaderStyle: 'glass', BodyFont: 'Montserrat', HeadingFont: 'Montserrat', CardRadius: 10, CardHover: false, BackdropBlur: 14, LoginGlass: true },
            style: { text: '#f0f0f0', muted: '#a8a8b3', accent2: '#ff5fa2', glass: true, glassBlur: 20, buttons: 'rounded', titles: 'upper-bar', hover: 'lift', shadow: true, surfaceLift: 0.07 }
        },
        monochromic: {
            name: 'Monochromic', credit: 'CTalvio',
            desc: 'Pure black and white, OLED-friendly, thin uppercase type and crisp outlines.',
            settings: { AccentColor: '#ffffff', BackgroundColor: '#000000', HeaderStyle: 'solid', BodyFont: 'Inter', HeadingFont: 'Inter', CardRadius: 6, CardHover: false, BackdropBlur: 0, LoginGlass: false },
            style: { text: '#ffffff', muted: '#8a8a8a', accent2: '#bdbdbd', glass: false, buttons: 'rounded', titles: 'light', hover: 'outline', shadow: false, surfaceLift: 0.05 }
        },
        finimalism: {
            name: 'Finimalism', credit: 'tedhinklater',
            desc: 'Quiet and minimal, tuned for readability: calm blue accent, roomy text, no clutter.',
            settings: { AccentColor: '#6fa8dc', BackgroundColor: '#121316', HeaderStyle: 'solid', BodyFont: 'DM Sans', HeadingFont: 'DM Sans', CardRadius: 6, CardHover: false, BackdropBlur: 0, LoginGlass: false },
            style: { text: '#e8e9eb', muted: '#9ba1a9', accent2: '#9fc5e8', glass: false, buttons: 'rounded', titles: 'medium', hover: 'subtle', shadow: false, spacious: true, readable: true, surfaceLift: 0.05 }
        },
        catppuccin: {
            name: 'Catppuccin', credit: 'catppuccin',
            desc: 'Soft pastel Mocha palette: mauve and pink accents on a gentle dark base.',
            settings: { AccentColor: '#cba6f7', BackgroundColor: '#1e1e2e', HeaderStyle: 'solid', BodyFont: 'Nunito', HeadingFont: 'Nunito', CardRadius: 10, CardHover: false, BackdropBlur: 0, LoginGlass: true },
            style: { text: '#cdd6f4', muted: '#a6adc8', accent2: '#f5c2e7', glass: false, buttons: 'pill', titles: 'gradient', hover: 'lift', shadow: true, surfaceLift: 0.08 }
        },
        scyfin: {
            name: 'Scyfin', credit: 'loof2736',
            desc: 'Seafoam colour scheme with glassy panels and a soft teal glow around posters.',
            settings: { AccentColor: '#4fd1b5', BackgroundColor: '#0b1717', HeaderStyle: 'glass', BodyFont: 'Manrope', HeadingFont: 'Manrope', CardRadius: 8, CardHover: false, BackdropBlur: 6, LoginGlass: true },
            style: { text: '#e6f4f1', muted: '#9cc2ba', accent2: '#7ee8fa', glass: true, glassBlur: 18, buttons: 'rounded', titles: 'bold', hover: 'glow', shadow: true, surfaceLift: 0.07 }
        },
        evergarden: {
            name: 'Evergarden', credit: 'community',
            desc: 'Nature-inspired: sage greens and warm sand tones, rounded and relaxed.',
            settings: { AccentColor: '#a7c080', BackgroundColor: '#131a14', HeaderStyle: 'glass', BodyFont: 'Quicksand', HeadingFont: 'Quicksand', CardRadius: 14, CardHover: false, BackdropBlur: 4, LoginGlass: true },
            style: { text: '#e8eedc', muted: '#a9b79a', accent2: '#dbbc7f', glass: true, glassBlur: 16, buttons: 'pill', titles: 'medium', hover: 'lift', shadow: true, surfaceLift: 0.07 }
        },
        jellyskin: {
            name: 'JellySkin', credit: 'prayag17',
            desc: 'Vibrant but minimal: pink-to-violet gradients, glowing posters, rounded glass.',
            settings: { AccentColor: '#ff4f8b', BackgroundColor: '#0f0c1d', HeaderStyle: 'glass', BodyFont: 'Poppins', HeadingFont: 'Poppins', CardRadius: 16, CardHover: false, BackdropBlur: 6, LoginGlass: true },
            style: { text: '#f4f1ff', muted: '#b4aed3', accent2: '#8b5cf6', glass: true, glassBlur: 20, buttons: 'pill', gradientButtons: true, titles: 'gradient', hover: 'glow', shadow: true, ambient: true, surfaceLift: 0.08 }
        }
    };

    // Which Design settings a preset may change. Everything else (logos, backdrops, sizes,
    // announcement, login message, custom CSS, darkness) is never touched.
    var STYLE_KEYS = ['AccentColor', 'BackgroundColor', 'HeaderStyle', 'BodyFont', 'HeadingFont', 'CardRadius', 'CardHover', 'BackdropBlur', 'LoginGlass'];

    function rgb(hex) {
        hex = String(hex || '#000').replace('#', '');
        if (hex.length === 3) { hex = hex.split('').map(function (c) { return c + c; }).join(''); }
        var n = parseInt(hex.substring(0, 6), 16) || 0;
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    function hex(c) { return '#' + c.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
    function mix(a, b, t) { var x = rgb(a), y = rgb(b); return hex([0, 1, 2].map(function (i) { return x[i] + (y[i] - x[i]) * t; })); }
    function luminance(h) {
        var c = rgb(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    }
    function rgbStr(h) { return rgb(h).join(','); }

    /* Build the preset's CSS. accent / bg are the final colours in use (after any tinting). */
    function presetCss(id, accent, bg, radius, opts) {
        opts = opts || {};
        var p = PRESETS[id];
        if (!p) { return ''; }
        var s = p.style;
        accent = accent || p.settings.AccentColor;
        bg = bg || p.settings.BackgroundColor;
        var R = radius >= 0 ? radius : p.settings.CardRadius;
        var accent2 = s.accent2 || accent;
        var surface = mix(bg, '#ffffff', s.surfaceLift || 0.07);
        var surface2 = mix(bg, '#ffffff', (s.surfaceLift || 0.07) + 0.05);
        var onAccent = luminance(accent) > 0.5 ? '#000000' : '#ffffff';
        var A = rgbStr(accent), B = rgbStr(bg), S = rgbStr(surface);
        var css = [];

        css.push(':root{--as-text:' + s.text + ';--as-muted:' + s.muted + ';--as-surface:' + surface + ';--as-surface-rgb:' + S + ';--as-accent2:' + accent2 + ';--as-bg-rgb:' + B + '}');

        // Text
        css.push('body,.skinHeader,.sectionTitle,.cardText,.itemName,.navMenuOption,.listItemBodyText,.emby-tab-button-active{color:' + s.text + '}' +
            '.cardText-secondary,.secondaryText,.fieldDescription,.itemMiscInfo,.listItemBodyText.secondary,.mediaInfoItem,.emby-tab-button:not(.emby-tab-button-active){color:' + s.muted + '!important}' +
            '::selection{background:rgba(' + A + ',.4)}' +
            '::-webkit-scrollbar-thumb{background:rgba(' + A + ',.35)!important;border-radius:8px}');

        // Surfaces: dialogs, menus, side drawer, inputs
        var surf = s.glass ? 'rgba(' + S + ',.7)' : surface;
        var glassFx = s.glass ? '-webkit-backdrop-filter:blur(' + (s.glassBlur || 18) + 'px) saturate(140%);backdrop-filter:blur(' + (s.glassBlur || 18) + 'px) saturate(140%);' : '';
        css.push('.dialog,.formDialog,.actionSheet,.mainDrawer,.toast,.paper-list,.collapseContent{background-color:' + surf + '!important;' + glassFx + '}' +
            '.dialog:not(.dialog-fullscreen),.actionSheet{border-radius:' + Math.min(24, R + 6) + 'px!important;border:1px solid rgba(255,255,255,.06)}' +
            '.mainDrawer{border-right:1px solid rgba(255,255,255,.06)}' +
            '.emby-input,.emby-textarea,.emby-select-withcolor{background-color:' + (s.glass ? 'rgba(' + rgbStr(surface2) + ',.75)' : surface2) + '!important;border:1px solid rgba(255,255,255,.08)!important;border-radius:' + Math.min(12, Math.max(4, R)) + 'px!important;color:' + s.text + '!important}' +
            '.listItem{border-radius:' + Math.min(12, R) + 'px}');

        // Buttons
        var br = s.buttons === 'pill' ? '999px' : s.buttons === 'square' ? '2px' : Math.min(10, Math.max(4, R)) + 'px';
        css.push('.raised,.emby-button.raised,.button-submit,.button-cancel,.button-alt{border-radius:' + br + '!important}' +
            '.button-submit:not([disabled]),.raised.button-submit{color:' + onAccent + '!important' + (s.gradientButtons ? ';background:linear-gradient(135deg,' + accent + ',' + accent2 + ')!important' : '') + '}' +
            '.raised:not(.button-submit):not(.button-delete){background-color:rgba(' + S + ',.9)!important;color:' + s.text + '!important}');
        if (s.playWhite) {
            css.push('.mainDetailButtons .btnPlay,.detailButton.btnPlay,.btnPlay.raised{background:#fff!important;color:#000!important}');
        }

        // Section titles
        var T = '.sectionTitle-cards,.sectionTitle.sectionTitle-cards,.homeSectionsContainer .sectionTitle';
        var titles = {
            bold: '{font-weight:700!important;letter-spacing:.01em}',
            medium: '{font-weight:500!important;letter-spacing:.01em}',
            large: '{font-weight:800!important;font-size:1.45em!important;letter-spacing:-.01em}',
            upper: '{text-transform:uppercase;letter-spacing:.07em;font-weight:700!important;font-size:' + (s.titleScale || 1.15) + 'em!important}',
            'upper-bar': '{text-transform:uppercase;letter-spacing:.08em;font-weight:800!important;font-size:1.05em!important;border-left:4px solid ' + accent + ';padding-left:.55em!important}',
            light: '{text-transform:uppercase;letter-spacing:.16em;font-weight:300!important;font-size:.95em!important}',
            gradient: '{font-weight:700!important;background:linear-gradient(90deg,' + accent + ',' + accent2 + ');-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}'
        };
        if (titles[s.titles]) { css.push(T + titles[s.titles]); }

        // Posters
        css.push('.cardScalable{transition:transform .22s ease,box-shadow .22s ease,outline-color .22s ease,filter .22s ease}');
        if (s.shadow) { css.push('.cardScalable{box-shadow:0 6px 18px rgba(0,0,0,.45)}'); }
        var hov = {
            lift: '{transform:translateY(-6px);box-shadow:0 16px 34px rgba(0,0,0,.6)}',
            glow: '{box-shadow:0 0 0 2px ' + accent + ',0 12px 34px rgba(' + A + ',.45)}',
            outline: '{outline:2px solid ' + accent + ';outline-offset:3px}',
            subtle: '{filter:brightness(1.12)}'
        }[s.hover];
        if (hov) {
            css.push('@media (hover:hover){.card:hover .cardScalable' + hov + '}');
            css.push('.card:focus .cardScalable,.card.show-focus:focus .cardScalable' + hov);   // TV / keyboard focus
        }

        // Blend with uploaded backdrops: fade the bottom of the image into the theme colour so
        // text stays readable without darkening the whole picture.
        var layers = ['linear-gradient(180deg,rgba(' + B + ',0) 0%,rgba(' + B + ',.25) 45%,rgba(' + B + ',' + (s.vignette || 0.88) + ') 100%)'];
        if (s.ambient) { layers.unshift('radial-gradient(circle at 12% 0%,rgba(' + A + ',.20),transparent 45%)', 'radial-gradient(circle at 95% 100%,rgba(' + rgbStr(accent2) + ',.16),transparent 50%)'); }
        css.push('.backgroundContainer.withBackdrop:not(.backgroundContainer-transparent)::after{content:"";position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;background:' + layers.join(',') + '}');
        css.push('.itemBackdrop::after{content:"";position:absolute;left:0;right:0;bottom:0;height:45%;pointer-events:none;background:linear-gradient(180deg,rgba(' + B + ',0),rgba(' + B + ',.85))}.itemBackdrop{position:relative}');

        // Login window follows the theme surface
        css.push('.as-login-box{color:' + s.text + '}');
        if (opts.loginGlass) {
            css.push('.as-login-box{background:rgba(' + S + ',' + (s.glass ? '.55' : '.82') + ')!important;border-radius:' + Math.min(26, R + 8) + 'px!important}');
        }

        if (s.spacious) { css.push('.verticalSection{margin-bottom:1.6em!important}.sectionTitleContainer{margin-bottom:.4em}'); }
        if (s.readable) { css.push('.overview,.itemOverview,.detail-clamp-text{line-height:1.65!important;max-width:75ch}'); }

        return css.join('\n');
    }

    window.__artworkStudioPresets = { list: PRESETS, styleKeys: STYLE_KEYS, css: presetCss, mix: mix, luminance: luminance };
})();
