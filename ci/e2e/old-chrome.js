// The sign-in page in an old Chromium (85, like the Jellyfin Media Player desktop app's engine),
// with the split-screen login layout, once with Artwork Studio's old-browser CSS switched off
// (to show the problem) and once with it on. Results: old-chrome.json, old-chrome-*.png.
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const URL = process.env.JF_URL, TOKEN = process.env.JF_TOKEN, RES = process.env.RES;
const H = { Authorization: `MediaBrowser Client="HallFlix E2E", Device="CI", DeviceId="hallflix-e2e", Version="1.0", Token="${TOKEN}"`, 'Content-Type': 'application/json' };
const out = {};

(async () => {
  const plugins = await (await fetch(URL + '/Plugins', { headers: H })).json();
  const as = plugins.find(p => /Artwork Studio/i.test(p.Name));
  const cfgUrl = URL + '/Plugins/' + as.Id + '/Configuration';
  const original = await (await fetch(cfgUrl, { headers: H })).json();
  const c = JSON.parse(JSON.stringify(original));
  c.Theme.LoginLayout = 'split-left'; c.Theme.LoginGlass = true;
  await fetch(cfgUrl, { method: 'POST', headers: H, body: JSON.stringify(c) });

  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  out.version = await browser.version();
  for (const mode of ['compat-off', 'compat-on']) {
    const ctx = await browser.createIncognitoBrowserContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e.message).slice(0, 200)));
    await page.setViewport({ width: 1920, height: 1080 });
    if (mode === 'compat-off') { await page.evaluateOnNewDocument(() => { try { localStorage.setItem('as-no-compat', '1'); } catch (e) { } }); }
    await page.goto(URL + '/web/#/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 12000));
    await page.screenshot({ path: path.join(RES, 'old-chrome-' + mode + '.png') });
    out[mode] = await page.evaluate(() => {
      const r = el => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; };
      const pg = document.querySelector('.as-login-page.as-login-visible');
      const brand = pg && pg.querySelector('.as-login-brand img');
      const head = pg && [...pg.querySelectorAll('h1,h2')].find(h => h.offsetParent);
      const br = r(brand), hr = r(head);
      const split = document.getElementById('asLoginSplit');
      let supportsIs = null; try { supportsIs = CSS.supports('selector(:is(a))'); } catch (e) { supportsIs = 'error'; }
      return {
        supportsIs,
        loginPage: !!pg, splitClass: !!(pg && pg.classList.contains('as-login-split')),
        page: r(pg), pageBg: pg && getComputedStyle(pg).backgroundColor,
        brand: br, heading: hr, headingText: head && head.textContent.trim().slice(0, 40),
        logoOverlapsHeading: !!(br && hr && br.y + br.h > hr.y + 2 && hr.y + hr.h > br.y + 2),
        imageSide: r(split),
        bodyLoginClass: document.body.classList.contains('as-login-on'),
        themeCssHasIs: (document.getElementById('artworkStudioTheme') || {}).textContent.indexOf(':is(') >= 0
      };
    });
    out[mode].errors = errors;
    await ctx.close();
  }
  await browser.close();
  await fetch(cfgUrl, { method: 'POST', headers: H, body: JSON.stringify(original) });
  fs.writeFileSync(path.join(RES, 'old-chrome.json'), JSON.stringify(out, null, 2));
  console.log('[old-chrome]', JSON.stringify(out));
})().catch(e => { console.log('[old-chrome] FAILED', e); fs.writeFileSync(path.join(RES, 'old-chrome.json'), JSON.stringify({ error: String(e), ...out }, null, 2)); });
