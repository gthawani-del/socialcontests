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
  await page.addInitScript(() => { Math.random = () => .4; });
  await page.goto('http://127.0.0.1:5179/qa-stadium');
  await page.waitForFunction(() => window.__stadiumQA?.ready, {}, { timeout: 60000 });
  await page.evaluate(() => window.__stadiumQA.manual(true));
  await mkdir('docs/qa', { recursive: true });

  async function toss() {
    await page.locator('#beginStadiumToss').click();
    await page.locator('#callHeads').click();
    await page.locator('#chooseBowl').waitFor({ timeout: 15000 });
    await page.locator('#chooseBowl').click();
    await page.waitForFunction(() => !document.querySelector('#bowl').disabled);
  }
  async function delivery(line = 'LEFT') {
    await page.waitForFunction(() => !document.querySelector('#bowl').disabled, {}, { timeout: 15000 });
    if (await page.locator('#line').isEnabled()) { await page.locator('#line').selectOption(line); await page.locator('#power').fill('50'); }
    await page.locator('#bowl').click();
    const live = await page.evaluate(() => window.__stadiumQA.snapshot());
    assert.equal(await page.locator('#leftBat').isDisabled(), live.match.battingPlayerId !== 'player');
    await page.evaluate(() => window.__stadiumQA.step(1500));
    const state = await page.evaluate(() => window.__stadiumQA.snapshot());
    assert(!state.running); return state;
  }
  // A reset during coin flight must cancel its delayed role transition.
  await page.locator('#beginStadiumToss').click(); await page.locator('#callHeads').click();
  await page.screenshot({ path: 'docs/qa/stadium-match-toss.png' });
  await page.locator('#restart').click(); await page.waitForTimeout(3200);
  assert(await page.locator('#beginStadiumToss').isVisible());
  assert.equal((await page.evaluate(() => window.__stadiumQA.snapshot())).match.status, 'MATCH_INTRO');
  await toss();
  for (let i = 0; i < 3; i++) await delivery('LEFT');
  await page.locator('#continueInnings').waitFor();
  let state = await page.evaluate(() => window.__stadiumQA.snapshot());
  assert.equal(state.match.target, 4); assert.equal(state.score.runs, 3);
  await page.screenshot({ path: 'docs/qa/stadium-match-chase.png' });
  await page.locator('#continueInnings').click();
  for (let i = 0; i < 2; i++) await delivery();
  await page.locator('#playAgain').waitFor();
  state = await page.evaluate(() => window.__stadiumQA.snapshot());
  assert.equal(state.match.status, 'MATCH_OVER'); assert.equal(state.match.result.winnerId, 'cpu');
  shots.push({ scenario: 'Two innings, chase target and CPU win', state });
  await page.screenshot({ path: 'docs/qa/stadium-match-result.png' });
  // All dots/misses create a real tie; play the configured three-ball tie-break.
  await page.locator('#playAgain').click(); await toss();
  for (let i = 0; i < 3; i++) await delivery('CENTRE');
  await page.locator('#continueInnings').waitFor(); await page.locator('#continueInnings').click();
  for (let i = 0; i < 2; i++) await delivery();
  await page.locator('#startTieBreak').waitFor(); await page.screenshot({ path: 'docs/qa/stadium-match-tie.png' });
  await page.locator('#startTieBreak').click();
  state = await page.evaluate(() => window.__stadiumQA.snapshot());
  assert.equal(state.match.ballsPerInnings, 3); assert.equal(state.match.superOverRound, 1);
  for (let i = 0; i < 2; i++) await delivery();
  await page.locator('#continueInnings').waitFor(); await page.locator('#continueInnings').click();
  await delivery('LEFT'); await page.locator('#playAgain').waitFor();
  state = await page.evaluate(() => window.__stadiumQA.snapshot());
  assert.equal(state.match.status, 'MATCH_OVER'); assert.equal(state.match.result.winnerId, 'cpu');
  shots.push({ scenario: 'Tie-break completes with chase win', state });
  assert.deepEqual(errors, []);
  await writeFile('docs/qa/stadium-match-results.json', JSON.stringify({ shots, errors, note: 'Seeded RNG and deterministic simulation stepping; real browser controls and match engine.' }, null, 2) + '\n');
  console.log(JSON.stringify({ results: shots.map(x => x.scenario), errors }));
} finally { await browser?.close(); await server.close(); }
