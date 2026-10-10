# Requirements traceability

Source: entire Football_Pinball_Work_Starter_Pack_v2, supplemented by user's master instruction. M numbers below refer to that instruction. `Pending` means deliberately outside this assignment, not omitted. No proposed numbers are final game-balance commitments.

| ID / source | Feature / implementation task | Milestone | Verification / status |
|---|---|---|---|
| F01 PRD, ARCHITECTURE | Existing repo, isolated route, access gate, shared Three.js | 1–2 | Build route, deep-link gate, homepage link browser tests |
| F02 PRD, WORK_PROMPT | Shared fixed-step Rapier physics with rendering separate | 2 | Fixed-step equivalence, pause, capped delta, collision tests |
| F03 PVP, ASSET_MANIFEST | Ball, rails, two goals, two blue/two red flippers | 2 | Ball moves; each boot contact changes velocity; rail/post collision; full-ball crossing; score once |
| F04 IA_UX, TEST_MATRIX | Independent mobile controls, >=56px controls, safe areas | 2 | Multitouch; cancel/release/blur; widths 360/390/430; desktop/landscape |
| F05 PRD | Pause/restart, loading/failure handling | 2 | Frozen simulation, cleared held inputs, reset scores, initialization errors |
| F06 prior homepage request | Football entry adjacent to Cricket, linking /football-pinball | 2 | Reuse existing football artwork; link navigation test; Cricket href preserved |
| U01 IA_UX | Four real mode cards, mode setup/tutorial/results, distinct HUDs | 3 | Pending: route flow, responsive layouts, accessible status, no fake actions |
| A01 ASSET_MANIFEST | Independent boots/ball/player bumpers/keepers/goals/nets/rails/field/targets/ramps/stadium/coin | 4 | Pending: individual GLB loading/replacement, bounds, pivots, UV/material/collider checks |
| A02 HIGGSFIELD_BLENDER | Jutsu -> Blender cleanup -> optimized GLBs; provenance/hashes | 4 | Pending: service check, per-asset viewer/animation/mobile FPS/memory evidence |
| P01 PVP | CPU Easy/Medium/Hard, equal physical inputs | 5 | Pending: reaction delay, bounded errors, same physics, complete match |
| P02 PVP | Authoritative toss, kickoff/side choice, halftime sides | 5/9 | Pending: both coin faces match result, state transitions and side mapping |
| P03 PVP | Keepers, role bumpers, Skill/Pass/Combo targets | 5 | Pending: bounded keeper reach, capped impulse, rearm/dedupe, bonus expiry |
| P04 PVP | Quick 3, Classic 2x120s, Golden Goal; goals separate from arcade points | 5 | Pending: timer/results/rewards; goals never multiplied; ranked format later |
| C01 CRASH | One ball, physical drain, bank-or-lose virtual points | 6 | Pending: bank/drain ordering, same-tick drain wins, no post-drain/duplicate banks |
| C02 CRASH, mode_defaults | Versioned fixed-point multiplier/base score/capped combos, target rearm | 6 | Pending: caps, rounding, example 2400, expiry, overflow and duplicate scoring |
| C03 EVENTS_AND_FAIRNESS | Canonical server physics, input/collision ledger, signed bank/result, replay | 6/9 | Pending: tamper/clock/collision forgery, canonical replay, signature verification |
| C04 CRASH | Seed commitment/reveal if RNG used; no multiplier physics changes | 6 | Pending: RNG draw verification; identical physics at different multipliers; no provably-fair claim |
| N01 PENALTY | Five attempts, two boots, precision zones, physical reactive keeper | 7 | Pending: each zone, full-plane goal, save contact, miss/8s timeout, one resolution per shot |
| N02 PENALTY | Rookie/Pro/Elite, streak/precision bonuses, goals primary | 7 | Pending: bounded latency/speed/reach; five-shot result; later variants separate |
| R01 ARCADE_RUSH | 90s, relaunch after 1s with clock running, combos x2–x5 | 8 | Pending: timer, combo expiry/drain reset, terminal score lock |
| R02 ARCADE_RUSH | +10s twice, 120s hard cap, 2–3 ball/10s multiball, Final Rush 15s | 8 | Pending: caps, unique IDs/hit dedupe, one event at a time, announced phase |
| O01 ARCHITECTURE/PVP | Server-authoritative remote PvP, own-goal camera mapping | 9 | Pending: input order, snapshot interpolation, lag/reconnect, authoritative score |
| S01 PRD | Audio/mute/settings, virtual rewards/cosmetics, no pay-to-win | 3/5–10 | Pending: implemented-only controls; no money/deposits/withdrawals |
| Q01 TEST_MATRIX | Browser QA, loading, responsive, performance/memory, regressions | 2/10 | Foundation automated evidence; real devices/full release QA pending |
| G01 user instruction | Feature branch, small commits, no main merge or production deploy | all | Commit review; stop at M2; later work requires approval |

## Specification decisions
- User's milestone order and explicit stop override ZIP WORK_PROMPT's mode-selector request and different numbering.
- Numerics in mode docs/defaults are proposed; preserve sources and resolve balance at each later mode milestone.
- Penalty visual is conceptual and not a final approved production master (visual_references/NOTES.md).
- Graybox primitives are expressly authorized in M2; they are not substituted production art.
