# Cricket fairness correction — 21 October 2026

Baseline: cf3db972f6adfac5433caf36d788d7d831f6e607.

## Changes

1. Preserve the full attacking bat stroke, then settle a held bat into a six-degree defensive position after the initial stroke. The visible mesh and physical capsule use the same position. Releasing resets the bat; a fresh press starts a new stroke. This is enabled only by the stadium table's hold-angle configuration. Both player and CPU use the same physics.
2. Resolve all normalized bowling selections to a pitch-constrained target. CPU line/length presets now use the same target and flight solver as the player's marker, instead of the older wide-line guide.
3. Commit CPU swing timing once with the full configured timing variation. Remove continuous centre-ball retiming, the 0.18 centre-error multiplier and repetition-based reaction improvements. CPU can choose the same early held defence, with its normal miss chance and timing error, or attack; no separate collision protection or scoring adjustment.
4. Replace the misleading wait-until-bounce guidance with early defence and timed fresh swings.

## Verification

- Full unit suite: 298 passed, zero failures. Build passed.
- New human-input fixtures: 108 combinations of difficulty, length, power and straight/fast/flipper deliveries survived with actual held-bat contact. Their 108 CPU-role counterparts produced identical outcomes from identical inputs. Fixed random value 0.5 isolates centred geometry, including maximum power without random scatter; these are not human playtests.
- Early defence checked at nine press times from 250 to 650 ms before the measured bounce on each difficulty. No-input controls still reached the wicket.
- The full attacking stroke, held defence, release and fresh swing were checked physically. Existing real-shot boundary and catch tests continue to pass.
- CPU/player preset equivalence checked at the actual first bounce and velocity across bowlers and difficulties. Unit coverage also verifies full timing-error magnitude and that a committed CPU swing is not rescheduled after ball movement.
- Existing stochastic CPU balance fixtures now use the normalized production selection and 100 seeds instead of 20/30, preserving their 85%/90% rejection limits. Repeated-delivery coverage now rejects hidden reaction improvements.
- `qa-cricket-fairness.mjs`: real Chromium two-finger input, actual contact, one counted ball, no wicket on the seeded straight delivery, visible/physical bat alignment, and touch cancellation at 390×844, 320×568, 844×390 and 1365×900. Inspected all four guard screenshots. Evidence: `cricket-fairness-browser.json`.
- `qa-batting-regression.mjs`: preparation/live touch response; independent thumb release; pause; six counted deliveries (12/0 in this fixture); first wicket continues and second wicket ends the separate test innings; scorecard and audio assertions. No browser errors.
- `qa-bounce-spin.mjs`: airborne approach, ground-triggered left/right spin and one counted delivery. No browser errors.
- `qa-stadium-route.mjs`: built production page, access gate, CPU delivery, human pull/release bowling, toss states, restart and reduced motion. No browser errors.

## Limits

Browser fixtures use emulated viewports, low graphics, seeded randomness and manual physics stepping where specified. The production-route check uses normal match timing with seeded toss outcomes. No physical iPhone/Safari testing and no claim of a measured human match win rate. User playtests are still needed to assess overall difficulty; the release does not force wins or losses.
