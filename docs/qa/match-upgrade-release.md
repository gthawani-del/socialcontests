# Cricket Pinball match upgrade

Implementation scope: the original 15 agreed improvements. Later proposals for confidence, field tactics and multiball are outside this release.

| # | Improvement | Implementation |
|---|---|---|
| 1 | Clear bowling lever | Ivory grip, dark housing and visible spring; no idle halo; drag feedback only. |
| 2 | Compact score HUD | Three short cells, 44px mobile height; full scorecard remains available by tapping the score. |
| 3 | Bowler profiles | Fast, medium pace or spinner selected per bowling innings; UI, CPU and launch validation share a legal delivery catalogue. |
| 4 | Length and bounce | Full, good and short select physical bounce position/rebound; field target and graphical length picker reflect selection. |
| 5 | Living stadium | Restrained foreground crowd movement, occasional camera flashes and reactions; reduced-motion and low-quality settings respected. |
| 6 | Delivery sequence | Preparation, actual lever release, pitch bounce, bat contact and result events drive coaching/feedback. |
| 7 | Timing feedback | Early/perfect/late from actual contact; missed only when no contact occurred; CPU timing labels hidden. |
| 8 | Shot placement | Existing timing/contact-based steering preserved; guidance and batting practice added to learn the scoring targets. |
| 9 | Adaptive CPU | Legal tactical delivery variation and chase-aware length; limited recognition of repeated deliveries; outcomes still use shared physics/scoring. |
| 10 | Dismissal explanations | Cause taken from recorded metadata; no invented bowled/caught labels. |
| 11 | Ball readability | Height-sensitive shadow, short trail, bounce cue and restrained impact particles. |
| 12 | Match tension | Runs needed/balls remaining, final-ball label, result summary and final scorecard entry. |
| 13 | Coaching/practice | Event-driven first-delivery guide; replay in scorecard; dedicated six-ball batting/bowling practice from lobby. |
| 14 | Mobile safeguards | Touch cancellation, pause ownership, explicit resume after interruption, context-loss recovery, automatic/manual graphics quality. |
| 15 | Balance measurement | Opt-in local telemetry grouped by profile, delivery, length, line, power and difficulty; practice separated; reproducible seeded simulator. |

## Validation

Offline trajectory coverage exercises all 405 legal bowler/type/length/line/power combinations: one bounce and arrival within batting height. Profile balance report covers 13,500 centre deliveries across 135 cells at 60% power, with zero unresolved outcomes. Normal-difficulty straight/good/centre wickets per100: fast15, medium18, spinner35. These are seeded CPU fixtures, not player win rates.

Browser gates: `qa-batting-regression.mjs`, `qa-bowling-feedback.mjs`, `qa-bounce-spin.mjs`, `qa-match-upgrade.mjs`, and `qa-stadium-route.mjs`. QA fixtures explicitly distinguish accelerated waits/manual physics stepping from production-default timing. Screenshots are inspected separately from gameplay assertions. Physical iPhone GPU, battery and speaker behavior is not established by Chromium emulation.

Reproduce balance report: `node scripts/report-bowling-balance.mjs`. Opt-in runtime telemetry: add `telemetry=1` to the play URL; data stays local and capped at200 deliveries.

Final local gates:133 automated tests passed; production build passed; all five browser scripts above passed. Actual-input batting fixture completed12/0 across six counted deliveries with six contacts. A separate untouched centre/good fixture verified first-wicket continuation and two-wicket finish. Production-default route passed access gate, toss, automatic CPU delivery and human lever delivery without runtime errors. Upgrade browser evidence verified44px mobile HUD, four viewport layouts, legal profile menus, distinct landing positions, interruption resume and graphics quality controls.
