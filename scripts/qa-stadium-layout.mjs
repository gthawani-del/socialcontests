// Run with Playwright installed, or set PLAYWRIGHT_MODULE / CHROMIUM_MODULE.
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const server = await createServer({ server: { host: '127.0.0.1', port: 5178 } });
await server.listen();
let browser;
try {
  const bundled = process.env.CHROMIUM_MODULE ? (await import(process.env.CHROMIUM_MODULE)).default : null;
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    ...(bundled ? { args: bundled.args } : {})
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/stadium-collision-qa', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#101820;color:#fff;font:15px sans-serif}h1,p{margin:16px}h1{font-size:21px}canvas{display:block}</style><h1>Stadium collision check</h1><p>Engineering overlay · not game artwork</p><canvas width="390" height="620"></canvas><p id="result"></p>' }));
  await page.goto('http://127.0.0.1:5178/stadium-collision-qa');
  const results = await page.evaluate(async () => {
    const { StadiumEngine: PinballEngine } = await import('/src/cricket-pinball/game/stadium-engine.js');
    const { createStadiumTable } = await import('/src/cricket-pinball/game/stadium-layout.js');
    const table = createStadiumTable(await (await fetch('/game/cricket-table.json')).json());
    const canvas = document.querySelector('canvas'), ctx = canvas.getContext('2d');
    const screen = ([x, z]) => [195 + x * 104, 305 + z * 104];
    function line(a, b, color, width = 2) {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(...screen(a)); ctx.lineTo(...screen(b)); ctx.stroke();
    }
    for (const wall of table.walls) line(wall.a, wall.b, '#8297a8');
    for (const bat of table.flippers) {
      const angle = bat.restAngleDeg * Math.PI / 180;
      line(bat.pivot, [bat.pivot[0] + Math.cos(angle) * bat.length, bat.pivot[1] - Math.sin(angle) * bat.length], '#f1c56b', bat.radius * 208);
    }
    ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'center';
    for (const zone of table.deliveryZones) {
      const [x, y] = screen(zone.position); ctx.fillStyle = '#fff'; ctx.fillText(String(zone.runs), x, y - 14);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, zone.radius * 104, 0, Math.PI * 2); ctx.stroke();
    }
    const outcomes = [];
    for (const spec of [
      { name: 'Central miss → wicket drain', p: [0, 1.71], v: [0, 2], color: '#fa8c8c', kind: 'drain' },
      { name: 'Left boundary rebound', p: [-1.45, 0], v: [-3, 0], color: '#65d8c4', kind: 'wall-hit' },
      { name: 'Right boundary rebound', p: [1.45, 0], v: [3, 0], color: '#65d8c4', kind: 'wall-hit' },
      { name: 'Left bat contact', p: [-.6, 1.9], v: [0, 2], color: '#7bb7ff', kind: 'flipper-hit', side: 'left' },
      { name: 'Right bat contact', p: [.6, 1.9], v: [0, 2], color: '#7bb7ff', kind: 'flipper-hit', side: 'right' }
    ]) {
      const engine = new PinballEngine(structuredClone(table));
      Object.assign(engine.launcher, { awaitingLaunch: false, inLane: false, deliveryGuideActive: false });
      Object.assign(engine.ball, { position: { x: spec.p[0], z: spec.p[1] }, velocity: { x: spec.v[0], z: spec.v[1] }, active: true });
      let hit = false;
      engine.on(spec.kind, event => { if (!event.safetyReset && (!spec.side || event.id === spec.side)) hit = true; });
      if (spec.side) engine.setFlipper(spec.side, true);
      for (let i = 0; i < 120 && engine.ball.active; i++) {
        const previous = [engine.ball.position.x, engine.ball.position.z];
        engine.step(1 / 120);
        line(previous, [engine.ball.position.x, engine.ball.position.z], spec.color);
      }
      outcomes.push({ name: spec.name, passed: hit });
    }
    document.querySelector('#result').textContent = `${outcomes.filter(x => x.passed).length}/5 browser trajectory checks passed`;
    return outcomes;
  });
  await mkdir('docs/qa', { recursive: true });
  await page.screenshot({ path: 'docs/qa/stadium-collision-map.png' });
  const rampResults = await page.evaluate(async () => {
    const { StadiumEngine } = await import('/src/cricket-pinball/game/stadium-engine.js');
    const { createStadiumTable } = await import('/src/cricket-pinball/game/stadium-layout.js');
    const { CricketMatchEngine } = await import('/src/cricket-pinball/match/match-engine.js');
    const { createCricketGameplayAdapter } = await import('/src/cricket-pinball/game/gameplay-adapter.js');
    const table = createStadiumTable(await (await fetch('/game/cricket-table.json')).json());
    const rules = await (await fetch('/game/cricket-rules.json')).json();
    function setup() {
      const engine = new StadiumEngine(structuredClone(table));
      const match = new CricketMatchEngine({ players: [{ id: 'a' }, { id: 'b' }] });
      match.assignRoles({ battingPlayerId: 'a', bowlingPlayerId: 'b' }); match.startInnings(); match.beginDelivery();
      const adapter = createCricketGameplayAdapter({ engine, matchEngine: match, tableConfig: table, cricketRules: rules }); adapter.armDelivery();
      return { engine, match, adapter };
    }
    const cases = [], traces = [];
    const start = table.ramps[0].points[0], end = table.ramps[0].points.at(-1);
    for (const spec of [
      { name: 'Strong shot: six at ramp finish', speed: 7, contact: true },
      { name: 'Weak shot: rollback, no six', speed: 2, contact: true },
      { name: 'Ground crossing: no six', speed: 3, ground: true, contact: true },
      { name: 'No bat contact: no runs', speed: 7, contact: false }
    ]) {
      const { engine, match, adapter } = setup();
      Object.assign(engine.launcher, { awaitingLaunch: false, inLane: false, deliveryGuideActive: false });
      Object.assign(engine.ball, { position: { x: start.x, z: (spec.ground ? end.z : start.z) + .05 }, velocity: { x: 0, z: -spec.speed } });
      if (spec.contact) engine.emit('flipper-hit', { pressed: true, impact: 2 });
      let rollback = false, maxHeight = 0;
      engine.on('ramp-exit', () => rollback = true);
      const trace = [];
      for (let i = 0; i < 360 && !rollback && !match.deliveryHistory.length; i++) {
        adapter.step(1 / 120); maxHeight = Math.max(maxHeight, engine.ball.height);
        trace.push([i / 120, engine.ball.height]);
      }
      let passed;
      if (spec.ground) passed = match.currentInnings.runs === 0 && maxHeight === 0;
      else if (!spec.contact) passed = match.currentInnings.runs === 0 && engine.completedRoute === 'six-ramp';
      else if (spec.speed === 2) passed = rollback && maxHeight > .05 && match.currentInnings.runs === 0;
      else passed = match.currentInnings.runs === 6 && match.currentInnings.balls === 1 && Math.abs(maxHeight - end.height) < .001;
      cases.push({ name: spec.name, passed, maxHeight });
      if (spec.contact && !spec.ground) traces.push(trace);
      adapter.dispose();
    }
    for (const line of ['LEFT', 'CENTRE', 'RIGHT']) for (const charge of [.2, .5, 1]) {
      const { engine, match, adapter } = setup(); engine.releaseLaunch({ line, charge });
      let releasedBeforeBats = false;
      for (let i = 0; i < 2400 && !match.deliveryHistory.length; i++) {
        const guided = engine.launcher.deliveryGuideActive; adapter.step(1 / 120);
        if (guided && !engine.launcher.deliveryGuideActive) releasedBeforeBats = engine.ball.position.z < 1.72;
      }
      cases.push({ name: `Bowling ${line}, power ${charge}`, passed: releasedBeforeBats && match.currentInnings.balls === 1 && match.currentInnings.runs === 0 });
      adapter.dispose();
    }
    document.querySelector('h1').textContent = 'Six ramp + bowling QA';
    const canvas = document.querySelector('canvas'); canvas.height = 350;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif';
    ctx.fillText('Ball height above field (engine units)', 20, 24);
    ctx.strokeStyle = '#8297a8'; ctx.beginPath(); ctx.moveTo(45, 60); ctx.lineTo(45, 280); ctx.lineTo(365, 280); ctx.stroke();
    ctx.fillText('0.5', 12, 80); ctx.fillText('0', 26, 280); ctx.fillText('0', 43, 301); ctx.fillText('1', 193, 301); ctx.fillText('2 seconds', 297, 301);
    traces.forEach((trace, i) => {
      ctx.strokeStyle = i ? '#f1c56b' : '#65d8c4'; ctx.lineWidth = 3; ctx.beginPath();
      trace.forEach(([time, height], j) => { const p = [45 + time * 150, 280 - height * 400]; if (j) ctx.lineTo(...p); else ctx.moveTo(...p); }); ctx.stroke();
    });
    document.querySelector('#result').innerHTML = `<span style="color:#65d8c4">Strong shot climbs to six</span><br><br><span style="color:#f1c56b">Weak shot climbs, then rolls back</span><br><br>${cases.filter(x => x.passed).length}/13 ramp and bowling checks passed<br><br>Prototype physics only. Final GLB and gameplay integration pending.`;
    return cases;
  });
  results.push(...rampResults);
  await page.screenshot({ path: 'docs/qa/stadium-ramp-proof.png' });
  await writeFile('docs/qa/stadium-collision-results.json', JSON.stringify({ results, errors, scope: 'Opt-in physics prototype. Final GLB alignment and playable integration not validated.' }, null, 2) + '\n');
  if (errors.length || results.some(x => !x.passed)) throw new Error(JSON.stringify({ results, errors }));
  console.log(JSON.stringify({ results, errors }));
} finally {
  await browser?.close();
  await server.close();
}
