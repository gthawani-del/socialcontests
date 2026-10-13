# Cricket Pinball: catches, field placement and controls

Base: main `7731bc0182b9631248f92d651dbd1810b62265dd`. Production is unchanged until this branch is approved and merged.

## Changes

- Power bands are materials on the visible spring and shaft. The under-housing scale is removed. Pull travel and pointer projection are preserved.
- Ground is the default shot. Loft is explicitly selected before delivery and committed at launch; contact quality determines height and carry. CPU commits its own intent before launch and uses the same physics.
- A post-contact pitch landing or ramp contact permanently prevents a catch for that shot. Fielder reach now matches the figure more closely. Physical interceptions resolve before other table events in the same step.
- Real lofted boundary crossings score six before a bounce, four after one. Existing pinball ground gates and ramp routes remain. The rear batting-end wall remains a pinball wall.
- Field: Default/Edit offers eight legal slots, rejects occupied slots and locks while playing or paused. Selection persists between balls; a new innings resets the field so one side does not inherit the other's placement. Numbered map pins and named touch buttons avoid overlapping labels on small screens.
- Three delivery chips, tap-pitch aiming and an optional Tactics sheet replace the normal multi-dialog bowling workflow. Keyboard aiming remains available.
- Ground/Loft is above the board rather than adding height to the bottom bat controls.

## Central-delivery investigation

The reported 95% wicket rate was not reproduced. No speculative bat geometry or AI timing adjustment was retained. See `cricket-centre-balance.md` and the seeded baseline JSON. Automated regression covers selectable powers, lengths, repeated plans and fixed-step frame-rate independence. This does not establish that every real-player case is balanced.

## Verification

- Full Node suite: 271/271 passing. Production build passes (existing large-bundle warning remains).
- Batting touch/full-over/two-wicket/shot-lock regression: PASS on final code.
- Bowling/field editor and both toss faces: PASS in four viewports. Delivery bounce/spin: PASS. Built production login, CPU delivery, score and human bowling: PASS, zero runtime errors.
- `stadium-catches.test.mjs`: actual landing then fielder is a dot, actual bat/loft/boundary six and bounced four, moved deep-cover fielder catches an actual loft, each counted once, reset and placement guards.
- `qa-bowling-feedback.mjs`: touch power/cancellation/single release, pitch aiming, field geometry/reset/persistence/lock, viewport bounds and nonoverlapping 44px field buttons at 390x700, 320x568, 844x390 and 1365x900; both toss faces and score visibility.
- `qa-batting-regression.mjs`: both actual bat angles, independent thumbs, cancellation, real bat contact, six-ball innings, separate first/second wickets, pause, audio loading and Ground/Loft locks.
- `qa-bounce-spin.mjs`: real delivery flight, ground-triggered turn in both directions, rebound and one count.
- `qa-stadium-route.mjs`: locally built production route, login/disclaimer, CPU delivery, scoring and human bowling. No development QA hooks in that build.

Browser runs use Chromium software rendering. Deterministic gameplay fixtures use manual physics stepping and reduced graphics; batting fixture extends preparation and shortens waits. The production-route check retains default gameplay timing. Screenshots are reduced-render layout evidence, not production image-quality samples. No physical iPhone verification is claimed.

## Release

One grouped PR. No production deployment in this implementation step. Rollback is a single PR revert if merged.
