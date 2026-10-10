# Gameplay regression review

## Local changes

Bat input now responds during preparation and continues returning to rest between deliveries. Held input survives the transition into a delivery. The ball starts at the right shooter mechanism, follows the side lane and curved entry, then enters the playfield. A Three.js plunger replaces the visible HTML lever; the input target follows its projected position. Innings messages distinguish six counted balls from the configured two-wicket limit.

## Evidence

- Build passed; all 97 unit tests passed.
- Browser regression passed: each touch control changes actual flipper angles and releases; cancellation resets the bat during preparation. Six deliveries make real bat contact and increment the innings exactly once each, ending at six. No browser runtime errors.
- Production-build route passed: access gate, toss, automatic CPU bowling, first counted delivery, human bowling via the integrated plunger, asset loading, mobile/desktop/landscape captures.
- Deterministic browser fixture uses seeded randomness, low-power pace deliveries, manual physics stepping, shortened result delays and a five-second preparation window. It does not override ball counts or wicket rules. Production-route checks use production settings.

## Open limitations

The reported first-innings ending after one ball has not been reproduced. A new match regression confirms the first wicket does not complete the innings and six legal deliveries do. Existing two-wicket and chase rules remain in effect. Physical iOS hardware was not tested. The side chute uses constrained launch motion; the new visual rails are not general-purpose free-ball collision geometry. Seating edges around the chute need a further visual pass.

These are local changes, not a verified live release. Do not close the one-ball report or describe this review as exhaustive gameplay certification.
