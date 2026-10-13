# Cricket toss presentation

The call, flight, result and innings-choice screens now share one coin component and one fixed card layout. Heads uses a cricket ball and tails uses stumps, drawn in the same gold medallion style with matching labels. Both faces measure 128px on portrait/desktop and 96px in short landscape layouts. A modeled CSS rim adds thickness during the end-over-end flip. The two choice buttons share equal widths and 52px height (48px in short landscape).

The result uses a clear winner heading and a separate result label. The stadium dims during the toss, and the stale settings/commentary footer is hidden. Normal gameplay controls return when the innings starts. The random outcome, result hold and match scoring rules remain unchanged.

Validation:
- Production build and all 271 unit tests passed.
- Extended `qa-bowling-feedback.mjs`: matching coin/label dimensions; stable panel bounds from call through animation, result and buttons; minimum touch sizes; no overflow; hidden stale footer. Checked 390×700, 320×568, 844×390 and 1365×900.
- Verified 56px vertical lift, end-over-end rotation, heads/tails final faces and no early result while the animation is paused.
- Existing bowling checks passed: mobile touch pull/cancel/release, one counted delivery, field controls and pause behavior. Inspected the shaft/spring screenshots at all four sizes.
- `qa-batting-regression.mjs` passed: actual touch-driven flipper angles, contact/scoring, six counted deliveries, independent two-wicket early finish and scorecard/pause behavior. This uses seeded/accelerated gameplay fixtures.
- `qa-stadium-route.mjs` passed: real access UI, production timing for toss, CPU delivery, first counted ball and human bowling. Added checks for CPU calling/winning, controls returning, restart cancelling a flight, and reduced-motion result/choices; all passed.

Screenshots of the call and both results were visually reviewed. Tests used headless Chromium with simulated touch; physical iPhone Safari behavior and phone audio are not certified by this run.
