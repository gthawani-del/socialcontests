# Contact-driven penalty gameplay

Implements the accepted changes in order:
1. A moving ball feeds into a receiving pocket ahead of the boots. Its position remains at or above the rear limit through feeds, missed swings and role changes.
2. Releasing rotates a boot collider. Only an actual overlap with the forward-moving boot launches a shot. Contact normal determines lateral direction; left and right are mirrored physical strikes, and release timing changes the contact angle.
3. Holding charges swing speed. One power bar replaces the independent timing oscillator. Low/High selects shot elevation; there is no lateral target selection.
4. CPU shots use the same contact solver. A winding-boot highlight and imminent-kick cue precede contact. The opposing keeper shifts weight and reacts only after observing flight.
5. Outcome text is derived from contact angle, missed overlap, body/hand saves, actual dive direction and goal bounds. Shot power remains visible after release.
6. Match pressure evaluates hypothetical goal/stop results through the real winner rules. Standard role switching, paired sudden death, and Fixed Role remain intact.

## Validation

- `node --test tests/penalty-duel.test.mjs`: contact-only launch, missed swings, input-dependent direction/speed, feed containment, cancellation/pause, CPU cue/contact, keeper movement, both roles/formats/all difficulty match completion, pressure rules and keeper collision.
- `scripts/qa-penalty-contact.mjs`: normal-speed browser matches with real touch input, no gameplay-state mutation. Covers mobile Standard (including sudden death in the recorded run), small/landscape Fixed Role, charge cancellation, actual swing/contact distances, CPU preparation, height selection, score/result and rematch. Screenshots are WebP.
- Build and diff checks pass. Generated cricket asset-inspection timestamps are excluded.

This is a lightweight 2D arcade contact solver, not a full 3D rigid-body football simulation. Both collider and sprite use shared boot geometry and the current canvas aspect ratio. Post/keeper outcomes end the attempt; there is no rebound rally. Browser QA establishes functional behaviour, not player enjoyment or physical iPhone performance. The next product check is a short user playtest focused on whether direction, power and save timing feel learnable.
