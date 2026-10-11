> Historical Milestones1–2 record. The user subsequently authorized all four modes. Current status: [requirements](requirements.md), [four-mode report](four-mode-report.md) and [server setup](../../..//server/football-pinball/README.md).

# Football Pinball — foundation

Baseline: main `33291068799ddc8bb05f72f6bebc1fe799034091`.
Branch: feature/football-pinball-foundation. User's ten milestones override the ZIP's M0–M8 numbering. Stop after user Milestone 2.

## Repository inspection (Milestone 1)
The repository is Vite 7, native ES modules/JavaScript, Three.js 0.180, HTML entry points and DOM/CSS interfaces. It is not Next.js, React or TypeScript. Existing access is a sessionStorage client-side demonstration gate, not secure authentication. Reuse `src/access/demo-gate.js` unchanged; preserve root and Cricket routes. No backend account integration is present on this affected surface.

Reuse Three.js, Vite multipage build, existing Node test runner, homepage artwork and access gate. Do not import Cricket gameplay or modify it. Add pinned Rapier 2D compatibility package because the new four-flipper arena needs moving rigid colliders, continuous collision detection and contact events. 2D planar physics drives independently replaceable Three.js 3D meshes; this is a deliberate graybox constraint, not a promise of vertical ramps. Vertical ramp/airborne behavior needs a reviewed 3D physics extension before those assets are built. Avoid introducing React/R3F/TypeScript migration for this isolated module.

## Boundaries
- `core/engine.js`: fixed 120Hz simulation, bounded frame accumulator, Rapier world, input transitions, ordered events, goal reset and scoring. No DOM or Three.js.
- `modes/foundation.js`: versioned graybox geometry and physical tuning; four future mode IDs are reserved, not selectable unfinished modes.
- `renderer.js`: Three.js scene, camera, independent named graybox meshes and interpolation. No score authority.
- `input.js`: pointer ownership/multitouch, keyboard, release/cancel/blur handling.
- `main.js`, `style.css`: gate integration, local practice HUD, launch/pause/reset, lifecycle.
- `football-pinball/index.html`: existing application's additional Vite entry, not another application.

Goal counts only after the whole ball crosses the mouth's plane. One physical goal increments the opposing side by one, once, then stops until a deliberate next serve. Both teams have equal physics; no CPU, toss, tournament result or ranked score is implied. This is local two-team foundation practice only. Launch direction alternates by serve. Physics tuning is provisional.

## Later architecture
Four modes provide their own rules, arena and scoring reducers around the shared tick/input/event core. Input envelopes carry sequence/tick/actor/command; engine events carry version/tick/sequence/ball/target. A dedicated persistent realtime server must own online physics and final scores; clients interpolate snapshots and send inputs. Do not use database polling for frames. Crash requires a pinned canonical runtime, replay verification, server bank validation and signatures before ranked outcomes or fairness claims. The browser event buffer in this graybox is bounded diagnostics only, not an integrity ledger.

## Risks / gates
No real iPhone/Android hardware is attached: browser emulation cannot establish physical touch latency, thermals or mobile Safari parity. Client demo gate is not secure auth. Production assets, audio, CPU, four-mode UI, Crash fairness, leaderboards and network backend are pending. Higgsfield/Blender production is not attempted in this assignment. Starter pack penalty reference explicitly still needs approval. All proposed mode score constants stay proposed pending playtest.

Milestone 1 validation: read all 17 text/config files and visually inspect all five references; verify manifest hashes; inspect root AGENTS.md, build/routing/dependency files, access, homepage and Cricket renderer/physics boundaries. No architecture refactor is required.
