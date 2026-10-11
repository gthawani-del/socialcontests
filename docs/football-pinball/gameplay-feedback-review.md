# Gameplay and feedback pass

Implemented on the feature branch; not merged or deployed.

## Gameplay checks and fixes

Twelve complete engine rounds (three seeds per mode) reached their terminal state using periodic blue-boot inputs, with no score, ball-position or timer overrides. The first run exposed stationary balls in PvP (over a minute) and Arcade Rush. These timed modes now nudge a ball after four seconds below the movement threshold. The nudge awards no points, follows deterministic physics, and is recorded as BALL_UNSTUCK. Crash and Penalty retain their original survival/attempt rules. Canonical rules version is football-3d-6.

Repeat runs reduced the longest observed low-speed period to 479 ticks at 120 Hz. These simulations do not demonstrate difficulty balance or enjoyment. Periodic inputs scored no goals: human timing and shot success still need testing before release.

PvP result headings now retain the selected country/club name rather than reverting to Blue/Red.

## Shared WebGL feedback

- Brief physical impact particles and expanding rings for boot contacts, targets, perfect kicks, keeper saves, goals, banking, multiball and time bonuses.
- Subtle recent-position ball trails; discontinuities are cleared on relaunch/teleport.
- Fixed budget: eight ring meshes, 96 particles in one Points object, three trail lines. No full-screen postprocessing, extra shadow lights or unbounded allocations.
- Low graphics uses four particles per burst and hides trails. Reduced-motion preference removes particles and trails and uses a restrained ring fade.
- Event IDs prevent duplicate feedback; session changes/restarts clear active effects. Pausing freezes effects; ended-round effects fade independently of the stopped physics clock.

## Sound

Synthesized boot clicks, collision thuds, target tones, keeper-save impacts, perfect-kick accents, kickoff/halftime whistles, goal fanfare with a short noise swell, bank/multiball/time-bonus chimes, drain and round-end cues. Sound remains opt-in with a persistent toggle. User interaction unlocks Web Audio; unavailable audio degrades safely. Muting stops queued voices immediately; event throttles and a 20-voice limit prevent collision spam. No downloaded recordings, live APIs or autoplay audio.

## Verification

56 scoped foundation/mode/server/kit tests passed. Mobile Chromium verified all four modes: physical target fixtures, sound graph activation, no repeated event effects, terminal results, restart, reduced graphics and no horizontal overflow/runtime errors. Arcade's browser round advances every remaining physics tick. Target and goal placement fixtures are explicitly identified in the QA report.

Proof screenshots are in evidence-feedback. Continuous rendering was disabled between proof frames because the environment uses software GPU rendering; these captures are not a mobile performance benchmark. Audio graph checks do not replace listening on a device.

## Release dependencies

- Human playtesting and balancing, especially shot timing/goal success.
- Actual iPhone/Android/Safari performance, touch latency and sound review.
- Public authoritative multiplayer hosting, TLS, authenticated identity and durable keys/results.
- Shared online team selection and persistent authenticated leaderboards.
- Other three mode visual rebuilds and final PvP art review remain pending.
