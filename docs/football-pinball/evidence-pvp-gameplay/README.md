# PvP gameplay repair

Rule version: `football-3d-10`. Baseline: `bf8879b` (before this patch).

## Behavior

- A moving boot with real ball contact produces a forward shot at 10–14 table units/second, before any earned skill boost. One strike can award power/points only once. Holding a boot up blocks without repeatedly kicking.
- CPU boots predict approaching-ball contact, then release and rearm. Limiting vertical lift no longer incorrectly reduces legal horizontal speed.
- Grounded balls roll gently toward the defending ends. A ball below 1.5 units/second for 0.6 seconds gets a recovery nudge without bonus points.
- A whole-ball crossing inside the goal mouth counts once. A rebound off a post stays live. An escaped miss behind the goal restarts for that defending team after one second.
- A goalkeeper collects a save and restarts after one second, preventing repeated save/boot rebounds behind the boots. Goalkeepers patrol and react to nearby incoming shots. Seeded service lanes avoid replaying one identical kickoff path.
- The HUD distinguishes a goal, a saved ball and an escaped ball.

## Verification

All 80 tests passed:

```sh
node --test tests/football-pvp-gameplay.test.mjs tests/football-modes.test.mjs tests/football-server.test.mjs tests/football-crash-motion.test.mjs tests/football-crash-rounds.test.mjs
```

The production build passed (`npm run build`). Vite retains its existing large-chunk warning.

`rallies.json` records nine complete four-minute classic matches and three first-to-three matches using production physics with automated inputs and no ball, score, clock or state overrides:

```sh
node scripts/qa-football-pvp-rallies.mjs
```

The nine classic scenarios produced 13 goals in total, compared with one in the baseline report. All six scenarios with active blue inputs scored; one idle scenario remained 0–0. The longest continuous low-speed episode was approximately 0.59 seconds in each scenario. All three first-to-three games ended from real goals, with elapsed simulation times of approximately 5.7, 6.3 and 12.1 minutes. **First-to-three pacing still needs human playtesting; completion is not evidence that these durations feel quick.** The fifteen-minute QA cap is a diagnostic limit, not a new match rule.

`browser.json` and the two screenshots record Chromium at mobile viewport sizes 390×844 and 430×932. Real CDP touch input changes both boots' angles and causes actual Rapier contact with strong forward velocity. Touch release and cancellation return the boots. Slow-ball recovery and behind-goal HUD behavior are asserted, followed by an unfrozen rendered rally. Deterministic contact checks place the ball and manually step physics; that part is a fixture, not an unmodified full match.

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
CHROMIUM_PATH=/absolute/path/to/chromium \
node scripts/qa-football-pvp-gameplay.mjs
```

The browser uses a software GPU. Screenshots were visually reviewed for layout regressions. This evidence does not establish physical iPhone frame rate, phone-speaker quality or human difficulty balance. Production deployment is a separate release step.
