# PvP rally quality

Baseline: `5f4a508` main, rule version `football-3d-11`.
Patch: `football-3d-12`.

The earlier pacing release reduced match lengths but still produced slow rebounds and avoidable own-goal sequences. This patch addresses friendly rear contacts first, adds bounded outfield movement, improves sustained speed, then measures attacking involvement as well as duration.

## Changes

- Friendly rear receptions clear laterally around the physical player and complete the forward pass only once the trajectory clears its body. There is no ball teleport or invisible goal blocker. Opposing contacts cancel the reception. Pass rewards retain their cooldown.
- Defenders occupy outside lanes clear of the central boot shot. All six players track the ball laterally at bounded speeds and settle on close approach. Rendered positions use the physics positions.
- Low-speed traps behind the boots restart for the defender. Goal-bound slow shots continue naturally without recovery assistance. Ordinary own goals and valid goal-line crossings still count.
- Kickoffs rise from 6 to 8 world units/second; role kick floors become 10/11/13. PvP ball/rail rebound retention improves. The existing maximum speed of 16 remains unchanged. Keepers remain exclusive to Penalty.
- Goals record last physical touch and last powered kick for diagnosis. A defending last touch alone is not classified as an unforced own goal.

## Matched simulation evidence

24 first-to-three matches per version: four seeds, three CPU difficulties, and two scripted blue input strategies. No ball, clock, score, or state overrides. See `baseline.json` and `current.json` for the exact method and per-match results.

| Measure | Baseline | Patch |
|---|---:|---:|
| Completed matches | 24/24 | 24/24 |
| Uncontested own-goal sequences | 19/108 goals | 0/88 goals |
| Mean ball speed, world units/second | 6.02 | 10.06 |
| Active time below 6 units/second | 55.64% | 14.80% |
| Forward attacks reaching the attacking third per minute | 10.84 | 47.45 |
| Powered boot strikes per minute | 10.60 | 36.69 |
| Recovery impulses per minute | 11.90 | 4.72 |
| Longest gap without player/boot contact | 13.58 seconds | 3.17 seconds |
| Median first-to-three duration | 86.93 seconds | 29.88 seconds |

An uncontested own-goal sequence means the conceding team made the last powered kick with no opposing player/boot touch afterward. This is narrower than all defensive deflections. Zero observed in this sample does not guarantee zero in all games.

Shorter matches are not the sole acceptance criterion. The automated inputs can lose quickly; the 10.5–95.8 second match-duration range needs human balance testing. Physical iPhone frame rate, touch feel, and speaker output were not measured.

## Verification

- `node --test tests/football-*.test.mjs`: 120 passing tests, including rear friendly receptions for all roles/teams/side assignments, bounded motion and collider alignment, pause, safe recovery, legitimate slow goals, canonical replays, and shared-mode/server regression coverage.
- `npm run build`, followed by a final `node node_modules/vite/bin/vite.js build`: passed. Existing bundle-size warnings remain.
- `scripts/qa-football-pvp-gameplay.mjs`: mobile Chromium/software GPU; real touch input drives both boots into real Rapier contacts, releases/cancels correctly, verifies both goal/restart rules and all six rendered player positions, then runs an unfrozen rendered rally. Ball-placement fixtures are explicit. Details are in `browser.json`.

Re-run the comparison with:

```sh
node scripts/qa-football-pvp-quality.mjs . docs/football-pinball/evidence-pvp-quality/current.json docs/football-pinball/evidence-pvp-quality/baseline.json
```

The comparison fails for incomplete matches, excessive unforced own-goal sequences, insufficient sustained speed or attack/boot involvement, prolonged midfield orbits, or stationary players.

Rollback is a revert of this patch as a unit. Canonical replay validation uses the bumped rule version; external match servers must run the same engine/rule version as their clients.
