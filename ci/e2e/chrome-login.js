// The same sign-in page in current Chrome, for comparison with the desktop app (jmp.js)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await p.goto(process.env.JF_URL + '/web/index.html#/login'); await p.waitForTimeout(12000);
  await p.screenshot({ path: path.join(process.env.RES, 'jmp-chrome.png') });
  await b.close();
})().catch(e => console.log('[chrome-login]', e));
