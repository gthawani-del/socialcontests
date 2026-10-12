# Cricket: score visibility, integrated bowling power and catches

Implemented on `fix/cricket-score-plunger-catches`, based on main.

## Behaviour

- The score strip starts hidden, stays hidden through setup/toss/role selection, appears when play is ready and hides again on restart.
- The power scale is part of the 3D plunger housing. The numeric readout follows its handle. The separate pitch meter is removed. Pull down and release to bowl; cancellation restores the prior power without launching. Keyboard arrows and Enter/Space remain supported.
- Red means maximum pace with the existing reduction in accuracy. It does not directly award a wicket.
- Two stationary, marked fielders intercept shots on the outfield. Ground/bounced interceptions are dot balls. An airborne interception within reach before the first bounce is a caught wicket. Balls above reach or outside the zone continue.
- Contact timing and direction determine loft. Mistimed attacking shots directed into the outfield can lift; clean and wide sweeping shots retain their ground/ramp routes. There is no random attacking-shot wicket in this stadium mode.
- Lofted shots have a ground shadow and a cue. Catches lift the fielder's arms, highlight the zone, show CAUGHT and record the dismissal in commentary.

## Validation

- 86 targeted Node tests passed, including seven catch tests and a real launcher-to-bat-to-fielder catch. Existing single/four/six scoring fixtures still pass.
- Production build passed (existing bundle-size warning remains).
- `qa-bowling-feedback.mjs`: passed at 390x700, 320x568, 844x390 and 1365x900. Score visibility, both toss faces, plunger/readout bounds, touch cancellation and one-release/one-delivery passed.
- `qa-batting-regression.mjs`: passed. Independent two-thumb input, actual bat angles/contact, pause/resume, six counted deliveries, separate two-wicket finish, scorecard and audio loading passed. First innings fixture ended 8/0 after six balls. Separate wicket fixture ended 0/2 after two balls.
- `qa-stadium-route.mjs`: passed against the local production build using the real access gate and unmodified gameplay timers. GLB/art loaded successfully, CPU delivered and the first ball counted, and human bowling used the plunger. No runtime errors.
- `qa-bounce-spin.mjs`: passed. Both spin directions retain flight, pitch impact, rebound, physical turn and one counted delivery.

Browser QA used Chromium's software renderer, the app's battery-saver setting and half-resolution canvas. Manual physics fixtures throttle render callbacks to 100 ms; their physics steps remain 1/120 s. Batting fixtures seed selection and shorten result holds. These checks are not physical-iPhone or device-speaker verification. Screenshots are layout evidence at reduced canvas resolution, not production image-quality samples.

Production deployment has not been performed. Rollback is reverting the implementation commit.
