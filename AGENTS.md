# Cricket Pinball release checks

For gameplay, controls, table geometry, launch-path or match-flow changes, passing a build and unit tests is not enough to report the game fixed or deploy it.

Before release, verify the changed surface with real browser input and meaningful assertions:
- Left and right touch inputs change actual flipper angles; releasing/cancelling input returns the bats. Verify response while preparing a delivery as well as while the ball is live.
- Bat contact produces an actual physics contact event and the expected scoring response.
- One-over first innings can complete six counted deliveries; a first wicket does not end it. Verify the configured two-wicket early finish separately, and distinguish an early successful chase from a shortened over.
- Each delivery counts once. Dead balls do not count; no stale timers launch another ball after restart or innings completion.
- The ball visibly starts in the side shooter lane, follows its curve without teleporting, and enters the playfield before bat contact.
- The bowling plunger is visible table artwork; its pointer hit area remains aligned after mobile/desktop/landscape resize. Pulling compresses the spring; easing forward reduces power; lifting launches exactly one ball at the current power. Holding still must not increase power. Verify cancellation, returning to zero, and restart during recoil.
- Preserve CPU batting, role changes, chase completion, score HUD, and access gate.
- For toss or launcher presentation changes, run scripts/qa-bowling-feedback.mjs: verify vertical lift/end-over-end flipping and both final coin faces, inspect the visible shaft/spring across all four viewports, and test pull, cancellation and single release. Audio playback checks do not establish physical phone-speaker quality.

For bounce/spin changes, also run scripts/qa-bounce-spin.mjs and tests/stadium-bounce.test.mjs: prove vertical flight, ground-triggered spin, low rebound, and no high-ball bat contact.

Use scripts/qa-batting-regression.mjs for deterministic touch/physics/full-over coverage and scripts/qa-stadium-route.mjs for the production route, access, toss and bowling flow. Extend assertions when a reported failure reveals a gap. Record seeded/accelerated fixtures honestly and keep a production-default check. A clicked button is not evidence that the bat moved. A screenshot alone is not evidence of gameplay. Inspect screenshots for visible regressions too.

Keep edits targeted, preserve current main gameplay when integrating art branches, and group releases to avoid repeated deployment costs. Report local/committed/deployed separately. Do not claim background monitoring without an actual scheduled task.
