# PvP pacing update

Base: `ada88c2d460b8f02ae3849ae190ef502907c5452`. Rule version: `football-3d-11`.
The existing PvP setup artwork and interactive controls are preserved.

## Changes

- PvP goalkeepers are removed from physics and rendering. Penalty Shootout retains its keeper. All six midfield players, goal geometry and boot shot limits remain.
- Player contacts and the pass target preserve incoming horizontal speed instead of replacing a strong shot with a slower fixed pass. Role minimum speeds are 8/9/11 units per second; the existing maximum of 16 remains.
- Kickoff and recovery speed rises from 4 to 6. Goal and out-of-play restarts take 0.5 seconds.
- Recovery starts after 0.35 seconds of slow grounded movement, or 0.7 seconds of slow bouncing above the pitch. The latter fixes a ball repeatedly bouncing on a boot without reaching the old grounded-height condition. Recovery awards no points.

## Verification

88 regression tests passed:

```sh
node --test tests/football-pvp-gameplay.test.mjs tests/football-modes.test.mjs tests/football-server.test.mjs tests/football-crash-motion.test.mjs tests/football-crash-rounds.test.mjs
```

The production build passed. Vite's existing large-chunk warning remains.

`matches.json` records 36 first-to-three matches across easy/medium/hard CPU, six seeds and two automated input strategies, plus nine classic timed rounds. All 45 completed through normal game rules. No ball, score, clock or state was overridden. No slow episode lasted one second and no keeper-save event occurred.

First-to-three elapsed simulated time: **86.925-second median**, 146.533-second 90th percentile, range **15.358–172.833 seconds**. The three matched baseline scenarios improved from 727/380/340 seconds to 59/98/114 seconds. The 15-second outlier was a genuine 0–3 result across three separately scored balls, with five physical boot strikes; it was not duplicate scoring. Automated taps do not establish human difficulty balance. A fast loss remains possible; this is not a guarantee that every match lasts two to three minutes.

```sh
node scripts/qa-football-pvp-pacing.mjs
```

`browser.json` verifies real CDP touch press/release/cancel, actual boot angles and Rapier contact with strong forward velocity, recovery, an open-goal crossing, a single 0.5-second restart, and six rendered midfield players with no keeper visuals. It also observes an unfrozen rendered rally. Console and HTTP error lists are empty. Screenshots at 390 and 430 pixels were visually reviewed.

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
CHROMIUM_PATH=/absolute/path/to/chromium \
node scripts/qa-football-pvp-gameplay.mjs docs/football-pinball/evidence-pvp-pacing
```

Contact checks use ball-placement fixtures and manually stepped physics. The full-match simulations do not. Chromium uses a software GPU; this does not establish physical iPhone frame rate or human play feel. Previous evidence remains in `evidence-pvp-gameplay` for comparison. Rollback is a revert of the pacing commit; no dependency or database changes are involved.
