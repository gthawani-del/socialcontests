# Football Pinball — four-mode checkpoint

Work is on `feature/football-pinball-foundation` in the existing `socialcontests` app. Local implementation commits are listed below; the feature branch has not been merged or deployed.

| Checkpoint | Status and evidence |
|---|---|
| Repository/shared physics | Implemented; Vite/Three.js retained; pinned Rapier3D fixed simulation at120Hz; foundation/Cricket gameplay preserved. |
| Playable PvP | CPU difficulty, coin toss/choice, two goals/keepers, four physical boot flippers, targets, three match formats, side changes and results. Real mobile-touch Chromium test made boot contact, changed physics and released. |
| Crash | One-ball physical survival, fixed-point multiplier, bounded combo, physical targets/drain and Bank Points. Unit/browser checks prove no multiplier physics adjustment and same-tick drain takes priority. |
| Penalty Shootout | Separate short lane, two flippers, physical reactive keeper, five timed attempts and height-classified corner/precision/streak results. Five browser fixture goals produced the expected terminal state. |
| Arcade Rush | 90-second timer, moving targets, physical ramp, relaunch, combos, capped extra time, timed multiball and visible double-point final15 seconds. Device-local top-five records. |
| Online PvP and replay | Same-repo Node authoritative service:120Hz physics,20Hz SSE, ordered participant input, reconnect grace, Ed25519-signed result and canonical replay verifier. |
| Asset pipeline |12 independent GLBs built and inspected through Higgsfield3D Jutsu/Blender, with editable `.blend` sources, reproducible scripts, previews and hashes. Three.js loaded all12 assets; replacement and restart stability checked. |
| Interface | Responsive lobby, mode setup, HUD/results, 56px thumb controls, mute, graphics presets and on-device records; lobby cards show actual rendered 3D arenas. |

## Verification

- `npm test`:189 tests pass, including148 pre-existing repository tests,32 engine tests and9 server tests.
- `npm run build`:passes. Vite reports the pre-existing large Three/Rapier chunks; code splitting remains an optimization.
- Four-mode Chromium Playwright run: touch-driven physical PvP boot/release and scoring; Crash target/bank/pause; Penalty five physical goals; Rush multiball/final result; asset load/replacement; responsive widths360,390,430 and1440; zero page errors.
- Separate two-browser online run: both players' touch input and scores synchronized; actual SSE socket interruption released the held boot, reconnected, and accepted later ordered input.
- Ten restart cycles kept geometry and texture counts stable. Headless SwiftShader frame timing was slow (about5fps in this container); automatic fallback reduced draw calls from103 to75. This is not a physical-device benchmark.
- WebKit/Safari and actual iOS/Android phones could not be tested in this environment.

Screenshots/results: `evidence-ui/`, `evidence-modes/`, `evidence-online/`, and `assets/glb-qa/`. Browser goal/target placement and accelerated terminal clocks are labeled test fixtures; they verify engine transitions, not human skill.

## Commits

- UI foundation and responsive four-mode HUD: `6fa81b3`.
- Blender/Higgsfield assets and validation: `d7d2106`.
- Four-mode deterministic engine: `ed8c924`.
- Authoritative online service and replay: `57b894a`.
- Final controller, QA, evidence and report: this checkpoint commit.

## Open gates and next action

Review the feature branch, then provision approved production hosting, identity integration, persistent signing keys/results and global leaderboard storage. The ZIP does not define reward conversion, badge thresholds or cosmetic unlock rules, so these remain unimplemented rather than invented. Complete Safari and physical-device touch, graphics, thermal and performance QA before release. No merge or production deployment has occurred.
