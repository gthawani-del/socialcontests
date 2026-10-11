# PvP balancing pass — 11 October 2026

This is an engineering balancing pass, not completed human playtesting.

## Changes

- CPU releases each stroke after 12 physics ticks (100 ms), then allows at least 12 ticks to return before another stroke. Difficulty still controls reaction timing. Previously a nearby ball could leave a CPU boot raised for 1,900 ticks (15.83 seconds).
- PvP ascent velocity is capped at 2.2 world units/second after each physics step. Rounded moving boots could inject excessive vertical velocity during sustained contact, not just on contact start. Planar shot direction is retained; goals still require whole-ball crossing below the crossbar. Other modes retain their existing lift behaviour.
- Rules version advanced to football-3d-7 so replays identify this physics revision.

## Evidence

`before.json` and `after.json` use the same nine full classic rounds: seeds 11/22/33 with idle, periodic, and proximity-triggered blue inputs against medium CPU. No ball, score, timer or state overrides.

| Measure across nine rounds | Before | After |
| --- | ---: | ---: |
| Longest CPU hold | 1,900 ticks | 12 ticks |
| Out-of-table events | 44 | 6 |
| Goals | 5 | 17 |
| Maximum observed height | 6.61 | 0.79 |

These small seeded samples diagnose mechanics; they do not establish fair difficulty, player enjoyment or typical scoring rates. Idle-player wins/own goals still occur and need investigation in further CPU and human sessions. Six out-of-table events remain; recovery is implemented, but not every escape is eliminated.

`browser.json` records actual Chromium touch start/end/cancel events against both boots, physical angle movement, Rapier contact, forward ball motion and return to rest. Ball placement and manually stepped simulation are controlled fixtures. Screenshots show the actual rendered game at 390 and 430 CSS-pixel widths. Continuous rendering was disabled for the software-GPU runner; this is not a frame-rate benchmark. Demo access is a fixture, not account-authentication verification.

Validation: 60 scoped physics, modes, service and kit tests passed. Production build passed (existing large-chunk warning).

## Remaining sequential work

1. Human sessions: record difficulty, goals/own goals, unresponsive strokes, drains and whether aiming/timing feels controllable. Repeat across novice and experienced players before calling balance complete.
2. Physical iPhone Safari and Android Chrome: sustained ten-minute gameplay, simultaneous left/right touch, cancellation, orientation, background/resume, audio unlock, mute and speaker quality; measure FPS/frame times, heating and WebGL context loss. Browser emulation cannot establish these results.
3. Public multiplayer: select the existing/intended persistent Node hosting service, configure TLS, allowed origin, stable signing key, real participant identity and two remote clients. The current local service is not publicly hosted.
4. Persistent leaderboards: choose durable storage compatible with that host, retain server-verified results with stable player identities, deduplicate match submissions and test persistence across server restarts. Current local records are not global rankings. No Supabase is used or configured.

Local branch work only. No push or deployment was performed in this pass.
