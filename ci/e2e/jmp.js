// The real Jellyfin Media Player desktop app (Flatpak, under Xvfb), driven over its remote
// debugging port: sign-in page with the split layout, Artwork Studio's old-browser CSS off and on.
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const URL = process.env.JF_URL, RES = process.env.RES;
const out = {};
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  let browser = null;
  for (let i = 0; i < 130 && !browser; i++) {
    try { browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null }); } catch (e) { await wait(2000); }
  }
  if (!browser) { throw new Error('could not reach the app on port 9222'); }
  out.version = await browser.version();
  let pages = [];
  for (let i = 0; i < 30; i++) { pages = await browser.pages(); if (pages.length) break; await wait(1000); }
  out.pagesAtStart = pages.map(p => p.url());
  const page = pages.find(p => /^(file|qrc|http)/.test(p.url())) || pages[0];
  await wait(5000);
  await page.screenshot({ path: path.join(RES, 'jmp-00-start.png') });
  let n = 0;
  for (const mode of ['compat-off', 'compat-on']) {
    n++;
    await page.goto(URL + '/web/index.html?run=' + n + 'a', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => { out[mode + '-goto'] = String(e); });
    await wait(3000);
    await page.evaluate(m => { try { localStorage.clear(); sessionStorage.clear(); if (m === 'compat-off') localStorage.setItem('as-no-compat', '1'); } catch (e) { } }, mode);
    await page.goto(URL + '/web/index.html?run=' + n + 'b#/login', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await wait(15000);
    await page.screenshot({ path: path.join(RES, 'jmp-' + mode + '.png') });
    out[mode] = await page.evaluate(() => {
      const r = el => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; };
      const pg = document.querySelector('.as-login-page.as-login-visible');
      const brand = pg && pg.querySelector('.as-login-brand img');
      const head = pg && [...pg.querySelectorAll('h1,h2')].find(h => h.offsetParent);
      let isWorks = null; try { document.querySelector(':is(body)'); isWorks = true; } catch (e) { isWorks = false; }
      let hasWorks = null; try { document.querySelector(':has(body)'); hasWorks = true; } catch (e) { hasWorks = false; }
      return {
        ua: navigator.userAgent, url: location.href, isWorks, hasWorks,
        scriptRan: !!window.__artworkStudioTheme, appHost: !!(window.NativeShell || window.jmpInfo),
        loginPage: !!pg, classes: pg && pg.className, pageBg: pg && getComputedStyle(pg).backgroundColor, page: r(pg), brand: r(brand), heading: r(head),
        imageSide: r(document.getElementById('asLoginSplit')),
        themeCssHasIs: ((document.getElementById('artworkStudioTheme') || {}).textContent || '').indexOf(':is(') >= 0,
        vw: innerWidth, vh: innerHeight
      };
    }).catch(e => ({ error: String(e) }));
  }
  browser.disconnect();
})().catch(e => { out.error = String(e && e.stack || e); }).finally(() => {
  fs.writeFileSync(path.join(RES, 'jmp.json'), JSON.stringify(out, null, 2));
  console.log('[jmp]', JSON.stringify(out).slice(0, 3000));
  process.exit(0);
});
