# Cricket Pinball: pitch target, shot colours and pull/push bowling

## Changes
- White target at every power level. Its full outer edge stays within the actual GLB pitch width; drag, keyboard and preset aiming share the same limits.
- Ground uses green (#15803D); Loft uses amber (#F4B544). Selected shots have a checkmark. Locked controls retain readable colours.
- Pull stores charge, including partial power; full pull reaches 100%. Lifting holds it. A deliberate 16 px forward push releases the stored power once, after a 90 ms rod recoil. Clear power and Escape cancel the latch. Pause/restart clear it.
- The visible spring compresses against a fixed stop. Charge, compression, recoil and ball launch use the same control state. Available pull travel adapts to short landscape screens.
- Instruction changes reserve space so the pitch does not shift underneath a dragging finger. Idle and loaded instructions fit the compact dock.

## Verification
- 286 Node tests pass; production Vite build passes.
- `qa-direct-bowling.mjs`: real touch aiming and field placement in 390x700, 320x568, 844x390 and 1365x900. Assertions compare the entire white ring against the loaded GLB pitch bounds. The actual first bounce matches the dragged target.
- `qa-pull-push.mjs`: full touch pull, lift/hold, short-push cancellation, clear power and physical spring compression in all four viewports. A stored 60% charge bowls once. Pause clears charge; a controlled browser clock proves restart cancels a pending recoil release.
- `qa-bowling-feedback.mjs`: both toss faces, stable toss layout, four viewport controls, cancellation, hold/push and one counted delivery.
- `qa-batting-regression.mjs`: real left/right touch and physics contact, six counted balls, two-wicket finish, role/chase/score flow, locked shot colours and timer/reset checks. This uses seeded delivery selection, shortened waits and manual physics stepping.
- `qa-bounce-spin.mjs` and `stadium-bounce.test.mjs`: visible flight, spin at pitch impact, low rebound and no high-ball bat contact.
- `qa-compact-bowling.mjs`: compact dock, actual 100% delivery, last-delivery summary and zero charge before the next ball.
- `qa-stadium-route.mjs`: production build/default timing, access gate, CPU delivery, human pull/hold/push, counting, toss restart and reduced motion.
- Inspected full-size screenshots of the lever across all four viewports and locked shot colours at 390 and 320 px widths.

## Physics measurements
`qa-bowling-physics.mjs` records nine deterministic engine runs at 120 Hz: 30%, 60% and 100% power for fast pace, medium swing and spin. Higher charge increases actual launch speed and reduces time to pitch impact for all three. See bowling-physics.json. Existing flight/spin equations were preserved; this change fixes power input and the mechanical presentation, rather than introducing arbitrary extra speed. Measurements use native arena units, not km/h. Maximum-power accuracy variation is retained.

Browser coverage is Chromium with emulated touch/viewports, not a physical iPhone/Safari test. GPU checks use the game's low graphics setting; production route checks keep normal match timing.
