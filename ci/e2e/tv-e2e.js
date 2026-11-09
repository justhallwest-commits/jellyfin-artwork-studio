// HallFlix TV interface (/ArtworkStudio/TV/) driven like a TV: 1920x1080, arrow keys, Enter, Back.
// Every step is independent; results go to tv-results.json and tv-*.png.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.JF_URL, USER = process.env.JF_USER, PASS = process.env.JF_PASS, RES = process.env.RES, TOKEN = process.env.JF_TOKEN;
const LAUNCHER = process.env.TV_LAUNCHER;
const R = { steps: {}, console: [], failedRequests: [], requests: [] };
const shot = (p, name) => p.screenshot({ path: path.join(RES, 'tv-' + name + '.png') }).catch(() => {});
async function step(name, fn) {
  try { R.steps[name] = { ok: true, ...(await fn() || {}) }; }
  catch (e) { R.steps[name] = { ok: false, error: String(e && e.message || e).slice(0, 600) }; }
  console.log('[tv]', name, R.steps[name].ok ? 'ok' : 'FAILED ' + R.steps[name].error);
}
function watch(page, tag) {
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') R.console.push(`[${tag}] ${m.type()}: ${m.text().slice(0, 300)}`); });
  page.on('pageerror', e => R.console.push(`[${tag}] pageerror: ${String(e.message).slice(0, 300)}`));
  page.on('response', r => {
    const u = r.url().replace(URL, '');
    if (r.status() >= 400 && !/favicon|\.map$/.test(u)) R.failedRequests.push(`[${tag}] ${r.status()} ${r.request().method()} ${u.slice(0, 160)}`);
    if (/Intros|PlaybackInfo|Sessions\/Playing|\/stream|master\.m3u8|AppConfig/.test(u)) R.requests.push(`[${tag}] ${r.status()} ${r.request().method()} ${u.slice(0, 200)}`);
  });
}
async function api(p) {
  const r = await fetch(URL + p, { headers: { Authorization: `MediaBrowser Client="HallFlix E2E", Device="CI", DeviceId="hallflix-e2e", Version="1.0", Token="${TOKEN}"` } });
  return r.json();
}

(async () => {
  let browser;
  try { browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] }); R.browser = 'chrome'; }
  catch (e) { browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); R.browser = 'chromium (no H.264)'; }
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage(); watch(page, 'tv');
  const key = async (k, n = 1, wait = 450) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await page.waitForTimeout(wait); } };
  const focused = () => page.evaluate(() => { const e = document.querySelector('.focused'); return e ? (e.className.replace(/\s+/g, '.') + ' | ' + (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50)) : null; });

  await step('login', async () => {
    await page.goto(URL + '/ArtworkStudio/TV/?platform=browser', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.hf-login', { timeout: 30000 }); await page.waitForTimeout(3000);
    await shot(page, '01-login');
    const users = await page.locator('.hf-user').count();
    const first = await focused();
    if (users) {
      await key('Enter');
      await page.waitForSelector('#hfPass', { timeout: 10000 }); await page.waitForTimeout(400);
    } else {
      await key('Enter');
      await page.waitForSelector('#hfUser', { timeout: 10000 }); await page.waitForTimeout(400);
      await page.keyboard.type(USER); await key('Enter');
    }
    await page.keyboard.type(PASS); await shot(page, '01b-password'); await key('Enter', 1, 800);
    await page.waitForSelector('.hf-top', { timeout: 30000 }); await page.waitForTimeout(6000);
    return { users, firstFocus: first, title: await page.title() };
  });

  await step('home', async () => {
    await shot(page, '02-home');
    return await page.evaluate(() => {
      const css = getComputedStyle(document.documentElement);
      return {
        spotlight: !!document.querySelector('.hf-spot .info'),
        spotTitle: ((document.querySelector('.hf-spot h1') || {}).textContent) || (document.querySelector('.hf-spot .title-logo') ? 'logo image' : null),
        rows: [...document.querySelectorAll('.hf-row h2')].map(h => h.textContent),
        cards: document.querySelectorAll('.hf-card').length,
        badges: [...document.querySelectorAll('.hf-badges span')].map(b => b.textContent),
        accent: css.getPropertyValue('--accent').trim(), radius: css.getPropertyValue('--radius').trim(),
        logo: !!document.querySelector('.hf-top .logo'), nav: [...document.querySelectorAll('.hf-nav .f')].map(b => b.textContent),
        background: !!document.querySelector('.hf-bg-layer.on')
      };
    });
  });

  await step('dpad', async () => {
    const seq = [await focused()];
    await key('ArrowRight'); seq.push(await focused());
    const spotIdx = () => page.evaluate(() => [...document.querySelectorAll('.hf-dots i')].findIndex(i => i.classList.contains('on')));
    const t1 = await spotIdx();
    await key('ArrowRight', 1, 1500); seq.push(await focused());
    const t2 = await spotIdx();
    await key('ArrowDown'); seq.push(await focused());
    await key('ArrowRight'); seq.push(await focused());
    await key('ArrowDown'); seq.push(await focused());
    await key('ArrowDown'); seq.push(await focused());
    await page.waitForTimeout(600); await shot(page, '03-rows');
    const shift = await page.evaluate(() => document.querySelector('.hf-scroll-inner').getAttribute('data-y'));
    await key('Escape', 1, 800); seq.push(await focused());   // Back on the home screen: to the top
    return { seq, spotlightChangedOnRight: t1 !== t2, scrolledBy: shift };
  });

  await step('details', async () => {
    await page.waitForSelector('.hf-spot .hf-btn.more');
    let f = await focused();
    if (!/more/.test(f || '')) { await key('ArrowRight'); f = await focused(); }
    await key('Enter', 1, 3500);
    await shot(page, '04-details');
    const d = await page.evaluate(() => ({
      title: ((document.querySelector('.hf-details h1') || {}).textContent) || (document.querySelector('.hf-details .title-logo') ? 'logo image' : null),
      buttons: [...document.querySelectorAll('.hf-details .hf-btn')].map(b => b.textContent.trim()),
      chips: [...document.querySelectorAll('.hf-details .hf-chip')].map(b => b.textContent),
      sections: [...document.querySelectorAll('.hf-section h2')].map(h => h.textContent)
    }));
    d.focus = await focused();
    await key('ArrowDown', 2); await shot(page, '04b-details-down'); d.afterDown = await focused();
    await key('ArrowUp', 3);
    return d;
  });

  await step('playback', async () => {
    const f = await focused();
    if (!/primary/.test(f || '')) { await page.locator('.hf-details .hf-btn.primary').click(); } else { await key('Enter', 1, 100); }
    await page.waitForSelector('#hfPlayer.on', { timeout: 10000 });
    await page.waitForTimeout(2500);
    const first = await page.evaluate(() => ({ tag: getComputedStyle(document.querySelector('#hfPlayer .hf-tag')).display !== 'none', title: document.querySelector('#hfPlayer h2').textContent, t: document.querySelector('#hfPlayer video').currentTime, err: (document.querySelector('#hfPlayer video').error || {}).code || null }));
    await shot(page, '05-player-first');
    // wait for the movie itself (pre-roll clip is 4 s)
    let main = null;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      main = await page.evaluate(() => ({ on: document.querySelector('#hfPlayer').classList.contains('on'), tag: getComputedStyle(document.querySelector('#hfPlayer .hf-tag')).display !== 'none', title: document.querySelector('#hfPlayer h2').textContent, t: document.querySelector('#hfPlayer video').currentTime, paused: document.querySelector('#hfPlayer video').paused }));
      if (!main.tag && main.t > 2) { break; }
      if (!main.on) { break; }
    }
    await key('Enter', 1, 800); await shot(page, '06-player-osd');
    await page.waitForTimeout(11000);
    const sessions = await api('/Sessions');
    const mine = sessions.filter(s => s.Client === 'HallFlix TV').map(s => ({ device: s.DeviceName, playing: s.NowPlayingItem && s.NowPlayingItem.Name, method: s.PlayState && s.PlayState.PlayMethod, pos: s.PlayState && s.PlayState.PositionTicks }));
    await key('Escape', 1, 1200);
    if (await page.evaluate(() => document.querySelector('#hfPlayer').classList.contains('on'))) { await key('Escape', 1, 1200); }
    const closed = await page.evaluate(() => !document.querySelector('#hfPlayer').classList.contains('on'));
    return { first, main, sessions: mine, closed, focusAfter: await focused() };
  });

  await step('library', async () => {
    await key('Escape', 1, 1500);   // details → home
    await page.locator('.hf-nav .f', { hasText: 'Movies' }).first().click();
    await page.waitForSelector('.hf-grid .hf-card', { timeout: 15000 }); await page.waitForTimeout(1500);
    await key('ArrowRight'); await key('ArrowDown');
    await shot(page, '07-library');
    return { cards: await page.locator('.hf-grid .hf-card').count(), focus: await focused() };
  });

  await step('search', async () => {
    await key('Escape', 1, 1200);
    await page.locator('.hf-nav .f', { hasText: 'Search' }).first().click();
    await page.waitForSelector('.hf-search input'); await page.waitForTimeout(500);
    await page.keyboard.type('sin'); await page.waitForTimeout(2500);
    await shot(page, '08-search');
    return { results: await page.locator('.hf-screen:last-child .hf-card').count(), rows: await page.evaluate(() => [...document.querySelectorAll('.hf-screen:last-child .hf-row h2')].map(h => h.textContent)), focus: await focused() };
  });

  await step('settings', async () => {
    await page.keyboard.press('Escape'); await page.waitForTimeout(1200);
    await page.locator('.hf-screen:last-child .hf-avatar').click(); await page.waitForTimeout(1200);
    const f = await focused();
    await key('Enter', 1, 800); await shot(page, '09-settings-menu');
    const menu = await page.evaluate(() => [...document.querySelectorAll('#hfOverlay .hf-item')].map(i => i.textContent));
    await key('Escape', 1, 600); await shot(page, '09b-settings');
    return { focusFirst: f, menu, items: await page.evaluate(() => [...document.querySelectorAll('.hf-list .hf-item')].map(i => i.textContent)) };
  });

  // built-in screensaver with the pictures from Artwork Studio → Screensaver
  await step('screensaver', async () => {
    await page.goto(URL + '/ArtworkStudio/TV/?platform=browser', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.hf-top', { timeout: 30000 }); await page.waitForTimeout(3000);
    const cfg = await page.evaluate(() => fetch('../AppConfig').then(r => r.json()).then(c => c.screensaver));
    await page.evaluate(() => window.HallFlix.screensaver());
    await page.waitForSelector('#hfSaver.on', { timeout: 15000 }); await page.waitForTimeout(2500);
    const on = await page.evaluate(() => { const l = document.querySelector('#hfSaver .hf-saver-layer.on'); return { bg: l ? l.style.backgroundImage : null, clock: document.querySelector('#hfSaver .hf-saver-clock').textContent }; });
    await shot(page, '12-screensaver');
    if (!on.bg || !/Backdrops\/screensaver\//.test(on.bg)) { throw new Error('no gallery picture showing: ' + JSON.stringify(on)); }
    await page.waitForTimeout(7000);
    const next = await page.evaluate(() => { const l = document.querySelector('#hfSaver .hf-saver-layer.on'); return l ? l.style.backgroundImage : null; });
    await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
    const closed = await page.evaluate(() => !document.querySelector('#hfSaver') || !document.querySelector('#hfSaver').classList.contains('on'));
    if (!closed) { throw new Error('a button press did not close it'); }
    return { cfg, first: on.bg, second: next, changed: next !== on.bg, clock: on.clock, closed };
  });

  // the LG / Samsung launcher page (as a local file, like on the TV) finding the server and opening the interface
  await step('launcher', async () => {
    if (!LAUNCHER) { throw new Error('no launcher path'); }
    const c = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const p = await c.newPage(); watch(p, 'launcher');
    await p.goto('file://' + LAUNCHER + '?platform=browser&frame=1');
    await p.waitForTimeout(800); await p.screenshot({ path: path.join(RES, 'tv-10-launcher.png') });
    await p.keyboard.type(URL.replace(/^http:\/\//, '')); await p.keyboard.press('Enter');
    await p.waitForSelector('#ui.on', { timeout: 20000 });
    await p.waitForTimeout(5000);
    await p.screenshot({ path: path.join(RES, 'tv-11-launcher-connected.png') });
    const fr = p.frames().find(f => /ArtworkStudio\/TV/.test(f.url()));
    const inside = fr ? await fr.evaluate(() => ({ login: !!document.querySelector('.hf-login'), home: !!document.querySelector('.hf-top'), framed: window.parent !== window })) : null;
    // remote keys pressed while the launcher has focus reach the interface
    await p.evaluate(() => document.body.focus());
    await p.keyboard.press('ArrowRight'); await p.waitForTimeout(500);
    const focusInFrame = fr ? await fr.evaluate(() => { const e = document.querySelector('.focused'); return e ? e.className : null; }) : null;
    const msg = await p.evaluate(() => document.getElementById('msg').textContent);
    await c.close();
    return { frameUrl: fr && fr.url(), inside, focusInFrame, msg };
  });

  await browser.close();
  fs.writeFileSync(path.join(RES, 'tv-results.json'), JSON.stringify(R, null, 2));
  console.log('[tv] wrote tv-results.json');
})();
