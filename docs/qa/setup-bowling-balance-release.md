# Match setup, graphical bowling and centre defence

Baseline: main `25441cd229d68db86d44e389da2f4112a182a0d4`.

- Setup panel previously stretched between top/bottom insets and vertically centred its content. It now sizes to content, clears the mobile HUD, and scrolls within short viewports. Form controls remain 16px to avoid mobile input zoom.
- Bowling controls use local SVG pitch and trajectory diagrams. A seven-choice graphical picker replaces the text-only native delivery dropdown; line, delivery, selected state and power remain explicit. No extra dependencies or raster downloads.
- Centre defence previously used a fixed pitch-Z reaction trigger. Fast deliveries could arrive before the scheduled swing, and holding both bats early opened the central gap. The CPU now observes a centre-bound ball earlier, predicts its arrival at the blade-tip contact window and updates the timing as velocity changes. Existing difficulty reaction, miss and timing variation remain; the physics/scoring engine still determines the outcome. Human bats and geometry are unchanged.
- Default centre/straight/60% fixture: Easy wickets 95→54, Normal 74→18, Hard 42→7 out of 100 independent seeded deliveries per setting. Not live user statistics. A 5,250-delivery centre matrix covers all seven movements, five power levels and three difficulties; details in `cpu-centre-balance.json`.
- Automated regression tests assert physical CPU contact and no near-guaranteed centre wicket across speeds/movements, plus difficulty progression. Browser QA covers setup/HUD bounds, all graphic choices, mobile/small/landscape/desktop layouts, toss, plunger cancellation/single release, touch bats, six-ball innings and restart/role flows.

Release as one grouped commit; rollback the grouped commit if necessary. Browser viewport checks do not claim physical iPhone testing.

Production-route capture hit a software-rendering screenshot timeout after gameplay had started. The smoke check was rerun with `QA_SKIP_SCREENSHOTS=1`; all gameplay assertions remain enabled. Four-viewport setup, picker and bowling screenshots were reviewed in the dedicated browser suite.
