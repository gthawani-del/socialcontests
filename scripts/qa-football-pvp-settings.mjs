import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const server = await createServer({ server: { host: '127.0.0.1', port: 5273, hmr: false, watch: { ignored: ['**/*'] } }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const dir = 'docs/football-pinball/evidence-pvp-settings';
await mkdir(dir, { recursive: true });
const errors = [], checks = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  page.setDefaultTimeout(60000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.addInitScript(() => sessionStorage.setItem('infinite-pinball-demo-access', 'granted'));
  const visit = async () => {
    await page.goto('http://127.0.0.1:5273/football-pinball/?mode=pvp&qa');
    await page.waitForFunction(() => window.__football);
    // The offscreen board is idle during setup; skip its GPU work for layout checks.
    await page.evaluate(async () => { window.__settingsDraw = window.__football.view.draw; window.__football.view.draw = () => {}; await document.fonts.ready; });
    await page.waitForFunction(() => [...document.querySelectorAll('.fp-pvp-jersey img')].every(img => img.complete && img.naturalWidth > 0));
  };
  await visit();
  assert.equal(await page.locator('[name=difficulty]:checked').inputValue(), 'medium');
  assert.equal(await page.locator('[name=call]:checked').inputValue(), 'heads');
  assert.equal(await page.locator('#fp-blue-team').inputValue(), 'India');
  assert.equal(await page.locator('#fp-red-team').inputValue(), 'England');

  for (const width of [320, 360, 390, 430, 768, 1000]) {
    await page.setViewportSize({ width, height: 844 });
    await page.locator('.fp-preflight').evaluate(node => { node.scrollTop = 0; });
    const layout = await page.evaluate(() => {
      const preflight = document.querySelector('.fp-preflight');
      return {
        pageOverflow: document.documentElement.scrollWidth > innerWidth,
        panelOverflow: preflight.scrollWidth > preflight.clientWidth,
        controls: [...preflight.querySelectorAll('select, button, a, .fp-pvp-choices span')].map(node => ({ name: node.textContent.trim().slice(0, 25), height: node.getBoundingClientRect().height, width: node.getBoundingClientRect().width })),
      };
    });
    assert(!layout.pageOverflow && !layout.panelOverflow, JSON.stringify({ width, layout }));
    assert(layout.controls.every(control => control.height >= 44 && control.width >= 44), JSON.stringify({ width, controls: layout.controls }));
    checks.push({ width, overflow: false, targetsAtLeast44px: true });
    if ([390, 430, 1000].includes(width)) await page.screenshot({ path: `${dir}/setup-${width}.png` });
  }
  await page.setViewportSize({ width: 430, height: 1040 });
  await page.screenshot({ path: `${dir}/setup-full-430.png` });
  await page.setViewportSize({ width: 390, height: 844 });

  await page.locator('[name=difficulty][value=hard] + span').tap();
  assert.equal(await page.locator('[name=difficulty]:checked').inputValue(), 'hard');
  await page.locator('[name=difficulty][value=hard]').focus();
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('[name=difficulty]:checked').inputValue(), 'medium');
  await page.locator('[name=difficulty][value=hard] + span').tap();
  await page.locator('[name=call][value=tails] + span').tap();
  await page.selectOption('[name=format]', 'golden');
  await page.selectOption('#fp-team-type', 'club');
  await page.selectOption('#fp-blue-team', 'FC Barcelona');
  await page.selectOption('#fp-red-team', 'AC Milan');
  assert.equal(await page.locator('.fp-blue .fp-team-name small').textContent(), 'FC Barcelona');
  assert.equal(await page.locator('.fp-red .fp-team-name small').textContent(), 'AC Milan');
  assert.equal(await page.locator('[data-side=blue] select').getAttribute('title'), 'FC Barcelona');
  await page.locator('.fp-preflight').evaluate(node => { node.scrollTop = 0; });
  await page.screenshot({ path: `${dir}/clubs-390.png` });
  await page.selectOption('#fp-team-type', 'country');
  await page.selectOption('#fp-blue-team', 'France');
  await page.selectOption('#fp-red-team', 'India');
  assert.match(await page.locator('#fp-pvp-kit-note').textContent(), /alternate colours/);
  assert(await page.evaluate(() => {
    const root = document.querySelector('#footballApp');
    return ['blue', 'red'].every(side => document.querySelector(`[data-side=${side}] .fp-pvp-jersey`).style.getPropertyValue('--kit-primary') === root.footballKits[side].primary);
  }));
  checks.push({ touchAndKeyboardSegments: true, clubsAndCountries: true, previewMatchesResolvedKit: true });

  await page.locator('#fp-preflight-audio').tap();
  assert.equal(await page.locator('#fp-preflight-audio').getAttribute('aria-pressed'), 'false');
  assert.equal(await page.locator('#fp-preflight-audio [data-audio-label]').textContent(), 'Sound off');
  await visit();
  assert.equal(await page.locator('#fp-preflight-audio').getAttribute('aria-pressed'), 'false');
  await page.locator('#fp-preflight-audio').tap();
  assert.equal(await page.locator('#fp-preflight-audio').getAttribute('aria-pressed'), 'true');
  checks.push({ mutePersistsAcrossReload: true });

  await page.locator('[name=difficulty][value=hard] + span').tap();
  await page.locator('[name=call][value=tails] + span').tap();
  await page.selectOption('[name=format]', 'golden');
  await page.selectOption('#fp-blue-team', 'Brazil');
  await page.selectOption('#fp-red-team', 'France');
  await page.locator('#fp-enter-board').tap();
  assert.equal(await page.locator('#footballApp').getAttribute('data-stage'), 'play');
  await page.locator('#fp-serve').tap();
  await page.waitForFunction(() => ['countdown', 'active'].includes(window.__football.snapshot().state) || (!document.querySelector('#fp-toss-choices').hidden && !document.querySelector('#fp-toss').hidden));
  const options = await page.evaluate(() => ({ ...window.__football.engine.options, call: window.__football.engine.toss.call }));
  assert.equal(options.difficulty, 'hard');
  assert.equal(options.format, 'golden');
  assert.equal(options.call, 'tails');
  assert.equal(options.opponent, 'cpu');
  assert(await page.locator('[name=difficulty][value=hard]').isDisabled());
  if (await page.locator('#fp-toss-choices').isVisible()) await page.locator('[data-choice=kickoff]').tap();
  await page.waitForFunction(() => window.__football.snapshot().state === 'active');
  assert.equal(await page.locator('.fp-blue .fp-team-name small').textContent(), 'Brazil');
  assert.equal(await page.locator('.fp-red .fp-team-name small').textContent(), 'France');
  // Resume the actual board renderer and observe the configured match advancing.
  const tick = await page.evaluate(() => { window.__football.view.draw = window.__settingsDraw; return window.__football.engine.activeTicks; });
  await page.waitForFunction(tick => window.__football.engine.activeTicks > tick + 90, tick);
  await page.screenshot({ path: `${dir}/match-390.png` });
  await page.locator('#fp-settings-open').tap();
  assert(await page.locator('#fp-control-dial').isVisible());
  await page.locator('#fp-help').tap();
  assert(await page.locator('#fp-settings-dialog').isVisible());
  await page.locator('#fp-settings-done').tap();
  checks.push({ continuedAndStarted: true, options, selectedTeamsInHud: true, liveRenderedMatch: true, helpDialog: true });
  assert.deepEqual(errors, []);
  await writeFile(`${dir}/browser.json`, JSON.stringify({ method: 'Chromium touch emulation and native keyboard input; session access fixture; real match toss and advancing render loop. Not a physical iPhone test.', checks, errors }, null, 2));
  console.log(JSON.stringify(checks));
} finally {
  await browser.close();
  await server.close();
}
