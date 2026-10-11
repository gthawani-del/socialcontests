import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createFootballService, verifySignedReplay } from '../server/football-pinball/index.mjs';

async function fixture(t, options = {}) {
  const service = await createFootballService({ autoTick: false, ...options });
  const base = await service.listen();
  t.after(() => service.close());
  const request = async (path, { token, body, method = body === undefined ? 'GET' : 'POST', ...rest } = {}) => {
    const response = await fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), ...rest });
    return { status: response.status, data: await response.json() };
  };
  const create = async options => { const response = await request('/api/sessions', { body: options }); assert.equal(response.status, 201, JSON.stringify(response.data)); return response.data; };
  const command = (player, seq, command) => request(`/api/sessions/${player.id}/commands`, { token: player.token, body: { seq, ...command } });
  return { service, base, request, create, command };
}

test('HTTP two-player authority maps each team controls and rejects spoofed state/order', async t => {
  const { service, request, create, command } = await fixture(t);
  const blue = await create({ mode: 'pvp', opponent: 'human' });
  assert.equal((await command(blue, 1, { type: 'start' })).status, 403);
  const joined = await request(`/api/sessions/${blue.id}/join`, { body: {} });
  assert.equal(joined.status, 201); const red = joined.data;
  assert.equal((await request(`/api/sessions/${blue.id}/join`, { body: {} })).status, 409);
  assert.equal((await command(red, 1, { type: 'start' })).status, 403);
  assert.equal((await command(blue, 1, { type: 'start', call: 'heads' })).data.accepted, true);
  let snapshot = service.advance(blue.id, 120);
  const winner = snapshot.state.toss.winner === 'blue' ? blue : red;
  const loser = winner === blue ? red : blue;
  const winnerSequence = winner === blue ? 2 : 1;
  assert.equal((await command(loser, loser === blue ? 2 : 1, { type: 'choose', choice: 'kickoff' })).status, 403);
  assert.equal((await command(winner, winnerSequence, { type: 'choose', choice: 'side', value: 'far' })).data.accepted, true);
  snapshot = service.advance(blue.id, 180);
  const seq = blue === winner ? 3 : 2;
  const before = snapshot.state.boots.filter(b => b.team === 'blue').map(b => b.angle);
  assert.equal((await command(blue, seq, { type: 'input', control: 'left', pressed: true })).data.accepted, true);
  snapshot = service.advance(blue.id, 10);
  const moved = snapshot.state.boots.filter(b => b.team === 'blue');
  assert(moved.some((b, i) => b.angle !== before[i]));
  assert.equal(moved.filter(b => b.pressed).length, 1);
  assert(snapshot.state.boots.filter(b => b.team === 'red').every(b => !b.pressed));
  assert.equal((await command(blue, seq, { type: 'input', control: 'left', pressed: false })).status, 409);
  for (const bad of [{ type: 'input', control: 'left', pressed: true, score: 999 }, { type: 'input', control: 'left', pressed: true, tick: 2 }, { type: 'input', control: 'left', pressed: true, team: 'red' }, { type: 'input', id: 'red-left', pressed: true }, { type: 'forfeit', team: 'red' }]) assert.equal((await command(blue, seq + 1, bad)).status, 400);
  assert.equal((await command(blue, seq + 1, { type: 'pause' })).status, 403);
  assert.equal((await request(`/api/sessions/${blue.id}`, { token: 'wrong' })).status, 401);
  const a = await request(`/api/sessions/${blue.id}`, { token: blue.token });
  const b = await request(`/api/sessions/${blue.id}`, { token: red.token });
  assert.deepEqual(a.data.state, b.data.state);
});

test('Crash bank result signature and full canonical replay verify; tampering fails', async t => {
  const { service, request, create, command } = await fixture(t);
  const player = await create({ mode: 'crash' });
  assert.equal((await request(`/api/sessions/${player.id}/result`, { token: player.token })).status, 409);
  await command(player, 1, { type: 'start' }); service.advance(player.id, 220);
  await command(player, 2, { type: 'input', control: 'left', pressed: true }); service.advance(player.id, 10);
  await command(player, 3, { type: 'input', control: 'left', pressed: false });
  assert.equal((await command(player, 4, { type: 'bank' })).data.accepted, true);
  service.advance(player.id);
  const signed = await request(`/api/sessions/${player.id}/result`, { token: player.token });
  const replay = await request(`/api/sessions/${player.id}/replay`, { token: player.token });
  assert.equal(signed.status, 200); assert.equal(replay.status, 200);
  assert.equal(signed.data.payload.result.reason, 'banked');
  assert.equal((await verifySignedReplay(signed.data, replay.data, service.publicKey)).valid, true);
  const forged = structuredClone(signed.data); forged.payload.result.bankedPoints += 100;
  assert.equal((await verifySignedReplay(forged, replay.data, service.publicKey)).valid, false);
  const changed = structuredClone(replay.data); changed.ledger[0].type = 'FORGED';
  assert.equal((await verifySignedReplay(signed.data, changed, service.publicKey)).valid, false);
  const alteredInput = structuredClone(replay.data); alteredInput.commands[1].command.id = 'blue-right';
  assert.equal((await verifySignedReplay(signed.data, alteredInput, service.publicKey)).valid, false);
  assert.equal((await command(player, 5, { type: 'bank' })).status, 409);
  assert.equal((await request(`/api/sessions/${player.id}/replay`)).status, 401);
});

test('Pause freezes canonical time; resume and bank retain verifiable commands', async t => {
  const { service, create, command, request } = await fixture(t);
  const player = await create({ mode: 'crash' });
  await command(player, 1, { type: 'start' }); service.advance(player.id, 200);
  await command(player, 2, { type: 'pause' });
  const before = service.advance(player.id, 1000); assert.equal(before.state.tick, 200);
  assert.equal((await command(player, 3, { type: 'bank' })).data.accepted, false);
  await command(player, 4, { type: 'resume' }); await command(player, 5, { type: 'bank' }); service.advance(player.id);
  const result = (await request(`/api/sessions/${player.id}/result`, { token: player.token })).data;
  const replay = (await request(`/api/sessions/${player.id}/replay`, { token: player.token })).data;
  assert.equal((await verifySignedReplay(result, replay, service.publicKey)).valid, true);
});

test('SSE streams are participant-only and both clients receive server snapshots', async t => {
  const { service, base, create, request } = await fixture(t);
  const blue = await create({ mode: 'pvp', opponent: 'human' });
  const red = (await request(`/api/sessions/${blue.id}/join`, { body: {} })).data;
  const abortBlue = new AbortController(), abortRed = new AbortController();
  t.after(() => { abortBlue.abort(); abortRed.abort(); });
  const [a, b] = await Promise.all([fetch(`${base}/api/sessions/${blue.id}/events?token=${blue.token}`, { signal: abortBlue.signal }), fetch(`${base}/api/sessions/${red.id}/events?token=${red.token}`, { signal: abortRed.signal })]);
  assert.equal(a.status, 200); assert.match(a.headers.get('content-type'), /text\/event-stream/);
  for (const response of [a, b]) { const reader = response.body.getReader(); const text = new TextDecoder().decode((await reader.read()).value); assert.match(text, /event: snapshot/); assert.match(text, /"authority":"server"/); reader.releaseLock(); }
  abortBlue.abort(); abortRed.abort();
  assert.equal((await request(`/api/sessions/${blue.id}/events?token=invalid`)).status, 401);
});

test('Idle expiration produces signed replayable forfeit and bounded result retention', async t => {
  let time = 1_000;
  const { service, create, request } = await fixture(t, { now: () => time, idleMs: 200, resultRetentionMs: 100 });
  const player = await create({ mode: 'crash' }); time += 201; service.cleanup();
  const envelope = (await request(`/api/sessions/${player.id}/result`, { token: player.token })).data;
  const replay = (await request(`/api/sessions/${player.id}/replay`, { token: player.token })).data;
  assert.equal(envelope.payload.result.reason, 'forfeit');
  assert.equal((await verifySignedReplay(envelope, replay, service.publicKey)).valid, true);
  time += 101; service.cleanup(); assert.equal((await request(`/api/sessions/${player.id}`, { token: player.token })).status, 404);
});

test('Capacity, body limits, CORS and option whitelist protect service boundaries', async t => {
  const { base, create, request } = await fixture(t, { maxSessions: 1, allowedOrigins: ['https://game.example'] });
  assert.equal((await request('/api/sessions', { body: { mode: 'crash', score: 100 } })).status, 400);
  assert.equal((await request('/api/sessions', { body: { mode: 'crash', seed: 10 } })).status, 400);
  assert.equal((await request('/api/sessions', { body: { mode: 'crash', difficulty: 'impossible' } })).status, 400);
  await create({ mode: 'crash' }); assert.equal((await request('/api/sessions', { body: { mode: 'crash' } })).status, 503);
  const cors = await fetch(base + '/api/health', { headers: { Origin: 'https://untrusted.example' } }); assert.equal(cors.status, 403);
  const allowed = await fetch(base + '/api/health', { headers: { Origin: 'https://game.example' } }); assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://game.example');
  const oversized = await fetch(base + '/api/sessions', { method: 'POST', body: JSON.stringify({ padding: 'x'.repeat(5000) }) }); assert.equal(oversized.status, 413);
  assert.equal((await request('/api/public-key')).data.algorithm, 'Ed25519');
});

test('Real service clock advances at fixed ticks and sends recurring SSE snapshots', async t => {
  const { base, create, command } = await fixture(t, { autoTick: true });
  const player = await create({ mode: 'crash' });
  await command(player, 1, { type: 'start' });
  const abort = new AbortController(); t.after(() => abort.abort());
  const response = await fetch(`${base}/api/sessions/${player.id}/events?token=${player.token}`, { signal: abort.signal });
  const reader = response.body.getReader();
  const ticks = []; let buffer = '';
  const deadline = setTimeout(() => abort.abort(), 2000);
  try {
    while (ticks.length < 4) {
      const { value, done } = await reader.read(); assert.equal(done, false);
      buffer += new TextDecoder().decode(value);
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        const message = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
        const line = message.split('\n').find(line => line.startsWith('data: '));
        if (line) ticks.push(JSON.parse(line.slice(6)).state.tick);
      }
    }
    assert(ticks.at(-1) > ticks[0], JSON.stringify(ticks));
    assert(ticks.every(Number.isSafeInteger));
  } finally { clearTimeout(deadline); abort.abort(); reader.releaseLock(); }
});

test('SSE disconnect releases held input then signs a replayable grace-expiry forfeit', async t => {
  let time = 1000;
  const { service, base, create, command, request } = await fixture(t, { now: () => time, reconnectMs: 100, idleMs: 10000 });
  const player = await create({ mode: 'crash' });
  await command(player, 1, { type: 'start' }); service.advance(player.id, 180);
  await command(player, 2, { type: 'input', control: 'left', pressed: true }); service.advance(player.id, 5);
  const abort = new AbortController();
  const events = await fetch(`${base}/api/sessions/${player.id}/events?token=${player.token}`, { signal: abort.signal });
  const reader = events.body.getReader(); await reader.read(); reader.releaseLock(); abort.abort();
  let released = false;
  for (let i = 0; i < 30; i++) {
    const snapshot = (await request(`/api/sessions/${player.id}`, { token: player.token })).data;
    if (snapshot.state.boots.every(b => !b.pressed)) { released = true; break; }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert(released, 'Disconnected held boot must release');
  time += 101; service.cleanup();
  const envelope = (await request(`/api/sessions/${player.id}/result`, { token: player.token })).data;
  const replay = (await request(`/api/sessions/${player.id}/replay`, { token: player.token })).data;
  assert.equal(envelope.payload.result.reason, 'forfeit');
  assert.equal((await verifySignedReplay(envelope, replay, service.publicKey)).valid, true);
});

test('Verification CLI trusts a separate key and reproduces a clean banked round', async t => {
  const { service, create, command, request } = await fixture(t);
  const player = await create({ mode: 'crash' });
  await command(player, 1, { type: 'start' }); service.advance(player.id, 200);
  await command(player, 2, { type: 'bank' }); service.advance(player.id);
  const envelope = (await request(`/api/sessions/${player.id}/result`, { token: player.token })).data;
  const replay = (await request(`/api/sessions/${player.id}/replay`, { token: player.token })).data;
  assert.equal(replay.options.difficulty, 'medium');
  const dir = await mkdtemp(join(tmpdir(), 'football-replay-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'result.json'), key = join(dir, 'trusted.pem');
  await writeFile(file, JSON.stringify({ envelope, replay, publicKey: 'untrusted embedded key is ignored' }));
  await writeFile(key, service.publicKey);
  const { stdout } = await promisify(execFile)(process.execPath, ['server/football-pinball/verify.mjs', file, '--key', key]);
  assert.equal(JSON.parse(stdout).valid, true);
});
