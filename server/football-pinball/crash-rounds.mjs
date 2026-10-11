import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto';

export const CRASH_RULES_VERSION = 'virtual-crash-v1';
const fail = (status, message) => Object.assign(new Error(message), { status });
export const crashCommitment = seed => createHash('sha256').update(`${CRASH_RULES_VERSION}:${seed}`).digest('hex');
// Uniform 52-bit draw. No house edge: P(threshold >= x) approximates 1/x;
// hundredth rounding and a disclosed 100x cap apply. Virtual points only.
export function crashThreshold(seed) {
  const hex = createHash('sha256').update(`${CRASH_RULES_VERSION}:threshold:${seed}`).digest('hex').slice(0, 13);
  const n = BigInt(`0x${hex}`), total = 1n << 52n;
  return Number((100n * total) / (total - n) > 10000n ? 10000n : (100n * total) / (total - n)) / 100;
}
export function verifyCrashReveal({ commitment, seed, crashMultiplier }) {
  return typeof seed === 'string' && /^[a-f0-9]{64}$/.test(seed) && crashCommitment(seed) === commitment && crashThreshold(seed) === crashMultiplier;
}
export function createCrashRounds({ now = () => performance.now(), wallNow = () => Date.now(), randomSeed = () => randomBytes(32).toString('hex'), maxRounds = 64, retentionMs = 300000, countdownMs = 3000 } = {}) {
  const rounds = new Map();
  let lastNow = -Infinity;
  const time = () => { lastNow = Math.max(lastNow, now()); return lastNow; };
  function update(r, t) {
    if (r.status === 'cashed_out' || r.status === 'crashed') return;
    if (t >= r.crashAt) { r.status = 'crashed'; r.multiplier = r.threshold; r.endedAt = r.crashAt; }
    else if (t >= r.begin) { r.status = 'active'; r.multiplier = Math.floor(Math.exp((t-r.begin)/10000)*100)/100; }
  }
  function snapshot(r, t) {
    update(r,t);
    const terminal = r.status === 'cashed_out' || r.status === 'crashed';
    return { roundId:r.id, commitment:r.commitment, rulesVersion:CRASH_RULES_VERSION, startAt:r.startAt, serverNow:r.createdWall+(t-r.created), status:r.status, multiplier:r.multiplier, stake:r.stake, payout:r.payout, authority:'server', practice:true, ...(terminal ? {reveal:{seed:r.seed,crashMultiplier:r.threshold}} : {}) };
  }
  function cleanup() { const t=time(); for(const [id,r] of rounds) { update(r,t); if(r.endedAt != null && t-r.endedAt >= retentionMs) rounds.delete(id); } }
  function owned(id,token) {
    const r=rounds.get(id); if(!r) throw fail(404,'Crash round not found');
    if(typeof token !== 'string' || Buffer.byteLength(token)!==Buffer.byteLength(r.token) || !timingSafeEqual(Buffer.from(token),Buffer.from(r.token))) throw fail(401,'Round token required');
    const t=time(); if(t-r.windowAt>=1000){r.windowAt=t;r.requests=0;} if(++r.requests>30)throw fail(429,'Crash request rate limit exceeded');
    return [r,t];
  }
  return {
    cleanup,
    create(stake) {
      if(!Number.isSafeInteger(stake)||stake<1||stake>1000)throw fail(400,'Virtual stake must be an integer from 1 to 1000');
      cleanup(); if(rounds.size>=maxRounds)throw fail(503,'Crash capacity reached');
      const t=time(),seed=randomSeed(),threshold=crashThreshold(seed),createdWall=wallNow();
      const r={id:randomUUID(),token:randomBytes(32).toString('hex'),seed,threshold,commitment:crashCommitment(seed),created:t,createdWall,begin:t+countdownMs,startAt:createdWall+countdownMs,crashAt:t+countdownMs+10000*Math.log(threshold),status:'ready',multiplier:1,stake,payout:0,windowAt:t,requests:0};
      rounds.set(r.id,r); return {...snapshot(r,t),token:r.token};
    },
    get(id,token){const[r,t]=owned(id,token);return snapshot(r,t);},
    cashout(id,token){const[r,t]=owned(id,token);update(r,t);if(r.status!=='active')throw fail(409,r.status==='ready'?'Round has not started':'Round has ended');r.status='cashed_out';r.endedAt=t;r.payout=Math.floor(r.stake*Math.round(r.multiplier*100)/100);return snapshot(r,t);}
  };
}
