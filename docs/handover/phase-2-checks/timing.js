const { chromium } = require('playwright');
const B = 'http://localhost:3123';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await p.goto(B + '/prototype', { waitUntil: 'networkidle' });
  const nav = async (name, re) => { const t0 = Date.now(); await p.locator('.pt-tabs').getByRole('link', { name }).click(); await p.waitForURL(re); await p.locator('main h1').first().waitFor(); return Date.now() - t0; };
  const res = {};
  for (let r = 0; r < 3; r++) for (const [n, re] of [['Shoots', /shoots$/], ['Products', /products$/], ['You', /you$/], ['Home', /prototype$/]]) (res[n] ||= []).push(await nav(n, re));
  const tap = [];
  await p.goto(B + '/prototype/create?step=shoot&saved=1', { waitUntil: 'networkidle' });
  for (const name of [/Studio photos/, /Model & everyday use/, /Creative campaign/, /Studio photos/]) tap.push(await p.evaluate(async (src) => { const re = new RegExp(src); const el = [...document.querySelectorAll('[role=radio]')].find(e => re.test(e.textContent)); const t0 = performance.now(); el.click(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); return +(performance.now() - t0).toFixed(1); }, name.source));
  // slow network first load
  await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
  const p2 = await ctx.newPage(); const c2 = await ctx.newCDPSession(p2); await c2.send('Network.enable'); await c2.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
  const t0 = Date.now(); await p2.goto(B + '/prototype', { waitUntil: 'domcontentloaded' }); await p2.locator('main h1').waitFor(); const firstH1 = Date.now() - t0;
  const lcp = await p2.evaluate(() => new Promise(r => { new PerformanceObserver(l => { const e = l.getEntries(); r(Math.round(e[e.length - 1].startTime)); }).observe({ type: 'largest-contentful-paint', buffered: true }); setTimeout(() => r(-1), 8000); }));
  const cls = await p2.evaluate(() => new Promise(r => { let v = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) v += e.value; }).observe({ type: 'layout-shift', buffered: true }); setTimeout(() => r(+v.toFixed(3)), 1500); }));
  console.log(JSON.stringify({ cpu: '4x slowdown', tabNavMs: res, tapToPaintMs: tap, slow3g: { firstHeadingMs: firstH1, lcpMs: lcp, cls } }, null, 1));
  await b.close();
})();
