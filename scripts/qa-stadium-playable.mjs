import { createServer } from 'vite';
import { writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium: pw } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const bundle = process.env.CHROMIUM_MODULE ? (await import(process.env.CHROMIUM_MODULE)).default : null;
const server = await createServer({ server: { host: '127.0.0.1', port: 5179 } });
await server.listen();
let browser;
try {
  browser = await pw.launch({ headless: true, ...(bundle ? { args: bundle.args } : {}), ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [], shots = [];
  page.on('pageerror', e => errors.push(e.message));
  // Test fixture only: production access gate remains on the actual prototype page.
  await page.route('**/qa-stadium*', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><main id="stadiumApp"></main><script type="module" src="/src/cricket-pinball/stadium-prototype.js"></script>' }));
  await page.goto('http://127.0.0.1:5179/qa-stadium?practice=1');
  await page.waitForFunction(() => window.__stadiumQA?.ready, {}, { timeout: 60000 });
  await page.evaluate(() => window.__stadiumQA.manual(true));
  const art = await page.evaluate(() => window.__stadiumQA.art);
  assert(Math.abs(art.pitchLengthMetres - 20.1168) < .00001);
  assert(Math.abs(art.pitchWidthMetres - 3.048) < .00001);
  assert.equal(art.rampMouthHeight, 0);
  assert(art.rampSurfaceParityError < 1e-6);
  assert(art.rampUpwardNormals);
  await mkdir('docs/qa', { recursive: true });
  await page.screenshot({ path: 'docs/qa/stadium-playable-mobile.png' });
  // Reproducible input timings found by sweeping actual launches; no injected positions/hits.
  for (const shot of [
    { line: 'LEFT', side: 'left', delay: 84, runs: 1 },
    { line: 'LEFT', side: 'left', delay: 72, runs: 4 },
    { line: 'CENTRE', side: 'left', delay: 84, runs: 6 }
  ]) {
    await page.locator('#restart').click();
    await page.locator('#line').selectOption(shot.line);
    await page.locator('#power').fill('20');
    await page.locator('#bowl').click();
    await page.evaluate(n => window.__stadiumQA.step(n), shot.delay);
    const button = page.locator(`#${shot.side}Bat`);
    await button.hover(); await page.mouse.down();
    await page.evaluate(() => window.__stadiumQA.step(18));
    await page.mouse.up();
    let maxHeight = 0, captured = false;
    for (let i = 0; i < 240; i++) {
      await page.evaluate(() => window.__stadiumQA.step(5));
      const state = await page.evaluate(() => window.__stadiumQA.snapshot());
      assert(state.alignment.every(error => error < 1e-5));
      maxHeight = Math.max(maxHeight, state.ball.height);
      if (shot.runs === 6 && !captured && state.ball.height > .2) {
        await page.screenshot({ path: 'docs/qa/stadium-six-in-flight.png' }); captured = true;
      }
      if (!state.running) break;
    }
    const result = await page.evaluate(() => window.__stadiumQA.snapshot());
    assert.equal(result.score.runs, shot.runs); assert.equal(result.score.balls, 1);
    assert(result.contactCount > 0);
    if (shot.runs === 6) { assert.equal(result.rampEntries, 1); assert(maxHeight > .48); }
    shots.push({ ...shot, maxHeight, result });
  }
  await page.screenshot({ path: 'docs/qa/stadium-six-result.png' });
  await page.locator('#restart').click();
  await page.setViewportSize({ width: 1280, height: 900 }); await page.waitForTimeout(100);
  await page.screenshot({ path: 'docs/qa/stadium-playable-desktop.png' });
  await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(100);
  const layout = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, controls: document.querySelector('.controls').getBoundingClientRect().toJSON() }));
  assert(layout.scrollWidth <= layout.width); assert(layout.controls.width > 0); assert(layout.controls.bottom <= layout.height);
  await page.screenshot({ path: 'docs/qa/stadium-playable-landscape.png' });
  assert.deepEqual(errors, []);
  await writeFile('docs/qa/stadium-playable-results.json', JSON.stringify({ art, shots, layout, errors, scope: 'Existing GLB with measured runtime pitch, branded bats and collision-derived six ramp; real button inputs, deterministic simulation stepping. Not a frame-rate or real-device performance test.' }, null, 2) + '\n');
  console.log(JSON.stringify({ shots: shots.map(s => ({ runs: s.result.score.runs, maxHeight: s.maxHeight })), errors, layout }));
} finally { await browser?.close(); await server.close(); }
