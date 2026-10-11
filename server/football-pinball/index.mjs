import http from 'node:http';
import { randomBytes, randomUUID, createHash, generateKeyPairSync, createPrivateKey, createPublicKey, sign, verify, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createMatch } from '../../src/football-pinball/core/match-engine.js';
import { canonicalJSON, verifyReplay } from '../../src/football-pinball/core/replay.js';
import { MODE_IDS, canonicalRules } from '../../src/football-pinball/modes/rules.js';

const digest = value => createHash('sha256').update(typeof value === 'string' ? value : canonicalJSON(value)).digest('hex');
const canonicalRuntime = () => ({ node: process.versions.node, v8: process.versions.v8, rapier: '0.19.3' });
const fail = (status, message) => Object.assign(new Error(message), { status });
const strictKeys = (value, allowed) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => allowed.includes(key));
const bearer = request => /^Bearer (.+)$/.exec(request.headers.authorization || '')?.[1];
const safeToken = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const participant = (room, token) => room.players.find(player => safeToken(player.token, token));
const json = (response, status, value) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }); response.end(JSON.stringify(value)); };
async function body(request) {
  let text = '';
  for await (const chunk of request) { text += chunk; if (Buffer.byteLength(text) > 4096) throw fail(413, 'Body exceeds 4096 bytes'); }
  try { const parsed = JSON.parse(text || '{}'); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error(); return parsed; } catch { throw fail(400, 'Expected JSON object'); }
}

export async function currentImplementationHash() {
  const codeParts = await Promise.all(['core/match-engine.js', 'core/replay.js', 'modes/rules.js', 'modes/foundation.js'].map(path => readFile(new URL(`../../src/football-pinball/${path}`, import.meta.url), 'utf8')));
  return digest(codeParts.join('\n'));
}

export async function verifySignedReplay(envelope, replay, publicKey) {
  try {
    if (!envelope?.payload || typeof envelope.signature !== 'string') return { valid: false, reason: 'Invalid signed envelope' };
    if (!verify(null, Buffer.from(canonicalJSON(envelope.payload)), publicKey, Buffer.from(envelope.signature, 'base64'))) return { valid: false, reason: 'Invalid signature' };
    const trustedPem = createPublicKey(publicKey).export({ type: 'spki', format: 'pem' });
    if (envelope.payload.keyId !== digest(trustedPem).slice(0, 24)) return { valid: false, reason: 'Signing key ID mismatch' };
    if (envelope.payload.implementationHash !== await currentImplementationHash()) return { valid: false, reason: 'Pinned implementation mismatch' };
    if (canonicalJSON(envelope.payload.canonicalRuntime) !== canonicalJSON(canonicalRuntime())) return { valid: false, reason: 'Canonical runtime mismatch' };
    const rules = canonicalRules(replay?.options?.mode);
    if (envelope.payload.rulesHash !== digest(rules) || envelope.payload.colliderHash !== digest(rules.geometry)) return { valid: false, reason: 'Rules or collider hash mismatch' };
    if (digest(replay) !== envelope.payload.replayHash) return { valid: false, reason: 'Replay digest mismatch' };
    if (canonicalJSON(replay.result) !== canonicalJSON(envelope.payload.result)) return { valid: false, reason: 'Result mismatch' };
    return await verifyReplay(replay);
  } catch (error) { return { valid: false, reason: error.message }; }
}

/** One canonical process, pinned engine. Production needs managed hosting, identity and persistent keys. */
export async function createFootballService({ autoTick = true, maxSessions = 64, maxLifetimeMs = 30 * 60_000, idleMs = 120_000, reconnectMs = 30_000, resultRetentionMs = 5 * 60_000, allowedOrigins = [], privateKey, now = () => Date.now(), matchFactory = createMatch } = {}) {
  const keys = privateKey ? { privateKey: createPrivateKey(privateKey) } : generateKeyPairSync('ed25519');
  if (keys.privateKey.asymmetricKeyType !== 'ed25519') throw Error('Signing key must be Ed25519');
  const publicKey = createPublicKey(keys.privateKey).export({ type: 'spki', format: 'pem' });
  const keyId = digest(publicKey).slice(0, 24);
  const implementationHash = await currentImplementationHash();
  const rooms = new Map();
  const creationRates = new Map();
  let pendingCreates = 0;
  let stopped = false;
  function newPlayer(team) { return { team, token: randomBytes(32).toString('hex'), sequence: 0, streams: new Set(), connectedOnce: false, disconnectedAt: null, windowAt: now(), count: 0 }; }
  function touch(room) { room.lastActivity = now(); }
  function rate(player) { if (now() - player.windowAt >= 1000) { player.windowAt = now(); player.count = 0; } if (++player.count > 80) throw fail(429, 'Command rate limit exceeded'); }
  function finalize(room) {
    if (room.signed || room.engine.state !== 'ended') return;
    const replay = room.engine.exportReplay();
    const rules = room.engine.canonicalRules();
    const payload = { schema: 'football-result-v1', sessionId: room.id, mode: room.mode, keyId, endingTick: room.engine.tick, rulesHash: digest(rules), colliderHash: digest(rules.geometry), implementationHash, canonicalRuntime: canonicalRuntime(), replayHash: digest(replay), result: replay.result, finishedAt: now() };
    room.replay = replay;
    room.signed = { payload, signature: sign(null, Buffer.from(canonicalJSON(payload)), keys.privateKey).toString('base64'), algorithm: 'Ed25519' };
    room.endedAt = now();
  }
  function snapshot(room) { return { id: room.id, mode: room.mode, opponent: room.opponent, participants: room.players.map(p => ({ team: p.team, connected: p.streams.size > 0 })), authority: 'server', state: room.engine.snapshot(), result: room.signed || null }; }
  function sendSnapshot(room) {
    const data = `event: snapshot\ndata: ${JSON.stringify(snapshot(room))}\n\n`;
    for (const player of room.players) for (const stream of player.streams) {
      if (stream.writableLength > 256_000) { stream.destroy(); continue; }
      stream.write(data);
    }
  }
  function release(room, player) {
    for (const boot of room.engine.snapshot().boots.filter(boot => boot.team === player.team && boot.pressed)) room.engine.command({ type: 'flip', id: boot.id, pressed: false });
  }
  function terminate(room, team = 'blue') { if (room.engine.state !== 'ended') room.engine.forfeit(team); finalize(room); sendSnapshot(room); }
  function remove(room) { for (const player of room.players) for (const stream of player.streams) stream.end(); room.engine.dispose(); rooms.delete(room.id); }
  function cleanup() {
    for (const room of rooms.values()) {
      if (room.endedAt != null) { if (now() - room.endedAt >= resultRetentionMs) remove(room); continue; }
      const expired = room.players.find(p => p.disconnectedAt != null && now() - p.disconnectedAt >= reconnectMs);
      if (expired) terminate(room, expired.team);
      else if (now() - room.createdAt >= maxLifetimeMs || now() - room.lastActivity >= idleMs) terminate(room);
    }
    for (const [ip, state] of creationRates) if (now() - state.at >= 60_000) creationRates.delete(ip);
  }
  function advance(id, ticks = 1) {
    const room = rooms.get(id); if (!room) throw Error('Unknown room');
    if (!Number.isInteger(ticks) || ticks < 0 || ticks > 216_000) throw Error('Invalid tick count');
    for (let i = 0; i < ticks && room.engine.state !== 'ended'; i++) room.engine.step();
    finalize(room); return snapshot(room);
  }
  const server = http.createServer(async (request, response) => {
    try {
      const origin = request.headers.origin;
      if (origin && !allowedOrigins.includes(origin)) throw fail(403, 'Origin not allowed');
      if (origin) { response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin'); }
      if (request.method === 'OPTIONS') { response.writeHead(204, { 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Authorization,Content-Type' }); response.end(); return; }
      const url = new URL(request.url, 'http://localhost');
      if (request.method === 'GET' && url.pathname === '/api/health') return json(response, 200, { ok: true, physicsHz: 120, snapshotHz: 20, authority: 'server', productionReady: false });
      if (request.method === 'GET' && url.pathname === '/api/public-key') return json(response, 200, { algorithm: 'Ed25519', keyId, publicKey, implementationHash, persistent: Boolean(privateKey) });
      if (request.method === 'POST' && url.pathname === '/api/sessions') {
        const input = await body(request);
        if (!strictKeys(input, ['mode', 'opponent', 'difficulty', 'format']) || !MODE_IDS.includes(input.mode)) throw fail(400, 'Invalid session options');
        const opponent = input.mode === 'pvp' ? (input.opponent ?? 'cpu') : 'cpu';
        if (!['cpu', 'human'].includes(opponent)) throw fail(400, 'Invalid opponent');
        if (input.difficulty != null && !(input.mode === 'penalty' ? ['rookie', 'pro', 'elite'] : ['easy', 'medium', 'hard']).includes(input.difficulty)) throw fail(400, 'Invalid difficulty');
        if (input.format != null && !['quick', 'classic', 'golden'].includes(input.format)) throw fail(400, 'Invalid format');
        const ip = request.socket.remoteAddress;
        let creation = creationRates.get(ip);
        if (!creation || now() - creation.at >= 60_000) { creation = { at: now(), count: 0 }; creationRates.set(ip, creation); }
        if (++creation.count > 12) throw fail(429, 'Session creation rate limit exceeded');
        if (rooms.size + pendingCreates >= maxSessions) throw fail(503, 'Session capacity reached');
        pendingCreates++;
        let engine;
        try { engine = await matchFactory({ mode: input.mode, opponent, difficulty: input.difficulty ?? (input.mode === 'penalty' ? 'pro' : 'medium'), format: input.format ?? 'quick', seed: randomBytes(4).readUInt32LE(0) || 1 }); } finally { pendingCreates--; }
        if (stopped) { engine.dispose(); throw fail(503, 'Service stopping'); }
        const room = { id: randomUUID(), mode: input.mode, opponent, engine, players: [newPlayer('blue')], createdAt: now(), lastActivity: now(), accumulator: 0, signed: null };
        rooms.set(room.id, room);
        return json(response, 201, { id: room.id, token: room.players[0].token, team: 'blue', snapshot: snapshot(room) });
      }
      const match = /^\/api\/sessions\/([a-f0-9-]+)(?:\/(join|commands|events|result|replay))?$/.exec(url.pathname);
      if (!match) throw fail(404, 'Not found');
      const room = rooms.get(match[1]); if (!room) throw fail(404, 'Session not found');
      const route = match[2];
      if (route === 'join' && request.method === 'POST') {
        const input = await body(request); if (!strictKeys(input, [])) throw fail(400, 'Invalid join body');
        if (room.mode !== 'pvp' || room.opponent !== 'human' || room.players.length !== 1 || room.engine.state !== 'ready') throw fail(409, 'Room is not joinable');
        const player = newPlayer('red'); room.players.push(player); touch(room); sendSnapshot(room);
        return json(response, 201, { id: room.id, token: player.token, team: 'red', snapshot: snapshot(room) });
      }
      const player = participant(room, route === 'events' ? url.searchParams.get('token') : bearer(request));
      if (!player) throw fail(401, 'Participant token required');
      if (route === 'events' && request.method === 'GET') {
        if (player.streams.size >= 2) throw fail(429, 'Too many event connections');
        response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no', 'Referrer-Policy': 'no-referrer' });
        player.streams.add(response); player.connectedOnce = true; player.disconnectedAt = null; touch(room); sendSnapshot(room);
        response.on('close', () => { player.streams.delete(response); if (!player.streams.size && !stopped && rooms.has(room.id)) { release(room, player); player.disconnectedAt = now(); } });
        return;
      }
      if (route === 'commands' && request.method === 'POST') {
        const input = await body(request); rate(player);
        if (!Number.isSafeInteger(input.seq) || input.seq !== player.sequence + 1) throw fail(409, 'Expected next sequence');
        const fields = { input: ['seq', 'type', 'control', 'pressed'], start: ['seq', 'type', 'call'], choose: ['seq', 'type', 'choice', 'value'], bank: ['seq', 'type'], pause: ['seq', 'type'], resume: ['seq', 'type'] };
        if (!fields[input.type] || !strictKeys(input, fields[input.type])) throw fail(400, 'Invalid command fields');
        if (room.engine.state === 'ended') throw fail(409, 'Session ended');
        let command;
        if (input.type === 'input') {
          if (!['left', 'right'].includes(input.control) || typeof input.pressed !== 'boolean') throw fail(400, 'Invalid boot input');
          const state = room.engine.snapshot();
          const near = state.bottomTeam === player.team;
          const leftSign = near ? -1 : 1;
          const sign = input.control === 'left' ? leftSign : -leftSign;
          const boot = state.boots.find(b => b.team === player.team && Math.sign(b.x) === sign);
          if (!boot) throw fail(403, 'No owned boot');
          command = { type: 'flip', id: boot.id, pressed: input.pressed };
        } else {
          if (input.type === 'start') {
            if (player.team !== 'blue' || (room.opponent === 'human' && room.players.length !== 2)) throw fail(403, 'Host starts after both players join');
            if (input.call != null && !['heads', 'tails'].includes(input.call)) throw fail(400, 'Invalid toss call');
            command = { type: 'start', call: input.call ?? 'heads' };
          } else if (input.type === 'choose') {
            if (room.engine.snapshot().toss?.winner !== player.team) throw fail(403, 'Only toss winner chooses');
            if (!['kickoff', 'side'].includes(input.choice) || (input.choice === 'side' && !['near', 'far'].includes(input.value))) throw fail(400, 'Invalid toss choice');
            command = { type: 'choose', choice: input.choice, ...(input.choice === 'side' ? { value: input.value } : {}) };
          } else {
            if (player.team !== 'blue' || (room.opponent === 'human' && ['pause', 'resume'].includes(input.type))) throw fail(403, 'Action not allowed');
            command = { type: input.type };
          }
        }
        // Consume an ordered, validated command even if current gameplay makes it a no-op.
        player.sequence = input.seq;
        const accepted = room.engine.command(command); touch(room); finalize(room);
        return json(response, 200, { accepted, seq: player.sequence, tick: room.engine.tick, state: room.engine.snapshot().state });
      }
      if (request.method === 'GET' && !route) { touch(room); return json(response, 200, { ...snapshot(room), commandSequence: player.sequence }); }
      if (request.method === 'GET' && ['result', 'replay'].includes(route)) {
        finalize(room); if (!room.signed) throw fail(409, 'Session is not complete');
        return json(response, 200, route === 'result' ? room.signed : room.replay);
      }
      throw fail(405, 'Method not allowed');
    } catch (error) { if (!response.headersSent) json(response, error.status || 500, { error: error.status ? error.message : 'Internal service error' }); else response.destroy(); }
  });
  server.requestTimeout = 10_000; server.headersTimeout = 10_000; server.maxHeadersCount = 30;
  let last = performance.now();
  const tickTimer = autoTick ? setInterval(() => {
    const next = performance.now(), elapsed = Math.min(.25, (next - last) / 1000); last = next;
    for (const room of rooms.values()) {
      if (room.engine.state === 'ended') continue;
      room.accumulator += elapsed;
      while (room.accumulator >= 1 / 120) { room.engine.step(); room.accumulator -= 1 / 120; }
      finalize(room);
    }
  }, 1000 / 120) : null;
  const snapshotTimer = autoTick ? setInterval(() => { for (const room of rooms.values()) sendSnapshot(room); }, 50) : null;
  const cleanupTimer = setInterval(cleanup, 1000);
  for (const timer of [tickTimer, snapshotTimer, cleanupTimer]) timer?.unref();
  return { server, publicKey, keyId, advance, cleanup,
    disconnect(id, team) { const player = rooms.get(id)?.players.find(p => p.team === team); if (player) for (const stream of [...player.streams]) stream.destroy(); },
    async listen(port = 0, host = '127.0.0.1') { await new Promise(resolve => server.listen(port, host, resolve)); return `http://${host}:${server.address().port}`; },
    async close() { stopped = true; for (const timer of [tickTimer, snapshotTimer, cleanupTimer]) clearInterval(timer); for (const room of [...rooms.values()]) remove(room); await new Promise(resolve => server.close(resolve)); server.closeAllConnections(); },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const privateKey = process.env.FOOTBALL_SIGNING_KEY_FILE ? await readFile(process.env.FOOTBALL_SIGNING_KEY_FILE, 'utf8') : undefined;
  const service = await createFootballService({ privateKey, allowedOrigins: (process.env.FOOTBALL_ALLOWED_ORIGINS || '').split(',').filter(Boolean) });
  const address = await service.listen(Number(process.env.PORT || 8787), process.env.FOOTBALL_HOST || '127.0.0.1');
  console.log(`Football authoritative service: ${address}. ${privateKey ? 'Persistent signing key loaded.' : 'Development-only ephemeral signing key.'}`);
  process.once('SIGTERM', () => service.close()); process.once('SIGINT', () => service.close());
}
