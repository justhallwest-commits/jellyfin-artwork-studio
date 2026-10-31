// Browser checks against a real Jellyfin 12 server (see run.sh). Every step is independent:
// a failure is recorded in results.json and the run carries on.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.JF_URL, USER = process.env.JF_USER, PASS = process.env.JF_PASS, RES = process.env.RES;
const R = { steps: {}, console: [], failedRequests: [] };
const shot = (p, name) => p.screenshot({ path: path.join(RES, name + '.png') }).catch(() => {});
const save = (name, text) => fs.writeFileSync(path.join(RES, name), text);
async function step(name, fn) {
  try { R.steps[name] = { ok: true, ...(await fn() || {}) }; }
  catch (e) { R.steps[name] = { ok: false, error: String(e && e.message || e).slice(0, 600) }; }
  console.log('[e2e]', name, R.steps[name].ok ? 'ok' : 'FAILED ' + R.steps[name].error);
}

function watch(page, tag) {
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') R.console.push(`[${tag}] ${m.type()}: ${m.text().slice(0, 300)}`); });
  page.on('pageerror', e => R.console.push(`[${tag}] pageerror: ${String(e.message).slice(0, 300)}`));
  page.on('response', r => { const u = r.url(); if (r.status() >= 400 && !/favicon|\.map$/.test(u)) R.failedRequests.push(`[${tag}] ${r.status()} ${r.request().method()} ${u.replace(URL, '').slice(0, 160)}`); });
}

async function login(page) {
  await page.goto(URL + '/web/#/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  // Manual sign-in (the user list may or may not be showing)
  const manual = page.locator('.btnManual:not(.hide)');
  if (await manual.count()) { await manual.first().click().catch(() => {}); await page.waitForTimeout(500); }
  await page.fill('#txtManualName', USER);
  await page.fill('#txtManualPassword', PASS);
  await page.locator('.manualLoginForm .button-submit').click();
  await page.waitForFunction(() => /#\/home/.test(location.hash) || document.querySelector('.homePage'), null, { timeout: 30000 });
  await page.waitForTimeout(6000);
}

const probe = () => {
  const q = s => document.querySelector(s);
  const vis = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const header = q('header.MuiAppBar-root') || q('.MuiAppBar-root') || q('.skinHeader');
  return {
    htmlClass: document.documentElement.className,
    script: !!window.__artworkStudioCfg, themeStyle: !!document.getElementById('artworkStudioTheme'),
    headerKind: header ? (header.classList.contains('skinHeader') ? 'legacy' : 'modern') : 'none',
    headerBg: header ? getComputedStyle(header).backgroundColor + ' / ' + getComputedStyle(header).backdropFilter : null,
    logoShown: (() => {
      const home = q('header.MuiAppBar-root a.MuiButton-root[href="#/"]');
      if (home) return /Backdrops\/logo/.test(getComputedStyle(home, '::before').backgroundImage);
      const l = q('.pageTitleWithDefaultLogo, .pageTitleWithLogo');
      return !!l && vis(l) && /Backdrops\/logo/.test(getComputedStyle(l).backgroundImage);
    })(),
    surprise: vis(q('.as-surprise')), spotlight: vis(q('#asSpotlight')), spotTitle: (q('#asSpotlight .as-spot-logo') || {}).textContent || (q('#asSpotlight .as-spot-logo img') ? 'img' : ''),
    badges: document.querySelectorAll('.asx-badges').length, cards: document.querySelectorAll('.card[data-id]').length,
    avatar: (() => { const a = header && header.querySelector('.MuiAvatar-root, .headerUserButton'); return a ? Math.round(a.getBoundingClientRect().width) : 0; })(),
    blurOverlays: [...document.querySelectorAll('body *')].filter(e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return vis(e) && /blur/.test(s.backdropFilter + s.filter) && r.width > innerWidth * 0.8 && r.height > innerHeight * 0.8; }).map(e => e.tagName + '#' + e.id + '.' + [...e.classList].join('.')).slice(0, 5)
  };
};

(async () => {
  const browser = await chromium.launch();

  // ---------------- default (Modern) layout, desktop
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage(); watch(page, 'desktop');

  await step('login-page', async () => {
    await page.goto(URL + '/web/#/login', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(5000);
    await shot(page, '01-login');
    return await page.evaluate(() => ({
      split: !!document.querySelector('.as-login-split.as-login-visible'), splitImage: !!document.querySelector('#asLoginSplit .as-on'),
      brand: (document.querySelector('.as-login-brand') || {}).textContent || '', disclaimerShown: !!document.querySelector('.disclaimerContainer:not(.hide)')
    }));
  });
  await step('sign-in', async () => { await login(page); return { hash: await page.evaluate(() => location.hash) }; });
  await step('home-modern', async () => { await shot(page, '02-home-modern'); save('header-modern.html', await page.evaluate(() => { const h = document.querySelector('header') || document.querySelector('.skinHeader'); return h ? h.outerHTML : 'none'; })); return await page.evaluate(probe); });

  await step('item-details', async () => {
    const id = await page.evaluate(() => (document.querySelector('.card[data-type=Movie]') || {}).dataset?.id);
    if (!id) throw new Error('no movie card on home');
    await page.goto(URL + '/web/#/details?id=' + id); await page.waitForTimeout(5000);
    await shot(page, '03-details');
    return await page.evaluate(() => ({ title: (document.querySelector('.itemName, h1') || {}).textContent, playBtn: !!document.querySelector('.btnPlay:not(.hide)'), endsAt: !!document.querySelector('.as-endsat') }));
  });

  // ---------------- plugin pages
  const pages = [['artwork-studio', 'ArtworkStudio'], ['preroll', 'Pre-Roll Videos'], ['bulk-metadata', 'BulkMetadata'], ['content-guard', 'Content Guard']];
  for (const [slug, name] of pages) {
    await step('page-' + slug, async () => {
      await page.goto(URL + '/web/#/configurationpage?name=' + encodeURIComponent(name)); await page.waitForTimeout(6000);
      await shot(page, '10-page-' + slug);
      return await page.evaluate(() => {
        const c = document.querySelector('.mainAnimatedPage:not(.hide) .content-primary, .page:not(.hide) .content-primary, [data-role=page]:not(.hide)');
        const blur = [...document.querySelectorAll('body *')].filter(e => /blur/.test(getComputedStyle(e).backdropFilter) && e.getBoundingClientRect().width > innerWidth * 0.6 && e.getBoundingClientRect().height > innerHeight * 0.6).map(e => e.tagName + '#' + e.id);
        return { textLength: (c ? c.innerText : document.body.innerText).length, sample: (c ? c.innerText : '').slice(0, 160).replace(/\s+/g, ' '), blurOverlays: blur };
      });
    });
  }

  await step('artwork-studio-tabs', async () => {
    await page.goto(URL + '/web/#/configurationpage?name=ArtworkStudio'); await page.waitForTimeout(5000);
    const out = {};
    for (const tab of ['browse', 'design', 'extras', 'settings', 'apps', 'help']) {
      await page.click(`.as-tab[data-tab="${tab}"]`).catch(() => {}); await page.waitForTimeout(2500);
      await shot(page, '11-as-' + tab);
      out[tab] = await page.evaluate(t => { const s = document.querySelector(`section[data-section="${t}"]`); return s ? s.innerText.length : -1; }, tab);
    }
    out.browseCards = await page.evaluate(() => document.querySelectorAll('#asGrid .as-card').length);
    return out;
  });

  await step('other-apps-apply', async () => {
    await page.goto(URL + '/web/#/configurationpage?name=ArtworkStudio'); await page.waitForTimeout(5000);
    await page.click('.as-tab[data-tab="apps"]'); await page.waitForTimeout(2500);
    for (const id of ['evSplash', 'evDisclaimer', 'evCss']) { if (!(await page.isChecked('#' + id))) await page.click(`#${id} + i`); }
    await page.click('#evSave'); await page.waitForTimeout(6000);
    await shot(page, '12-other-apps-after-save');
    return await page.evaluate(() => ({ splashState: document.getElementById('evSplashState').textContent, cssState: document.getElementById('evCssState').textContent, devices: [...document.querySelectorAll('#evDevices .as-approw b')].map(b => b.textContent) }));
  });

  await step('home-after-design', async () => {
    await page.goto(URL + '/web/#/home'); await page.reload(); await page.waitForTimeout(7000);
    await shot(page, '04-home-designed');
    return await page.evaluate(probe);
  });
  await ctx.close();

  // ---------------- Legacy desktop layout
  await step('home-legacy', async () => {
    const c = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const p = await c.newPage(); watch(p, 'legacy');
    await p.addInitScript(() => { try { localStorage.setItem('layout', 'desktop-legacy'); } catch (e) {} });
    await login(p); await shot(p, '05-home-legacy');
    save('header-legacy.html', await p.evaluate(() => { const h = document.querySelector('.skinHeader') || document.querySelector('header'); return h ? h.outerHTML.slice(0, 20000) : 'none'; }));
    const r = await p.evaluate(probe); await c.close(); return r;
  });

  // ---------------- TV layout (remote control)
  await step('home-tv', async () => {
    const c = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const p = await c.newPage(); watch(p, 'tv');
    await p.addInitScript(() => { try { localStorage.setItem('layout', 'tv'); } catch (e) {} });
    await login(p); await shot(p, '06-home-tv');
    await p.keyboard.press('ArrowDown'); await p.waitForTimeout(400); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(2500);
    await shot(p, '06b-home-tv-focus');
    const r = await p.evaluate(probe); r.focused = await p.evaluate(() => { const a = document.activeElement; return a ? a.tagName + '.' + [...a.classList].slice(0, 3).join('.') : ''; });
    await c.close(); return r;
  });

  // ---------------- Phone (Modern, mobile)
  await step('home-phone', async () => {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36' });
    const p = await c.newPage(); watch(p, 'phone');
    await p.goto(URL + '/web/#/login'); await p.waitForTimeout(4000); await shot(p, '07-login-phone');
    await login(p); await shot(p, '08-home-phone');
    const r = await p.evaluate(probe); await c.close(); return r;
  });

  await browser.close();
  save('results.json', JSON.stringify(R, null, 2));
  console.log('[e2e] wrote results.json');
})();
