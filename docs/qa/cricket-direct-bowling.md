# Direct bowling controls

Implementation order: continuous pitch target and first-bounce physics, movable fielders, balanced delivery/field panel, grouped release.

## Behaviour

- Drag the pitch ring continuously or tap within the bowling area. Arrow keys move the focused target; the optional aim sheet retains large preset buttons.
- The selected coordinates reach match launch and solve the delivery's initial direction and vertical flight. Swing is compensated before release; spin still turns at ground impact. No ball teleport at impact. CPU deliveries retain their existing preset path.
- Red-zone power shows a wider red landing area and applies the existing physical dispersion. Controlled deliveries land inside the gold ring.
- Field opens directly from the bowling dock. Drag either fielder onto a free highlighted slot; the visible figure follows the drag. Release snaps the actual fielder geometry to that slot. Tap a fielder then a spot, or use the native position selector.
- Occupied/illegal drops and cancelled gestures preserve the field. Field settings survive deliveries; Reset restores defaults. Aim and field input lock while a delivery is live or paused. A second input cannot pull the lever while aiming.
- Two equal Delivery and Field cards replace quick left/right chips and Tactics. Guidance describes the new controls. The field editor gives the board the mobile footer space while open.

## Verification

- `npm test`: 282 tests pass after incorporating the concurrent main football release. New physics coverage spans 405 bowler/type/target/power combinations, requires continuous flight and a first bounce within 0.035 table units, and checks actual red-power dispersion/reset.
- `npm run build`: passes (existing bundle size advisory remains).
- `scripts/qa-direct-bowling.mjs`: real touch drag/cancel/illegal/occupied input at 390×700, 320×568, 844×390 and 1365×900. Equal dock sizes; keyboard aiming; accessible field selection; actual first bounce; one delivery counted; field persistence; paused/live locks; no runtime errors. Evidence: `direct-bowling.json`.
- `scripts/qa-bowling-feedback.mjs`: all four viewports, toss faces, lever hit bounds, pull/cancel/single-release, field reset/persistence and pause/launch locks pass.
- `scripts/qa-batting-regression.mjs`: touch changes actual bat angles, cancellation restores them, physical contact/scoring, six counted deliveries and separate two-wicket finish pass.
- `scripts/qa-bounce-spin.mjs`: airborne delivery, ground-triggered spin in both directions and counted result pass.
- `scripts/qa-stadium-route.mjs`: built production route, access UI, toss including CPU caller/winner, CPU delivery, human bowling and reset/reduced-motion flow pass with no runtime errors.
- Inspected full-resolution bowling screenshots at all four sizes, plus field editing, delivery picker and first-time guide. Shaft/spring remain visible and aligned. No horizontal overflow.

Direct-input QA uses bowling practice and manual physics stepping. Batting regression uses seeded/accelerated fixtures. Production-route checks retain production timing. Browser touch/device sizes are emulated; no physical iPhone check is claimed.
