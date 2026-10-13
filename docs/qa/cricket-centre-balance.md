# Centre-delivery balance investigation

## Finding

The reported 95% wicket rate was **not reproduced** in the seeded CPU baseline. No speculative changes to bat geometry, CPU reaction parameters, or scoring probabilities were retained.

Baseline: 2,700 independent physical deliveries; 50 seeds per combination of EASY/MEDIUM/HARD, FAST PACE/SPINNER FLIPPER, FULL/GOOD/SHORT, and power 0.24/0.60/1.00. Seeded bowling dispersion and CPU decisions; original implicit shot-flight behaviour; no forced hits or outcomes.

| CPU difficulty | Wickets / 900 | Rate | Range within a 50-ball combination |
| --- | ---: | ---: | ---: |
| Easy | 386 | 42.9% | 2–70% |
| Medium | 228 | 25.3% | 2–58% |
| Hard | 141 | 15.7% | 0–40% |

At default 60% power, GOOD length, both tested delivery types produced 28/50 wickets against Easy, 8/50 against Medium and 4/50 against Hard. These are reproducible fixture observations, not population estimates or real-device playtest claims. Per-combination counts and reasons are in `cricket-centre-balance-baseline.json`.

## Regression coverage

`cpu-bowling-balance.test.mjs` tests the changed engine with Ground shots to isolate defence from explicit loft/catch choices:

- 2,700 deliveries across the same difficulties, types and lengths, expanded to five powers (0.24/0.40/0.60/0.80/1.00), 30 seeds per combination.
- Each combination must resolve, permit real bat contact and stay below a 90% wicket threshold. This rejects a reproducible near-automatic exploit; it does not certify ideal game balance.
- 30/60/120 Hz rendering must give identical outcomes through the production-style 120 Hz accumulator.
- Repeated-plan adaptation must preserve physical contact and avoid near-automatic wickets.
- Existing all-bowler/length, centre-delivery and CPU decision tests remain required.

The simulation helper previously left bowling dispersion unseeded; it now injects the same seeded RNG into `StadiumEngine`. Optional contact traces include physical contact height, angle and outgoing velocity.

## Scope and follow-up

The actual match loop already updates CPU decisions at the fixed physics frequency. Updating the CPU only at render frequency can cause missed centre contacts, but that artificial experiment does not represent the production loop and is not asserted as the user's root cause.

The new tests use default Ground shots. Deliberate CPU loft selection, catch corrections, device input and full-match flow need the separate browser/engine checks in this release. If the reported exploit persists in play, capture the bowler, delivery, power, length, difficulty, batting role and dismissal reason before further tuning. Sideways bat movement was not introduced without evidence that it solves the problem.
