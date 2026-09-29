# Stadium physics prototype

Based on Jutsu project `4118757a-3b8d-4152-8cd2-1f5df64d4aec`, revision 2.
This configuration and engine are opt-in and are not loaded by the production game.
The local Vite route `/cricket-pinball/stadium-prototype/` loads the real revision-2
GLB into a full match screen with setup, toss, CPU, innings, chase and tie-break.
A development-only `?practice=1` mode preserves isolated shot QA. This route is
not yet a production build entry point.
Match rules and existing production table configuration are unchanged.

## Implemented

- Uniform Blender-to-engine scale 0.45; Blender y maps to negative engine z.
- Oval boundary, bat placement, central drain and scoring positions.
- Six ramp uses the authored 30-point centreline, with its first point lowered to
  ground level. Its replacement runtime deck is built from the collision samples. Ball height is
  an offset above the field; a renderer must add it to surface height and ball radius.
- Forward mouth entry captures the ball onto a constrained route. Uphill gravity
  slows the shot; insufficient speed returns it to the field. This is an arcade
  route model, not free-body 3D physics or lateral motion between ramp rails.
- Six requires reaching the route finish after legal bat contact. Passing under
  the finish cannot score. Resolution freezes the ball; reset clears route state.
- Bowling originates at the far end. Left/centre/right guidance ends before bats.

## Evidence

### Approved concept: first geometry implementation pass

`stadium-art.js` replaces the old pitch, crease marks, block bats, and six-ramp
surface with editable Three.js geometry. This is a local development review,
not the finished colosseum architecture, a new GLB export, or a deployment.

- Pitch wicket lines: engine z=2.43 and z=-0.22, 2.65 arena units apart.
  The explicit conversion is 20.1168 / 2.65 metres per arena unit. Rendered pitch
  dimensions therefore represent 22 yards by 10 feet, without changing physics
  speeds or silently treating the old miniature GLB units as stadium metres.
- The batting wicket sits on its line immediately behind the resting bat tips.
  Popping creases are 1.2192 represented metres inside each end. Arcade bats,
  ball and stumps are deliberately enlarged; this is not a regulation-scale simulation.
- Tapered, bevelled willow blades, dark grips, grip rings and vector-geometry
  CRICKET PINBALL branding replace the old rectangular bats. Both use the live
  physics centre/angle; no generated image textures were added.
- Six-ramp mouth y=0. Its visible deck uses exactly the engine route samples;
  the renderer checks upward normals and surface/physics parity. Existing support
  posts and the finish height are retained. The return slot remains rectangular.
- Playwright verifies actual rendered pitch bounds, ramp parity, timed 1/4/6
  shots, bat alignment and mobile/desktop/landscape layout. Results and screenshots
  are in `stadium-playable-results.json` and `stadium-playable-*.png`.

Remaining art work: pavilion architecture, stadium roof/floodlight treatment,
deeper scoring tunnels, richer ground materials and final camera composition.
No paid generation, Form gate, Runtime approval or publishing gate is claimed.

65 Node tests passed, including all formats and existing match/toss rules.
18 Chromium checks passed through Playwright, with no page errors.
An additional Playwright run loads the actual GLB and uses button inputs to score
1, 4 and 6 from normal launches. Bat centres agree with physics within 0.00001
engine units; the six reaches a deck height of 0.48825. Screenshots named
`stadium-playable-*` and `stadium-six-*` show the real WebGL prototype.
Tests use deterministic simulation stepping, not real-device frame-rate measurement.

## Remaining before integration approval

- Low gate posts match the GLB and scoring requires mouth crossing. Bats and ball
  height are bound to the actual GLB and checked in the practice screen.
- Ramp support posts and the low underside now block ground balls. The higher
  span admits ground balls between supports. This remains a constrained arcade
  ramp with planar ground collision, not full 3D rigid-body simulation.
- Bat reach was increased and width reduced to make centre deliveries hittable
  while retaining a missed-ball drain gap. Visual meshes follow the same dimensions.
  The CPU centre trigger is calibrated separately and updates at fixed simulation steps.
  Human reaction time and difficulty still require real-device playtesting.
- Tune difficulty and human timing: deterministic button inputs reach 1, 4 and 6,
  but this does not establish that the game feels fair on a physical phone.
- The committed crowd image is UV-mapped onto all five existing GLB terraces.
  Field, wicket, navy architecture, bats and gold rails have runtime materials.
  Directional shadows distinguish the ball and elevated elements from the field.
  Stadium variants, pitch variants and final visual polish remain separate work.
- GLB revision 2 was imported; no live deployment was performed.

Reproduce browser QA with `node scripts/qa-stadium-layout.mjs` after making
Playwright available. Optional environment variables: `PLAYWRIGHT_MODULE`,
`CHROMIUM_MODULE` (Sparticuz), and `CHROMIUM_PATH`.

Use the same environment with `node scripts/qa-stadium-playable.mjs` for the
real GLB and button-input checks.

Full flow: `node scripts/qa-stadium-match.mjs` verifies reset during toss, CPU
batting, control ownership, target 4 after score 3, normal result, a real tied
match, and a completed three-ball tie-break. It uses seeded RNG and deterministic
simulation stepping with real DOM controls; it does not prove real-device performance.
