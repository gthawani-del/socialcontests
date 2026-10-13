# Standard spring plunger release

## Changed behavior

- Pull back to compress the spring. Power and lever colours follow the current pull distance.
- Ease the handle forward while still touching it to reduce power. Holding still adds no power.
- Lift the finger or release the mouse to bowl once at the current power. There is no latched peak charge or separate forward-push trigger.
- Returning fully home, pointer cancellation, focus loss and restart cancel pending launches.
- The rod recoils for 90 ms before ball launch. The existing delivery physics and power calibration are preserved.
- Keyboard: Down increases power, Up reduces it, Enter/Space bowls, Escape cancels.
- Updated coaching, match instructions, accessible labels and help text.

## Verification

- `npm test`: 291 passed, no failures.
- `npm run build`: passed.
- `scripts/qa-pull-release.mjs`: current-displacement power, compressed/expanded spring, current-power colour, holding, touch cancellation, return to zero, one release/one delivery, recoil before launch, focus-loss/resume and restart cancellation.
- `scripts/qa-bowling-feedback.mjs`: both toss faces, lift/flip, four viewport layouts, field state, cancellation and single release.
- `scripts/qa-batting-regression.mjs`: actual flipper angles and touch releases; six contacts across six counted first-innings deliveries; separate two-wicket finish with play continuing after wicket one; shot controls and restart checks.
- `scripts/qa-stadium-route.mjs`: built production route, access gate, CPU batting delivery, human bowling at reduced release power, toss transitions, reset and reduced motion.
- Visually reviewed full-pull screenshots at 390×700, 320×568, 844×390 and 1365×900. The handle and compressed spring remain visible, the white ring remains within the pitch, and the updated copy fits.

## Fixture limits

The focused lever check uses Chromium touch input at four emulated viewport sizes, seeded randomness and manual engine stepping for counted deliveries. Its recoil/cancellation check uses a controlled clock. Batting regression uses deterministic accelerated fixtures. Production route checks retain normal match timing, with seeded toss outcomes and low graphics for the software-rendered browser. These checks are not a physical iPhone/Safari test.

`pull-release.json` records the focused control evidence. The legacy `qa-pull-push.mjs` entry point now runs the replacement pull/release suite. Previously generated QA artifacts are preserved locally and excluded from this release.
