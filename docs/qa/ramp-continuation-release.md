# Six-ramp continuation and shot diagnostics

Base: 3f2b92e43c9df9690154770d86a6a6cdf1b28c65.

## Changes

1. Preserve the current shaped bat stroke and CPU timing.
2. A completed SIX ramp that fails skill qualification releases the ball with its existing position and momentum, instead of immediately awarding DOT. Gravity applies on departure. Ramp contact remains a ground contact, preventing a false catch or aerial six. Qualified sixes and other scoring zones retain their rules.
3. Record first-contact velocity after skill response and subsequent physical collisions separately. The existing `drive` statistic is explicitly labelled eventual upfield travel, not a direct drive. `directStraight` uses a documented 30-degree cone for reporting only.

## Verification

- 307 automated tests passed; no failures.
- Production build passed (existing large-chunk warning).
- Real Chromium touch centre-shot test passed for left, right and both bats. The left fixture asserted one ramp release, zero counted balls at release, an unfrozen ball, subsequent movement and exactly one final counted ball.
- Batting regression passed: actual touch movement/release, contact, full six-ball innings, separate two-wicket completion, restart and shot selection.
- Four-viewport held-defence/cancellation and mesh-alignment checks passed. Mobile screenshot inspected; controls and bats visible.
- Bounce/spin browser regression passed.
- Built production route passed: access gate, CPU delivery, counting, toss, human bowling plunger and reset.

These are seeded/accelerated fixtures, not human win-rate measurements. Browser software rendering uses low graphics. Production-route check uses the built normal route.

## Remaining limitation

The seeded centre shot at bounce still scores left 0 versus right 4. Left previously ended immediately with SKILL_REJECTED; it now leaves the six ramp, physically exits the table and ends with SAFETY_DRAIN. No runs are invented. Route geometry and scoring opportunities remain asymmetric.

In the 10ms timing sweep, first-hit upfield response is symmetric: four medium samples per side and two fast samples per side. None fall within the defined direct-straight cone. Many eventual upfield shots depend on later rebounds. Do not interpret the legacy 100ms/70ms medium upfield spans as unequal initial bat-contact windows.

Evidence: ramp-continuation-stroke.json, centre-stroke-browser.json, batting-regression.json, cricket-fairness-browser.json, bounce-spin.json, stadium-production-route.json.
