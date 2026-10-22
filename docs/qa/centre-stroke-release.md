# Centre batting stroke — 22 October 2026

Base: bca5f73150778ec10cbc81e99199f24185085288.

The bats now pass more slowly through the nearly horizontal hitting face, then finish their original attacking arc. Stadium bats use 240 degrees/second between -8 and +10 degrees instead of 720 throughout. The held-defence transition starts at 170ms instead of 110ms, allowing the full follow-through to finish. Pivots, lengths, collision radii, scoring rules, restitution and kick are unchanged. The feature is configured only on cricket stadium bats; other pinball tables retain their existing motion.

CPU swing planning accounts for the longer stroke travel. It retains its configured reaction time, miss probability, full timing jitter and single committed estimate. It receives no geometry or scoring exemption.

## Measured effect

Same fixed centre deliveries, Easy physics, deterministic .5 RNG, 180ms press. Press offsets sampled every 10ms from 300ms before bounce to 150ms after. An attacking sample requires first contact with the bat moving in the attacking direction above 100 degrees/second, followed by ball travel to z<1. Returning-bat and stationary-guard contacts do not count as attacking samples.

| Delivery / input | Before: longest successful band | After |
|---|---:|---:|
| Medium, left | 60ms | 100ms |
| Medium, right | 60ms | 70ms |
| Medium, both | 30ms | 100ms |
| Fast, left | 30ms | 80ms |
| Fast, right | 30ms | 80ms |
| Fast, both | 30ms | 120ms |

Widths count consecutive successful 10ms sample bins, not exact continuous thresholds. Medium uses power .5; fast uses .8. These are two controlled delivery scenarios, not all-ball guarantees or human win-rate estimates. Direction/contact ordering can still produce unequal left/right outcomes. All six cases gained successful samples and a wider continuous band.

## Verification

- Full suite: 304 tests passed. Subsequent targeted six-test rerun also covered 8–10 presses/second and identical-input role parity.
- Early held defence remains available across existing pace, flipper, length, power and difficulty fixtures. Late/no-input cases still get bowled.
- Timed upfield shots improved with left, right and both controls. Sampled mashing did not outscore the best timed stroke in those fixtures.
- Existing real singles, ramp boundaries, aerial six, bounced boundary and caught-out tests passed. Deterministic press timings were recalibrated to the new stroke; scoring assertions were retained.
- Actual Chromium touch on the local game: left, right and both each made physical contact, sent the ball upfield and counted once without a wicket. These fixtures press at the bounce and manually advance real fixed-step physics. They are not natural reaction-time or human win-rate tests.
- Four viewport touch defence/cancellation and mesh/collider alignment passed. Mobile screenshot reviewed; existing green stadium trim and commentary glyph appearance were not changed by this patch.
- Batting browser regression passed full six-ball counting, separate two-wicket completion, touch/release/cancel and pause checks.
- Built-production route passed access, toss, role changes, CPU delivery, human bowling plunger and restart/reduced-motion checks at normal match timing.
- Build passed. No new media or service dependencies.

Evidence: centre-stroke-before.json, centre-stroke-after.json, centre-stroke-browser.json, cricket-fairness-browser.json, batting-regression.json, stadium-production-route.json.

Do not interpret this as a target win rate or an automatic centre-ball save. Further tuning should use player feedback on this stroke, not the invalid first balance-test batch documented separately.
