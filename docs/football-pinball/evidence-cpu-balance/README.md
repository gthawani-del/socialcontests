# CPU balance verification

480 distinct completed seeded engine matches: 360 CPU matches and 120 equal-controller pitch-end checks. Repeated after the result fix. SHA256-spread seeds and alternating toss calls replace the earlier consecutive 1–20 seed sample, whose toss coverage was narrow. Results describe scripted input policies, not human win rates. All CPU matches use first-to-3.

| Difficulty | Repeated taps: CPU / player / draw | Approach taps: CPU / player / draw |
|---|---|---|
| Easy | 52 / 7 / 1 | 5 / 54 / 1 |
| Medium | 55 / 5 / 0 | 12 / 48 / 0 |
| Hard | 55 / 5 / 0 | 28 / 32 / 0 |

Equal controllers: near end 61 wins, far end 59. This sample does not show substantial pitch-end advantage; it is not proof of exact symmetry. CPU difficulty progresses with approach-based input. Repeated tapping remains weak at every level. No further CPU strength tuning was justified by these proxy results alone.

Found and fixed: seed 2734170184, Medium, approach inputs reached the safety time limit with blue leading 2–0, but previously reported a draw. Time-limit PvP results now select the score leader; ties stay draws. Full-match rerun reproduced 2–0 and correctly selected blue. Both other time-limit cases were genuine ties.

Validation: 90 targeted tests passed; Vite frontend production build passed. Mobile Chromium (390×844, software rendering) used real Start/toss controls, then an explicitly injected 2–0/time-limit boundary fixture. Result UI displayed `India wins`, `2 – 0`, without page errors. This is not physical iPhone testing.

Run `node scripts/qa-football-cpu-balance.mjs /tmp/football-balance.json` to reproduce. `MATCHES` changes seeds per row (default 60). Existing CPU timing/shot-power/replay tests remain passing. No score-dependent CPU assistance was introduced.
