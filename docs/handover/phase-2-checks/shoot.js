const { chromium } = require('playwright');
const OUT = __dirname + '/shots/';
const pages = [
  ['home', '/prototype'], ['home-empty', '/prototype?state=empty'],
  ['capture', '/prototype/create'], ['understand', '/prototype/create?step=understand'],
  ['shoot', '/prototype/create?step=shoot&saved=1'], ['review-smaller', '/prototype/create?step=review&state=smaller'],
  ['review-insufficient', '/prototype/create?step=review&state=insufficient'],
  ['result', '/prototype/shoots/demo-job'], ['you', '/prototype/you'], ['states', '/prototype/states'],
];
(async () => {
  const b = await chromium.launch();
  const widths = (process.argv[2] || '390').split(',').map(Number);
  const errors = [];
  for (const w of widths) {
    const ctx = await b.newContext({ viewport: { width: w, height: w > 800 ? 900 : 844 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(w + ' ' + e.message));
    p.on('console', m => m.type() === 'error' && errors.push(w + ' console ' + m.text()));
    for (const [n, u] of pages) {
      await p.goto('http://localhost:3123' + u, { waitUntil: 'networkidle' });
      await p.waitForTimeout(n === 'understand' ? 1300 : n === 'result' ? 7000 : 400);
      if (n === 'shoot') { await p.getByRole('radio', { name: /Studio photos/ }).click(); await p.waitForTimeout(200); await p.getByRole('radio', { name: /^6/ }).click(); await p.waitForTimeout(200); }
      const ov = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (ov > 0) errors.push(`${w} ${n} horizontal overflow ${ov}px`);
      await p.screenshot({ path: `${OUT}${n}-${w}.png`, fullPage: true });
    }
    await ctx.close();
  }
  console.log(errors.length ? errors.join('\n') : 'no errors');
  await b.close();
})();
