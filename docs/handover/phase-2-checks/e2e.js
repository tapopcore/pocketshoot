const { chromium } = require('playwright');
const B = 'http://localhost:3123';
const log = []; const ok = (c, m) => log.push((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(B + '/prototype', { waitUntil: 'networkidle' });
  await p.getByRole('link', { name: 'Upload photo' }).click(); await p.waitForURL(/create/);
  await p.getByRole('button', { name: 'Upload photo' }).click();
  ok(await p.getByRole('button', { name: 'Continue' }).isDisabled(), 'Continue disabled while uploading');
  await p.waitForTimeout(1100);
  await p.getByRole('button', { name: 'Continue' }).click(); await p.waitForURL(/step=understand/);
  ok(await p.getByText('Looking at your photo').isVisible(), 'analysing skeleton shown');
  await p.waitForTimeout(1200);
  ok(await p.getByText('One bottle of body lotion').isVisible(), 'summary shown after analysis');
  await p.getByRole('button', { name: 'Choose shoot' }).click(); await p.waitForURL(/step=shoot/);
  ok(await p.getByRole('button', { name: 'Review' }).isDisabled(), 'Review disabled before choosing a shoot');
  // tap feedback latency
  const t = await p.evaluate(async () => { const el = [...document.querySelectorAll('[role=radio]')].find(e => e.textContent.includes('Creative campaign')); const t0 = performance.now(); el.click(); await new Promise(r => requestAnimationFrame(() => r())); return { ms: performance.now() - t0, checked: el.getAttribute('aria-checked') }; });
  ok(t.checked === 'true' && t.ms < 100, `offering selection reflected in ${t.ms.toFixed(1)} ms`);
  // needs-reference sheet on Model & everyday use > On skin
  await p.getByRole('radio', { name: /Model & everyday use/ }).click();
  await p.getByRole('radio', { name: /On skin/ }).click();
  const dlg = p.getByRole('dialog', { name: 'One more photo needed' });
  ok(await dlg.isVisible(), 'needs-reference sheet opens for an unmet look');
  ok(await p.evaluate(() => document.querySelector('[role=dialog]').contains(document.activeElement)), 'focus moved into sheet');
  await p.keyboard.press('Escape');
  ok(!(await dlg.isVisible()), 'Escape closes sheet');
  ok(await p.evaluate(() => document.activeElement?.textContent?.includes('On skin')), 'focus returned to the opener');
  await p.getByRole('radio', { name: /On skin/ }).click();
  await p.getByRole('dialog').getByRole('button', { name: 'Upload photo' }).click();
  await p.waitForTimeout(1200);
  ok(await p.getByRole('radio', { name: /On skin/ }).getAttribute('aria-checked') === 'true', 'after adding the photo, the same look stays selected');
  await p.getByRole('radio', { name: /^3/ }).click();
  await p.getByRole('button', { name: 'Review' }).click(); await p.waitForURL(/step=review/);
  ok(await p.getByRole('button', { name: 'Create 3 photos' }).isVisible(), 'review CTA matches quantity');
  ok(await p.getByText('3 credits', { exact: true }).isVisible(), 'review shows 3 credits');
  // refresh keeps draft
  await p.reload({ waitUntil: 'networkidle' });
  ok(await p.getByRole('button', { name: 'Create 3 photos' }).isVisible(), 'draft survives reload');
  await p.getByRole('button', { name: 'Create 3 photos' }).click(); await p.waitForURL(/shoots\/demo-job\?fresh=1/);
  ok(/[0-2] of 3 done/.test(await p.locator('.pt-progress').innerText()), 'results start in progress with the 3 chosen photos');
  ok(await p.getByText('Model & everyday use · On skin').isVisible(), 'results header matches the chosen shoot');
  await p.waitForTimeout(7500);
  ok(await p.getByText('Finished').isVisible(), 'results finish');
  await p.getByRole('button', { name: /Open Held in one hand/ }).click();
  ok(await p.getByRole('dialog', { name: 'Held in one hand' }).isVisible(), 'viewer opens');
  await p.getByRole('button', { name: 'Your photo' }).click();
  ok(await p.locator('.pt-viewer img').getAttribute('alt') === 'Your original photo', 'viewer compares with original');
  await p.keyboard.press('Escape');
  await p.getByRole('button', { name: 'Keep' }).click();
  ok(await p.getByText('Kept. 1 credit used.').isVisible(), 'keep held photo');
  ok(errs.length === 0, 'no page errors ' + errs.join(';'));
  // keyboard-only tab order sanity on home
  await p.goto(B + '/prototype', { waitUntil: 'networkidle' });
  const seq = []; for (let i = 0; i < 8; i++) { await p.keyboard.press('Tab'); seq.push(await p.evaluate(() => (document.activeElement.getAttribute('aria-label') || document.activeElement.textContent.trim() || document.activeElement.querySelector('img')?.alt || '').trim().slice(0, 24))); }
  ok(seq.every(Boolean), 'every tab stop has a name: ' + seq.join(' > '));
  // 200% zoom = 640 css px at 1280; also 320
  for (const w of [320, 640]) { await p.setViewportSize({ width: w, height: 800 });
    for (const u of ['/prototype', '/prototype/create?step=shoot&saved=1', '/prototype/create?step=review&state=smaller', '/prototype/shoots/demo-job', '/prototype/you']) {
      await p.goto(B + u, { waitUntil: 'networkidle' }); await p.waitForTimeout(300);
      const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(ov <= 0, `${w}px no horizontal scroll on ${u}`); } }
  // reduced motion
  const rm = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }); const q = await rm.newPage();
  await q.goto(B + '/prototype/shoots/demo-job?state=running', { waitUntil: 'networkidle' });
  ok(await q.evaluate(() => getComputedStyle(document.querySelector('.pt-shimmer')).animationName) === 'none', 'reduced motion stops shimmer');
  // editorial direction
  await p.setViewportSize({ width: 390, height: 844 }); await p.goto(B + '/prototype', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: 'Editorial' }).click(); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.querySelector('.pt').dataset.direction) === 'editorial', 'direction toggle');
  for (const [n, u] of [['ed-home', '/prototype'], ['ed-shoot', '/prototype/create?step=shoot&saved=1'], ['ed-review', '/prototype/create?step=review&state=smaller']]) { await p.goto(B + u, { waitUntil: 'networkidle' }); await p.waitForTimeout(400); await p.screenshot({ path: 'shots/' + n + '.png' }); }
  await p.goto(B + '/prototype/create?step=shoot&saved=1', { waitUntil: 'networkidle' }); await p.screenshot({ path: 'shots/st-shoot-viewport.png' });
  console.log(log.join('\n')); await b.close();
})();
