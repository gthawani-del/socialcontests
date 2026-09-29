# Cricket Pinball stadium revision 5

## Direction and scope
The stadium is the playing arena: navy and gold pavilion, stepped crowd terraces, canopy, floodlights, open scoring alcoves, inward-facing branded willow bats and a ground-connected six ramp. This replaces the basic stadium on the normal gameplay route. The cabinet is not selected by this route.

The match formats and rules remain unchanged: 3/6/12 balls, two wickets, toss and bat/bowl choice, CPU opponent, two innings, target score plus one, and three-ball tie-break. Runs require legal bat contact; a ramp awards its score only on completion.

## Geometry and physics
- Authored in Higgsfield 3D Jutsu project `4118757a-3b8d-4152-8cd2-1f5df64d4aec`, revision 5. Reproducible source: `scripts/build-stadium-colosseum.py`.
- Runtime asset: `public/models/cricket-stadium-colosseum-r5.glb` (3,150,716 bytes).
- Pitch length 20.1168 metres (22 yards), width 3.048 metres. Measured from loaded geometry in browser, not inferred from a label.
- Six ramp mouth is at ground height. Loaded geometry and collision route differ by less than 0.000001 arena units.
- Alcoves have real Boolean openings. Normals are recalculated before subtraction. Authoring ray checks pass through each mouth to the rear wall: single/double front z -0.05625, first surface z -0.2825; straight four front z -1.51875, first surface z -1.745.
- Side posts and rear walls collide. Bowling now starts at the bowling wicket line, z -0.22, clear of the central scoring alcove. Guidance releases before the bats.
- Static meshes are batched by material; bat roots remain independently animated. Browser evidence reports 28 rendering calls and 60,858 triangles. This is not an FPS benchmark.

## Asset provenance
Crowd and toss coin reuse the user's committed assets. Only the turf texture was newly generated, using OpenAI's built-in image generation; no external image-generation service was used. It was encoded as WebP at quality 86 without compositing.

Prompt: “Use case: photorealistic-natural. Asset type: seamless square base-color texture for a cricket stadium outfield in a 3D browser game. Create only an evenly lit, orthographic straight-down photographic texture of dense, professionally cut short green cricket grass. Fine natural blades with restrained olive and emerald tonal variation, dry healthy turf, realistic very small scale detail, no dramatic lighting or baked directional shadows. The entire image is grass. Seamless tileable borders. No pitch, no lines, no objects, no perspective, no text, no vignette, no mowing stripes. Output square 1024 texture.”

## Verification and limitations
Node regressions cover rules, all bowling lines/powers, legal timed shots, ramp completion and rollback, support collision, rear-wall rejection and unobstructed delivery. Playwright uses real controls with deterministic simulation stepping; screenshots and JSON evidence are in `docs/qa/stadium-*`.

Mobile 390×844, desktop 1280×900 and landscape 844×390 are checked. Full match checks cover toss reset, role ownership, chase, result and tie-break. Build uses Vite.

Visual review confirms readable controls and visible open portals. This is a stylized playable stadium, not a photoreal match to the concept image. Physical iPhone/Safari performance, touch feel and sustained FPS remain unverified. Formal independent Function/Form/Runtime approval has not been claimed.
