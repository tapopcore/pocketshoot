const { chromium, devices } = require('playwright');
const sharp = require('/home/claude/ps-work/node_modules/sharp');
(async () => {
  const S = process.argv[2];
  // Synthetic stand-in image (a soft gradient), not a real child's photo.
  await sharp({ create: { width: 1200, height: 1500, channels: 3, background: '#d9b8a4' } }).composite([{ input: Buffer.from('<svg width="1200" height="1500"><ellipse cx="600" cy="700" rx="330" ry="400" fill="#f1d3c2"/></svg>') }]).jpeg().toFile(S + '/standin.jpg');
  const b = await chromium.launch(); const out = []; const ok = (n, c) => out.push((c ? 'PASS ' : 'FAIL ') + n);
  for (const [label, vp] of [['360', { width: 360, height: 740 }], ['390', { width: 390, height: 844 }], ['1280', { width: 1280, height: 800 }]]) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1 }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:3125/dev/baby'); await p.waitForSelector('.bb-page');
    ok(label + ' sandbox tag', (await p.textContent('.bb-tag')).includes('Sandbox'));
    ok(label + ' create disabled without photo', await p.isDisabled('.bb-bar .bb-btn'));
    await p.setInputFiles('.bb-upload input >> nth=0', S + '/standin.jpg'); await p.waitForSelector('.bb-upload img');
    const over = () => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(label + ' no sideways scroll (setup)', (await over()) <= 0);
    if (label === '390') await p.screenshot({ path: S + '/setup-390.jpg', type: 'jpeg', quality: 70 });
    await p.click('.bb-theme >> nth=3'); await p.click('.bb-bar .bb-btn'); await p.waitForSelector('.bb-tile-img img', { timeout: 30000 });
    ok(label + ' one photo made', (await p.locator('.bb-tile').count()) === 1);
    await p.click('text=Full shoot'); await p.click('text=6 photos'); ok(label + ' mix lists 6', (await p.locator('.bb-mix li').count()) === 6);
    if (label === '390') { await p.evaluate(() => window.scrollBy(0, 300)); await p.screenshot({ path: S + '/shoot-390.jpg', type: 'jpeg', quality: 70 }); const bar = await p.locator('.bb-bar').boundingBox(), tabs = await p.locator('.tabs').boundingBox(); ok(label + ' create bar sits above the app tab bar', bar.y + bar.height <= tabs.y); }
    await p.click('.bb-bar .bb-btn'); await p.waitForFunction(() => document.querySelectorAll('.bb-tile-img img').length === 7, null, { timeout: 60000 });
    ok(label + ' shoot of 6 made', true); ok(label + ' no sideways scroll (results)', (await over()) <= 0);
    await p.click('.bb-tile-img >> nth=0'); await p.waitForSelector('.bb-viewer'); ok(label + ' viewer focus on close', await p.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Close'));
    await p.click('text=Compare with your photo'); ok(label + ' compare shows original', (await p.getAttribute('.bb-viewer-img img', 'alt')) === 'Your original photo');
    const [d1] = await Promise.all([p.waitForEvent('download'), p.click('.bb-viewer >> text=4K')]); const f = await d1.path(); const m = await sharp(f).metadata(); ok(label + ' 4K export long edge 3840 (' + m.width + 'x' + m.height + ')', Math.max(m.width, m.height) === 3840);
    if (label === '390') await p.screenshot({ path: S + '/viewer-390.jpg', type: 'jpeg', quality: 70 });
    await p.keyboard.press('Escape'); ok(label + ' Escape closes viewer', (await p.locator('.bb-viewer').count()) === 0);
    ok(label + ' no page errors', errs.length === 0); if (errs.length) out.push('   ' + errs.join(' | '));
    await ctx.close();
  }
  console.log(out.join('\n')); await b.close();
})().catch(e => { console.error('E2E ERROR', e.message); process.exit(1); });
