# Football Pinball authoritative service

Run locally with `node server/football-pinball/index.mjs`. Default bind is `127.0.0.1:8787`.
Set `FOOTBALL_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173` for the frontend origin, and `VITE_FOOTBALL_SERVER_URL=http://127.0.0.1:8787` when running the browser app. `PORT` and `FOOTBALL_HOST` configure the server socket.

This is a persistent Node process inside the existing repository, not a second frontend application. Vercel static hosting does not keep these match processes alive. No production service was deployed.

## Protocol

- `GET /api/health` — physics120Hz/snapshot20Hz capability and development status.
- `POST /api/sessions` — `{mode,opponent?,difficulty?,format?}`. Modes `pvp`, `crash`, `penalty`, `arcade-rush`; opponent `cpu` or `human`; difficulty `easy/medium/hard` or Penalty `rookie/pro/elite`; format `quick/classic/golden`. Unknown fields (including seed, score and coordinates) rejected. Returns `{id,token,team,snapshot}`. The service picks the seed.
- `POST /api/sessions/:id/join` — empty JSON object. One remote player occupies the red slot of a ready human PvP room. The unguessable room ID is the invitation capability; this is not account authentication.
- `GET /api/sessions/:id` — bearer token required. Returns authoritative snapshot wrapper.
- `GET /api/sessions/:id/events?token=...` — participant-only SSE, named `snapshot` events20Hz. Wrapper `{id,mode,opponent,participants,authority:'server',state:engineSnapshot,result:signedEnvelopeOrNull}`. Protect query tokens from proxy logs; TLS is required outside localhost.
- `POST /api/sessions/:id/commands` — bearer token, `{seq,type,...}`. Exact increasing sequence starting1. Input uses `{type:'input',control:'left'|'right',pressed:boolean}`; other types: `start` with optional `call`, `choose` with `choice` and optional `value`, `bank`, `pause`, `resume`. The server assigns the simulation tick and maps relative left/right to that participant's current side. Valid commands that cannot act in the current state consume sequence and return `accepted:false`. Shape/auth/order failures do not consume sequence.
- `GET /api/sessions/:id/result` and `/replay` — participant-only, terminal matches only.
- `GET /api/public-key` — current key ID, PEM public key, implementation hash and whether key provisioning is persistent.

Online host starts only when both players have joined; only toss winner chooses. Online pause is disabled. Disconnect releases held boots immediately and permits a30second reconnect grace period before server forfeit. Pause in single-player freezes simulation time. Idle sessions expire after2minutes; total service lifetime30minutes; final result retained5minutes. Process memory holds at most64sessions. Those defaults are injectable in tests.

HTTP bodies capped4096bytes, command rate80/player/second, room creation12/IP/minute, two SSE streams/player, output backpressure disconnects slow readers. Engine input/tick limits further bound ledger growth. These are basic application limits; public hosting still needs perimeter rate limiting, authenticated accounts, HTTPS and controlled origins.

## Signing and replay

Without `FOOTBALL_SIGNING_KEY_FILE`, a new development Ed25519 key is generated for each process. Restart invalidates the assumption that the public key remains the same; no private key is committed. Production must provision a persistent server-only PEM key through secret management and publish/pin its verification key independently.

A terminal envelope signs the canonical result, final tick, rules hash, collider hash, exact implementation-source hash and full replay hash. Physical drain precedence remains inside the shared engine. Client scores/collisions/timestamps never enter the authority path. Replay contains ordered participant commands and server-only forfeit events.

Verify a downloaded `{envelope,replay}` JSON bundle:

```
node server/football-pinball/verify.mjs result-bundle.json --key trusted-public-key.pem
```

The CLI ignores any public key embedded in the bundle. It verifies the signature against the separately trusted key, then key ID, current pinned implementation/rules/colliders, replay digest, result and complete canonical replay. A matching engine version/runtime is required. A service upgrade must preserve the previous verifier/runtime for historical replay verification.

This implements auditable server-authoritative results. It is not independent fairness certification. Browser-only practice does not gain authority merely from showing the same score UI.

## Release gates

Persistent production host, trusted identity integration, persistent result storage/global leaderboards, external signing-key provisioning and rotation, TLS/origins, load testing and physical mobile-device QA remain outstanding. Per-device local records are not a global leaderboard. No deployment or account system is implied by local service tests.
