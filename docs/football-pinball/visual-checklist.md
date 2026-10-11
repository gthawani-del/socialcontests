# Football Pinball — sequential visual correction

Reference: `specification/04_ASSETS/visual_references/pvp_reference.jpeg` (the user's Image 2).

Work on one item per review pass. Judge the actual game at phone size. Technical checks do not equal visual approval. Keep shared assets reusable across modes. No main merge or deployment is included in these review passes.

| Order | Item | State |
|---|---|---|
| 1 | Camera and framing: closer action, taller gameplay area, less empty crowd space, both goals visible | Implemented and technically verified; visual review pending |
| 2 | Cabinet depth and substantial raised walls | Broader profiled cabinet implemented; visual review pending |
| 3 | Sculpted side rails, channels and inset lights | Pending |
| 4 | Boot silhouette and material fidelity | Leather/panel/lace/lining separation revised; source silhouette still below reference |
| 5 | Player anatomy, pose, scale and clothing | Revised; still below reference |
| 6 | Compact raised player bases and luminous rings | Pending |
| 7 | Distinct player kits and numbers | Reference blue/white/gold kits and 4/6/8, red 7/10/11; surface-fitted numbers implemented |
| 8 | Goalkeeper prominence and placement | Removed flattened body fit; further pose/asset work pending |
| 9 | Goal frames, net depth and integrated lighting | Pending |
| 10 | Raised skill/pass target assemblies and symbols | Pending |
| 11 | Substantial triangular combo assemblies | Pending |
| 12 | Pitch shading, centre artwork and direction markers | Pending |
| 13 | Ball presence and velocity-driven trail | Pending |
| 14 | Red/blue light spill and material separation | Two local spill lights, softer chrome and adjusted key/fill balance; visual review pending |
| 15 | Continuous stadium crowd and visible floodlights | Pending |
| 16 | Compact player scoreboard, portraits and match information | Pending; use actual player/match data |
| 17 | Flipper controls seated in cabinet corners | Pending |
| 18 | Compact match actions/settings | Separate pre-match setup; circular control dial, in-board Start, guide in Help; review pending |
| 19 | Connection status and chat | Pending; real functionality required, no invented latency or messages |
| 20 | Illustrated component guide | Pending |
| 21 | Branded footer | Pending |
| 22 | Final composition and cross-mode reuse review | Pending |

## Earlier camera pass (superseded by dial layout)

- PvP field of view: 60 degrees; camera offset ratio: 0.7; near-side focus: 1.5 table units. Red view mirrors the camera.
- Arena aspect ratio: 0.98 after user feedback that the 0.88 pass appeared too narrow. Cabinet outer width increased from 7.22 to 7.60 table units; inner playable field remains unchanged.
- Distance is fitted against cabinet corners and both elevated goal crossbars with a 3% clip-space margin. Binary refinement avoids the previous coarse zoom-out steps.
- Model geometry, collision rules, HUD, lights and other modes are unchanged in this pass.
- Evidence: `evidence-visual/pvp-reference-{390,430,1440}.png`; reverse-view fixture: `evidence-visual/pvp-camera-red-430.png`.

Verification: build passed. Chromium checks passed at 390×844, 430×932 and 1440×1000 with all 12 models loaded, no page errors, no horizontal overflow and both 88px controls inside the viewport. Both camera ends were inspected. Existing disclaimer/demo-login checks passed. Physical-device performance remains unverified.

## Settings and cabinet pass

- Match settings are a native modal dialog opened by the top-right gear. No collapsed settings row remains below the board.
- Options persist between dialog openings. Active match options remain locked. Opening settings pauses local active play, clears held inputs and resumes only if this dialog caused the pause. Online matches continue with local input blocked while the modal is open.
- `view/cabinet-kit.js` builds a reusable chassis, lower metal band, rising side/rear wall, bevelled metal lip and dark seam. The near apron remains low to keep the near goal visible.
- Camera fit includes the broader cabinet and raised wall height. Physics dimensions and target positions are unchanged.
- This is a cabinet/settings pass, not completion of the reference artwork. Boots, figures, target bodies, lighting spill and scoreboard still require separate review.

## Text, figure presentation, boot materials and lighting pass

- Existing guide copy is preserved. Guide type increases to 11px with a system sans face and readable line spacing; phone layouts scroll the five entries instead of shrinking the text. Target captions increase to 9px while symbol size is reduced to keep the hierarchy balanced.
- Reference kit colours and shirt numbers are presentation only; blue rings still identify the near team. Numbers are placed using intersections with the actual shirt mesh instead of fixed depths that concealed them.
- The keeper uses uniform model scaling, retaining the source figure proportions. Physics remains unchanged; this is presentation fitting, not a new keeper asset.
- Boot leather has lower metallic response, contrasting panels, matte laces and lining, and quieter stitching. Source GLBs are unchanged in this pass.
- Chrome has softer reflections; the key/fill balance opens figure shadows. Two unshadowed coloured lights add local red/blue spill without extra shadow maps.
- Original text zones only: existing UI/guide copy, target labels, team numbers and existing stadium signage. No new slogans, fabricated match data or decorative text.
- Remaining gap: source anatomy, boot shape and target construction still do not reach the supplied concept's fidelity. These adjustments must not be described as completed photoreal assets.

## Dial and gameplay layout

- Existing four-mode selector remains the preceding screen. PvP opens a full setup screen before the user enters the board.
- The gameplay header contains the scoreboard and one circular control trigger. Start is a temporary board overlay. Boot controls remain permanently placed at cabinet corners.
- The five-action dial contains Resume/Pause, Sound, Restart, Help and Exit. Restart and Exit require confirmation. Help includes the former guide, rules and graphics selector. No action row or guide consumes space beneath the board.
- Local live phases, including countdown and goal transitions, pause while a panel is open. Moving from the dial into Help/confirmation preserves that pause. Online play continues; input is blocked while any panel is open.
- Camera fit uses 45-degree field of view, 0.5 offset and 0.5 near-side focus. The board canvas is capped by available screen height and 1.5 times screen width, preserving cabinet proportions rather than stretching geometry. The gameplay root now follows that content height instead of retaining a full-screen minimum; the cabinet is bottom-aligned in the camera projection.

## Formation and unused space correction

- Removed the gameplay root full-screen minimum that left an empty region after the canvas. The actual game component ends with the cabinet controls. Tall browser windows can still have space outside this component; the table is not stretched to fill them.
- Red centre target moves to y=1.2, ahead of red wings at y=1.65. Blue centre stays y=-2.4 behind wings at y=-1.65. Shared rule coordinates drive both meshes and physical colliders. Rules version advances to football-3d-4 because canonical physics changed.
- Proof: evidence-visual/formation-layout-430.png is a Playwright screenshot of the running game component, captured at 430px width. Rendering is frozen for software-GPU capture; this is not a performance benchmark.
- Foundation, mode and server checks: 54 passed. Production build passed. No merge or deployment.

## Team jersey correction

- Supersedes the earlier mixed near-team kit colours: all blue players and keeper wear blue; all red players and keeper wear red. Removed per-position white/gold overrides. Shirt numbers are white for contrast.
- Verified in the running game with Playwright: evidence-visual/team-jerseys-430.png. Production build passed. No deployment.

## Ball scale and team selection

- PvP ball radius reduced from 0.18 to 0.11 world units. Rendered GLB diameter now derives from measured asset bounds and equals collider diameter; this is a proportional game-art adjustment, not a claim of a metres-calibrated stadium. Canonical rules version: football-3d-5.
- CPU preflight includes Countries/Clubs and independent choices for both sides. Curated catalogue: 34 countries and 24 clubs, with Colours of Football source URLs in ui/team-selection.js. Selected names carry into the HUD. Jerseys remain consistent blue/red. No source artwork copied.
- Online team identities are explicitly unavailable until synchronized through the authoritative session; client-local choices are disabled for online matches. Exact real-world kits are not implemented.
- Playwright verified club selection, changing category, country selection, setup-to-game navigation and retained HUD names. Evidence: team-selection-430.png and ball-team-selection-430.png. Physics/foundation/server: 54 passed. Build passed. Not deployed.

## Team kit mapping

- Supersedes fixed jersey colours: every country/club in the current catalogue has a simplified home and alternate palette. Team selection colours all three players and the goalkeeper consistently. Two-colour shirts use stripes; Croatia uses checks. These are game-art palettes inspired by historical kits, not verified current-season replicas; hexadecimal colours are authored approximations.
- Boot flippers, base rings, targets, HUD side indicators and control buttons retain their blue/red identity. Jersey rendering changes only player Team_Primary materials and shirt-number contrast.
- Automatic colour separation prefers home/home; close palettes choose the strongest available home/alternate pair. Selection text names the chosen palette. No physics changes.
- Playwright checks country mapping, club clash resolution, eight player/keeper jersey materials and four boot side identities. Proof: team-kits-setup-430.png and team-kits-gameplay-430.png. Unit checks cover catalogue completeness and clash handling. Online identity synchronization remains outside this CPU-only feature. No deployment.
