# Requirements traceability — four-mode implementation

Source: complete starter pack in `specification/`, plus the user's master instruction and subsequent authorization to implement all four variants. Numeric rules are the pack's proposed baseline; tuning remains subject to playtesting. No real-money features exist.

| Requirement | Implementation | Verification and status |
|---|---|---|
| Existing repository, route, access and Cricket preservation | `/football-pinball/`, existing Vite/Three shell and demo gate; isolated module | Build and existing Cricket unit suite pass; no Cricket gameplay source changes. Client demo gate is not production identity. |
| Four-mode navigation, setup, HUDs, results | `ui/`, `main.js`; actual board captures on lobby cards | Chromium widths360/390/430/1440, four live mode routes, no overflow;56px controls. |
| Shared fixed-step engine | `core/match-engine.js`, pinned Rapier3D0.19.3 at120Hz; renderer independent |32 engine tests: motion, contact, pause, bounded velocity, state transitions and replay. Legacy2D foundation retained separately. |
| Independent production assets |12 GLBs in `public/models/football`; source `.blend`, scripts and provenance in assets docs | Higgsfield3DJutsu/Blender renders inspected; all12 load in actual Three.js; UV/bounds/material checks; runtime replacement tested. Optimized sports miniatures, not photoreal humans. |
| PvP CPU and physical board |4 boots,2 goals/keepers, player bumpers, Skill/Pass/Combo; Easy/Medium/Hard | Actual all4 boot contact/loft tests, keeper collision, deterministic CPU inputs, Golden result browser test. |
| Toss, side selection, kickoff, formats | Animated coin settles on engine face; quick first3, classic2×120s, golden goal; halftime ends | Engine tests for choice and side swaps; browser CPU and two-device toss/input flow. Goals never multiplied. |
| Crash survival/bank/drain | Fixed-point multiplier capped10; combo capped1.5; collision rearm; bank-or-lose | Same-tick drain wins, duplicate/paused bank rejection, real target scoring and Bank button tested. No multiplier-dependent physics. |
| Crash audit and signatures | Ordered inputs/events/final state, versioned immutable rules, SHA256 hashes, Ed25519 server result; trusted-key CLI | Canonical replay and tamper tests; server signed replay+CLI tests. Local practice is unverified. No cryptographic provable-fairness claim. Crash has no outcome RNG; server owns seed. |
| Penalty Shootout | Dedicated shorter/narrower lane,2 boots,5attempts,8s limit; reactive keeper/difficulty; actual height-based zones | Physical saves,5corner goals,4800 fixture points, streak/precision, timeout/miss and one resolution per attempt. |
| Arcade Rush |90s timer, combo2–5, moving target, ramp,1s drain relaunch; Final15 bonus×2 | Timer during relaunch, physical ramp lift, expiry and terminal score lock tests. Final multiplier is explicit baseline tuning. |
| Extra time and multiball | +10s max2; hard120s cap;3unique balls for10s, one event at a time | Engine cap/deduplication/expiry tests and actual multiball target browser test. |
| Leaderboard support | Top5 device scores, persisted in localStorage | Browser result/record test. Global authenticated persistent rankings are blocked on backend identity/storage decisions. No fake global standings. |
| Online PvP | Same-repo Node authoritative service120Hz; SSE20Hz and ordered HTTP inputs; participant tokens; interpolated views | Two separate Chromium contexts: both teams' touch, matching scores, actual socket interruption, release/reconnect and resumed ordering. No database frame polling. |
| Audio/settings | Synthesized event feedback, working mute; automatic/full/reduced graphics | Browser controls; resource stability measured across10restarts. Physical phone speaker quality unverified. |
| Rewards/cosmetics | Match points, banked points and local records implemented | Currency exchange, badge thresholds and cosmetic unlock rules are **blocked: not specified**. No invented payouts or fake reward buttons. |
| Performance/mobile release | Reduced detail lowers pixel density and hides stadium decoration without changing physics | SwiftShader software benchmark recorded; real iPhone/Android FPS, thermal/memory and Safari validation remain blocked by environment. |
| GitHub/release | `feature/football-pinball-foundation`, reviewable commits | No main merge or production deployment. Hosting, TLS, real auth and durable keys/results require release work and deployment approval. |

## Explicit decisions and limitations

- Existing vanilla JavaScript/Vite/Three architecture retained instead of introducing a second React/TypeScript application.
- Local development QA hooks require `import.meta.env.DEV` and `?qa`; not exposed in the production bundle.
- Out-of-play balls are logged: PvP visibly refeeds after2s; Penalty records a miss; Crash loses unbanked points; Rush uses its normal relaunch. This is operational baseline tuning, not hidden multiplier manipulation.
- Penalty visual reference was labeled conceptual in the pack. The implemented arena uses the same restrained palette and independently authored assets; visual approval is still a human review gate.
- Deterministic replay is verified on the pinned server runtime. This does not establish identical WASM behavior across every browser/runtime.
- Browser goal/target placements and accelerated terminal clocks are explicitly labeled QA fixtures. They prove collision/scoring transitions, not human skill or physical-device performance.
