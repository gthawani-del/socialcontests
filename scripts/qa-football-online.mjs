import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { createFootballService } from '../server/football-pinball/index.mjs';
import { createMatch } from '../src/football-pinball/core/match-engine.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const engines = [];
const authority = await createFootballService({ allowedOrigins: ['http://127.0.0.1:5195'], matchFactory: async options => { const engine = await createMatch(options); engines.push(engine); return engine; } });
const serviceUrl = await authority.listen(8795);
const vite = await createServer({ define: { 'import.meta.env.VITE_FOOTBALL_SERVER_URL': JSON.stringify(serviceUrl) }, server: { host: '127.0.0.1', port: 5195, strictPort: true, hmr: false, watch: { ignored: ['**/*'] } }, logLevel: 'error' });
await vite.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const dir = 'docs/football-pinball/evidence-online'; await mkdir(dir, { recursive: true });
const results = [], errors = [];
try {
  const contexts = await Promise.all([browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }), browser.newContext({ viewport: { width: 430, height: 932 }, hasTouch: true, isMobile: true })]);
  for (const context of contexts) await context.addInitScript(() => sessionStorage.setItem('infinite-pinball-demo-access', 'granted'));
  const [host, guest] = await Promise.all(contexts.map(c => c.newPage()));
  for (const page of [host, guest]) page.on('pageerror', e => errors.push(e.message));
  await Promise.all([host, guest].map(p => p.goto('http://127.0.0.1:5195/football-pinball/?mode=pvp&qa')));
  await Promise.all([host, guest].map(p => p.waitForFunction(() => window.__football)));
  await host.selectOption('[name=opponent]', 'human');
  await host.click('#fp-serve');
  await host.waitForFunction(() => window.__football.engine.authority === 'server');
  const room = await host.evaluate(() => window.__football.engine.id);
  await host.waitForFunction(() => window.__football.engine.waiting);
  assert.equal(await host.locator('#fp-serve').isDisabled(), true);
  await guest.locator('#fp-join-code').fill(room); await guest.click('#fp-serve');
  await guest.waitForFunction(() => window.__football.engine.authority === 'server');
  assert.equal(await guest.evaluate(() => window.__football.engine.team), 'red');
  await host.waitForFunction(() => !window.__football.engine.waiting);
  await host.click('#fp-serve');
  await host.waitForFunction(() => window.__football.snapshot().state === 'choice');
  const winner = await host.evaluate(() => window.__football.snapshot().toss.winner);
  const winnerPage = winner === 'blue' ? host : guest;
  const loserPage = winner === 'blue' ? guest : host;
  assert.equal(await loserPage.locator('#fp-toss-choices').isVisible(), false);
  await winnerPage.click('[data-choice=far]');
  await Promise.all([host, guest].map(p => p.waitForFunction(() => window.__football.snapshot().state === 'active')));
  assert.equal(await host.evaluate(() => window.__football.engine.authority), 'server');
  assert.equal(engines.length, 1);
  results.push({ check: 'Two independent browser contexts host/join one authoritative match; only toss winner chooses', passed: true });
  for (const [index, page] of [host, guest].entries()) {
    const team = index === 0 ? 'blue' : 'red';
    await page.locator('[data-boot=blue-left]').scrollIntoViewIfNeeded();
    const bootBefore = engines[0].snapshot().boots.filter(b => b.team === team).map(b => ({ id: b.id, angle: b.angle }));
    const box = await page.locator('[data-boot=blue-left]').boundingBox();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
    await page.waitForFunction(team => window.__football.snapshot().boots.some(b => b.team === team && b.pressed), team);
    const actual = engines[0].snapshot().boots.filter(b => b.team === team);
    assert(actual.some(b => Math.abs(b.angle - bootBefore.find(v => v.id === b.id).angle) > .01));
    assert(actual.some(b => b.pressed));
    const other = index === 0 ? guest : host;
    await other.waitForFunction(team => window.__football.snapshot().boots.some(b => b.team === team && b.pressed), team);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(team => window.__football.snapshot().boots.filter(b => b.team === team).every(b => !b.pressed), team);
    await cdp.detach();
  }
  results.push({ check: 'Real mobile touch moves actual owned server flippers on both sides and streams to opponent; release clears', passed: true });
  const e = engines[0];
  // Explicit server-side physics fixture: test goal-plane crossing plus network propagation, not unassisted gameplay.
  for (const sign of [1, -1]) {
    await host.waitForFunction(() => window.__football.snapshot().state === 'active');
    const before = { ...e.score }, ball = e.balls[0];
    const expectedTeam = sign > 0 ? e.bottomTeam : e.bottomTeam === 'blue' ? 'red' : 'blue';
    ball.body.setTranslation({ x: .82, y: .3, z: -sign * 5.08 }, true);
    ball.body.setLinvel({ x: 0, y: 0, z: -sign * 4 }, true);
    await Promise.all([host, guest].map(p => p.waitForFunction(({ team, goal }) => window.__football.snapshot().score[team] >= goal, { team: expectedTeam, goal: before[expectedTeam] + 1 })));
    assert.equal(e.score[expectedTeam], before[expectedTeam] + 1);
    for (const page of [host, guest]) assert.equal(Number(await page.locator(`#${expectedTeam}Score`).textContent()), e.score[expectedTeam]);
  }
  results.push({ check: 'Both physical goal directions score exactly once and both clients show matching score (server ball-placement fixture)', passed: true });
  await Promise.all([host.screenshot({ path: dir + '/host-mobile.png', fullPage: true }), guest.screenshot({ path: dir + '/guest-mobile.png', fullPage: true })]);
  await host.waitForFunction(() => window.__football.snapshot().state === 'active');
  await host.evaluate(() => window.__football.engine.setInput(window.__football.snapshot().boots.find(b => b.team === 'blue').id, true));
  await guest.waitForFunction(() => window.__football.snapshot().boots.some(b => b.team === 'blue' && b.pressed));
  // Close the actual server stream: Chromium offline emulation does not reliably tear down an existing SSE socket.
  authority.disconnect(room, 'blue');
  await host.waitForFunction(() => Boolean(window.__football.engine.error), null, { timeout: 10000 });
  await guest.waitForFunction(() => window.__football.snapshot().boots.filter(b => b.team === 'blue').every(b => !b.pressed), null, { timeout: 10000 });
  // WebSocket-free transport uses SSE's built-in reconnect and HTTP input queues.
  await host.waitForFunction(() => !window.__football.engine.error, null, { timeout: 10000 });
  await host.evaluate(() => window.__football.engine.releaseInputs());
  await guest.waitForFunction(() => window.__football.snapshot().boots.filter(b => b.team === 'blue').every(b => !b.pressed));
  results.push({ check: 'Forced SSE socket interruption releases held server input; EventSource reconnects and ordered controls recover', passed: true });
  for (const page of [host, guest]) {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(await page.evaluate(() => window.__football.view.metrics().failedAssets), []);
  }
  assert.deepEqual(errors, []);
  results.push({ check: 'No browser runtime errors, asset failures or mobile horizontal overflow', passed: true });
  await writeFile(dir + '/results.json', JSON.stringify({ fixtureNote: 'Two isolated browser contexts and genuine HTTP/SSE transport. Goal tests place the authoritative ball near goal planes then let physics cross. These fixture sessions are not canonical-replay evidence; clean unmodified rounds are covered by server tests.', results }, null, 2));
  await rm(dir + '/failure.json', { force: true });
  console.log(JSON.stringify(results, null, 2));
} catch (error) { await writeFile(dir + '/failure.json', JSON.stringify({ message: error.message, stack: error.stack, results, errors }, null, 2)); throw error; }
finally { await browser.close(); await vite.close(); await authority.close(); }
