# PvP asset rebuild — visual review

Implemented on `fix/football-pvp-visual`. Not merged or deployed. This is a PvP revision, not completion of all four game references.

## Changes

- Rebuilt football boot geometry in Blender: raised heel/collar, broad forefoot, curved sole, studs, crossing laces and fitted side trim. Four independently moving models retain their pivots. Boot triangle count reduced from 42,088 to 15,592 after silhouette review.
- Player kits include collars, shoulder trim and socks, with runtime jersey numbers. Larger figures and two upright keepers remain legible from the lower camera.
- Swept cabinet trim, inset lighting, illuminated goals, turf markings and raised target pads. Stadium banners and a generated crowd texture sit on independent 3D stands.
- Compact player scoreboard and two 88-pixel round controls at the cabinet corners. Existing setup options remain in the match settings disclosure.
- PvP boot collision footprints, player heights, keeper height/depth and ball radius updated with the geometry. Rule version is `football-3d-3`. Goal clearance uses the actual ball radius. Other modes retain their previous ball and boot dimensions.
- Imported static geometry is batched by material at runtime; editable Blender parts remain separate in the source.

## Reusable depth pass

- `view/visual-kit.js` owns the shared team palette, leather/cloth/brushed-metal microtextures, physical boot/cabinet materials, reflection environment, key/fill/rim lighting and contact-shadow helper. Procedural surface noise has its own fixed seed and cannot affect match determinism.
- `view/stadium-kit.js` builds parameterized stepped crowd sections. Twelve image strips and twelve rail sections are merged into two draw calls. The crowd has modest emissive fill to remain readable under directional lighting.
- Layered cabinet rings and metallic target rims provide additional geometric depth. Shadow contrast anchors boots, players and targets to the field. Low detail uses a 1024 shadow map instead of removing shadows; full detail uses 2048.
- This pass changes rendering only: camera, gameplay layout, physics dimensions and rules remain at the prior revision.
- PvP uses the kit first. Other variants can call `createFootballVisualKit(scene, renderer)`, apply `finish(root, assetName, team)` to their cloned models, and use `contact(...)` and `addCrowdTiers(...)` with their own layouts. Each scene owns and disposes its kit; textures are shared within a scene. Importing the kit alone does not change another mode.

## Boot and player construction review

- Boot revision 8 replaces the closed ankle cap with a boolean recess and inner lining. Tongue, eyestays, curved laces, eyelets, side panels, stitching and toe ribs follow the actual upper surface. Trim grids were refined after the first close-up showed intersections.
- Player revision 7 shortens the neck, smooths the head and torso contours, gives the arms a less rigid asymmetric pose and shapes limb volume. Sleeve caps were reduced after close-up inspection. Collar, chest shield and sock bands remain separate kit details.
- The source roots, gameplay pivots, collision configuration and layout are unchanged. Both GLBs keep UVs on every mesh and finite geometry. Boot: 16,336 triangles / 472,548 bytes. Player: 12,207 triangles / 377,056 bytes. Runtime material batching remains active.
- Focused regression passes with `FOOTBALL_QA_SCOPE=pvp`: real mobile touch moves the boot, makes physical contact and releases; a seeded golden-goal crossing updates the HUD and final result once; no runtime errors. Current three-viewport render checks report 173 draw calls.
- These are reusable source assets, currently adopted only by PvP. Source files, exact project revisions, scripts and GLB hashes are in `assets/reference-provenance.json`.
- The models remain stylized figurines and boots. This revision is an improvement in construction, not proof that the concept's realism has been achieved. User visual approval remains pending.

## Verification

- Depth pass: build passes, with the existing Vite large-chunk warning. Direct access and rendering checks pass at both mobile sizes and desktop; 12 models load with no reported asset or page errors.
- The prior depth-only pass used 161 draw calls in the software renderer; current asset counts are recorded in `evidence-visual/reference-results.json`. The low setting preserves depth shadows at a smaller map resolution; this is not a physical-device performance certification.
- 41 engine/server tests pass, including all four boot contacts, whole-ball goal crossing, keeper saves and deterministic replay checks.
- Browser scripts and results are under `scripts/qa-football-{visual,reference}.mjs` and `evidence-visual/`.
- Reference checks cover 390×844, 430×932 and 1440×1000: six player bumpers, two combo targets, in-viewport controls, no horizontal overflow, successful model/texture loads and no page errors.
- Direct PvP URL: disclaimer required, incorrect demo credentials rejected, explicit demo login succeeds. This verifies the existing demo gate; it does not establish a production identity system.
- Full-detail captures are real game renders on software Chromium. Rendering is temporarily frozen for screenshot readback; these images are not physical-device FPS evidence. Gameplay collision tests use explicit seeded ball-placement fixtures and real mobile touch events.
- Both updated GLBs contain finite geometry and UVs on every mesh. Source revisions, hashes and the crowd-generation prompt are in `assets/reference-provenance.json`.

## Review boundaries

Compare `evidence-visual/pvp-reference-430.png` with `specification/04_ASSETS/visual_references/pvp_reference.jpeg`. The live game now follows the reference's boot/player/table composition, but it remains a real-time interpretation rather than a pixel-identical reproduction. No user visual approval has been recorded. Physical iPhone/Android performance remains unverified. Crash, Penalty and Arcade Rush visuals are outside this PvP revision.

The Socialcontests homepage, Cricket card and game remain outside this change.

## Sequential correction: camera and framing

The first isolated correction uses a taller PvP arena and closer perspective, fitted against the cabinet and both goal crossbars. Both player viewpoints have been inspected; mobile and desktop browser checks and the build pass. Geometry, materials, rules and other modes are unchanged in this pass. The ordered remaining work is tracked in `visual-checklist.md`; cabinet depth is next. This is not approval of the complete visual design.

## Sequential correction: settings location and cabinet width

The latest user feedback supersedes the prior taller arena choice: PvP now uses a 0.98 arena aspect ratio and a 7.60-unit outer cabinet, without stretching models or changing the playable field. A reusable cabinet builder supplies the deeper chassis, broad bevelled top lip and raised side/rear walls. The low near apron preserves goal visibility. Camera bounds were expanded to fit the new silhouette; both viewing directions were inspected.

Match settings now opens through the top-right gear as a native modal. It contributes no layout height under the board. During local play it clears inputs and pauses, resuming only when the dialog itself caused the pause. Existing manual pause is preserved. Options stay locked during matches; online play continues while the modal blocks local flipper input.

This pass leaves the other visual checklist items open. In particular, figurine detail/scale, target construction, boot fidelity and light spill still differ visibly from the approved reference. No merge or deployment is included.

Verification for this pass: production build passes (existing bundle-size warning). Chromium checks pass at 390×844, 430×932 and 1440×1000, with 12 assets loaded, no runtime errors, no horizontal overflow and both touch controls visible. Dialog checks cover persisted selection, locked options, Escape/focus return, automatic local pause/resume and preservation of manual pause. Real mobile touch/contact and seeded golden-goal regression pass. Existing disclaimer/demo-login checks pass. Physical-device and Safari checks remain unverified. Screenshots: `evidence-visual/pvp-reference-430.png`, `evidence-visual/pvp-settings-430.png`, and the desktop/reverse-camera counterparts.

## Text and material polish

Guide copy now uses 11px system sans text with natural line spacing and a horizontal phone scroll, preserving all five entries. Target captions use 9px text with smaller symbols. No new marketing copy or invented match data was added.

Player kits follow the supplied reference: near-side blue 4, white 6 and gold 8; far-side red 7, 10 and 11. Team identity remains on the existing coloured bases. Shirt numbers sample the source mesh surface because the former fixed depth hid some numbers inside the torso. Keeper presentation uses uniform scaling rather than fitting the figurine to a shallow box.

Boot materials now distinguish coated leather, darker panels, matte laces/lining and subdued stitching. The shared visual kit softens cabinet chrome, reduces key-light harshness, raises fill and adds two unshadowed local red/blue lights. No extra shadow maps or source GLB changes are part of this pass.

The source figures and boot silhouette remain stylized and below the concept's fidelity. This is a readable-text and material/presentation checkpoint, not a completed source-model rebuild. Physical-device performance and Safari rendering remain unverified.

Verification: build passes with the existing bundle-size warning. Final Chromium checks pass at 390×844, 430×932 and 1440×1000: all 12 assets load, no page errors or document overflow, controls fit the viewport, and settings selection/lock/Escape/focus/pause checks pass. The reverse-view capture also completes. Draw calls remain 173; that does not establish unchanged GPU time.

## Status and rules placement

PvP status text now sits inside the cabinet between the boot controls, rather than consuming a row beneath the board. Rules & controls, including the graphics selector, moves into the existing gear dialog. Other modes retain their current placement. Focused Chromium verification at 430×932 confirms both placements, no document overflow, accessible graphics controls and Escape dismissal. Evidence: `pvp-status-placement-430.png` and `pvp-rules-panel-430.png` in `evidence-visual/`.

## Circular controls and preceding setup screen

The PvP route now opens a dedicated setup screen after the existing four-mode selector. Continue reveals the scoreboard and board. A central Start match button disappears after starting. The horizontal action row and instruction strip are removed from gameplay.

A single circular trigger opens a five-action dial: Resume/Pause, Sound, Restart, Help and Exit. The boot controls stay outside this menu. Help holds the existing guide, rules and graphics selector. Restart and Exit require confirmation. Local countdowns, goal transitions and active play pause while a panel is open; moving between panels does not resume the match. Closing resumes only if opening the menu caused the pause. Online matches retain server authority and continue while panels block local input.

The camera uses a 45-degree field of view and a less foreshortened view; canvas height follows available height and a width-based cap. This corrects the empty cabinet margins exposed by the first full-height canvas trial. Geometry and physics are unchanged.

Proof is captured from the running app by `scripts/qa-football-dial.mjs`: game selection, setup, Start overlay, gameplay, open dial and Help. Captures temporarily freeze rendering for software-GPU readback and explicitly redraw after resizing. Tests use an explicit demo-access fixture. Online-server behaviour and physical-device performance are not certified by this local test.

Verification: production build passes with the existing bundle warning. Playwright checks pass for the preceding selector/setup, Start disappearance, touch press/release, local pause across panel transitions, Sound, cancellation of Restart/Exit, confirmed Restart, no horizontal overflow and visible controls at 390/430/1440 widths. No runtime errors were reported. Software screenshot readback uses a preserved framebuffer only in development with `?qa`; production rendering does not enable it. The current asset-fidelity limitations remain unchanged. No merge or deployment is included.
