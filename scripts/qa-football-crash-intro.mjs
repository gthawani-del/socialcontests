import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const vite = await createServer({ server: { host: '127.0.0.1', port: 5272, hmr: false }, logLevel: 'error' });
await vite.listen();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const errors = [], failedRequests = [], checks = [];
const evidence = process.env.QA_OUTPUT_DIR || '/tmp/football-crash-intro-qa';
await mkdir(evidence, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  page.setDefaultTimeout(60000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`); });
  await page.addInitScript(() => sessionStorage.setItem('infinite-pinball-demo-access', 'granted'));
  const url = 'http://127.0.0.1:5272/football-pinball/?mode=crash&qa';
  await page.goto(url);
  await page.waitForFunction(() => window.__crash?.ready);
  await page.evaluate(() => document.fonts.ready);
  assert(await page.locator('.fc-setup').isVisible());
  assert.equal(await page.locator('.fc-setup select').count(), 0);
  assert.equal(await page.locator('.fc-setup').getByText('Round type').count(), 0);
  assert(await page.locator('.fc-intro-art').evaluate(img => img.complete && img.naturalWidth === 1200));
  assert(await page.evaluate(() => document.fonts.check('800 64px "Football Display"')));
  checks.push('WebP hero and local display font loaded; round selector absent from intro');

  for (const [width, height] of [[320, 740], [390, 844], [430, 932], [1000, 844], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}`);
    for (const selector of ['#fc-enter', '#fp-audio', '.fc-menu', '.fc-header a']) {
      const rect = await page.locator(selector).boundingBox();
      assert(rect.width >= 44 && rect.height >= 44, `${selector} touch target at ${width}`);
    }
    const heading = await page.locator('#fc-intro-title').boundingBox();
    assert(heading.x >= 0 && heading.x + heading.width <= width);
    if (width === 390 || width === 1000) await page.screenshot({ path: `${evidence}/intro-${width}.png`, fullPage: true });
  }
  checks.push('No horizontal overflow; 44px touch targets at 320, 390, 430, 1000 and landscape 844px');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#fp-audio').tap();
  assert.equal(await page.locator('#fp-audio').getAttribute('aria-pressed'), 'false');
  assert.equal(await page.locator('[data-audio-label]').textContent(), 'Sound off');
  assert(await page.evaluate(() => __crash.audio.metrics().muted));
  await page.reload();
  await page.waitForFunction(() => window.__crash?.ready);
  assert.equal(await page.locator('#fp-audio').getAttribute('aria-pressed'), 'false');
  await page.locator('.fc-menu').tap();
  assert(await page.locator('#fc-authority').isVisible());
  assert.equal(await page.locator('#fp-audio').count(), 1);
  await page.locator('#fp-audio').tap();
  assert.equal(await page.locator('#fp-audio').getAttribute('aria-pressed'), 'true');
  await page.locator('#fc-close').tap();
  assert(await page.locator('.fc-setup #fp-audio').isVisible());
  checks.push('Sound toggles actual audio state, persists after reload and survives settings reparenting');

  await page.locator('#fc-enter').tap();
  await page.waitForFunction(() => __crash.view);
  assert.equal(await page.locator('#footballApp').getAttribute('data-screen'), 'play');
  assert(!(await page.locator('.fc-setup').isVisible()));
  assert(await page.locator('#fc-stake').isVisible());
  assert.equal(await page.locator('#fc-mode-label').textContent(), 'LOCAL PRACTICE');
  // Existing development-only fixture ensures time to test cashout; it does not alter production odds.
  await page.evaluate(() => __crash.setNextPracticeCrash(100));
  await page.locator('#fc-start').tap();
  await page.waitForFunction(() => __crash.snapshot()?.status === 'active');
  await page.locator('#fc-cashout').tap();
  await page.waitForFunction(() => __crash.snapshot()?.status === 'cashed_out');
  assert(await page.locator('#fc-start').isEnabled());
  assert.equal(await page.locator('#fc-start').textContent(), 'Play again');
  checks.push('Continue enters real board; local round starts, cashes out and exposes Play again');
  assert.deepEqual(errors, []);
  assert.deepEqual(failedRequests, []);
  const result = { checks, errors, failedRequests, method: 'Chromium with mobile touch emulation; real page controls; demo-access fixture and deterministic local crash threshold. Not physical iPhone validation.' };
  await writeFile(`${evidence}/results.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
  await vite.close();
}
