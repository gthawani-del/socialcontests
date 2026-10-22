# Six-ramp return guide

## Implemented in order

1. Added a descending return guide from the six-ramp finish back to open field. Physics and visible deck/rails use the same points. Unqualified six attempts enter this guide with their existing speed; gravity and damping govern travel. Qualified sixes retain their existing result.
2. Verified continuous movement, ground-contact history, return at field height, no duplicate release/count and reset. The reproduced left-bat shot now returns for TWO under existing field-return scoring instead of escaping for DOT. Right remains FOUR.
3. Compared 252 timed shots per bat across medium/fast bowling and six powers, with identical inputs replayed for player and CPU. Exact role parity passed. Left: 20 safety escapes before, zero after; right: zero before and after. Both sides: 159 contacts and 95 wickets. Total runs: left 297 before / 337 after; right 292 before / 292 after.
4. Kept other geometry, stroke and CPU settings unchanged. The preferred route varies by timing/power; the sweep does not justify forcing equal runs on every mirrored shot. No human win-rate claim.

## Verification

- Full automated suite: 307 passed, zero failed.
- Targeted centre-stroke and ramp tests passed after final test-helper change.
- Browser real touch: left/right/both physical bat contact, one count each; left return starts and finishes while delivery remains open, then scores two.
- Mobile screenshot inspected: visible return guide, gameplay board and controls.
- Batting browser regression: six-ball innings, separate two-wicket finish, actual touch release/cancel, shot selection and reset passed.
- Build passed; existing large-bundle warning.
- Built production-route browser check passed: access, toss, CPU delivery, bowling plunger and reset.
- Bounce/spin browser check passed.

Seeded accelerated fixtures are reproducible mechanics checks, not human win-rate measurements. The balance sweep covers straight centre balls on Easy; it is not an exhaustive balance assessment.
