# Pitch bounce and spin release

Base: cbb9dfec45956909cc86b019d572da1bca463524.

- Preserve the right-side shooter lane and curve; introduce vertical flight at its exit.
- Integrate height under gravity, with a low rebound on pitch contact. Apply lateral spin only on the first ground impact. Swing acceleration stops at impact.
- Add Spin left / Spin right to bowling selection. Keep pace, swing and cutter choices.
- Ignore bat collisions above the blade and prevent airborne capture by a ground ramp.
- Add a restrained impact ring; retain ball shadows and existing score/commentary events.

Verification: production build and 109 unit tests passed. New tests cover all seven delivery profiles, three lines and three power levels, ground contact, rebound, spin direction, height-aware bat contact, freeze and reset. The deterministic browser full-over fixture passed six counted deliveries, bat touch/release/cancel, actual contact, scorecard totals/commentary, pause/resume and audio loading/mute. Spin browser checks used the actual selector and plunger, observed height before impact and upward rebound, verified opposite lateral velocities, and counted each delivery once without page errors. Normal production-route results are in stadium-production-route.json.

This is arcade-scale physics with a fixed pitching length per delivery profile. It does not add selectable short/good/full lengths. Physical iPhone validation remains external to the automated Chromium checks. The older report of an innings ending after one ball remains unreproduced; this change does not claim its root cause is fixed.

Rollback: revert this grouped release. No dependencies or external services added.
