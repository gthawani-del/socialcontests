# Cricket Pinball stadium revision 10

## Production baseline
- Runtime model: `public/models/cricket-stadium-colosseum-r10.glb`.
- Jutsu project: `4118757a-3b8d-4152-8cd2-1f5df64d4aec`, revision 10.
- Runtime preserves the lower R9 convergence camera/lighting while loading the R10 geometry polish.
- Gameplay engine, collision routes, scoring rules, toss, innings and pitch measurements remain unchanged.

## Visual convergence included
- Sculpted/petal pavilion silhouette with central mast and tensile roof forms.
- Warm layered seating bands and richer stadium depth.
- City skyline/tower dressing with lit windows behind the pavilion.
- Premium 4 and 6 lane shells with illuminated edge rails and chevron markers.
- Lane-side and portal planting.
- Authored bat, lane, canopy and pitch material treatment from the material pass.
- Compact mobile HUD overlay so the stadium occupies more of the screen.

## Live mobile layout
At 390x844:
- HUD overlay: x 12, y 8, width 326, height 52.
- WebGL canvas: 390x712.
- Controls: y 712 to 844, height 132.
- Left and right bat buttons: 178x64 each.
- R10 GLB responds HTTP 200 on the production route.
- No browser page errors were observed in the live route check.

## Current architecture rule
Visual dressing may change, but collision nodes and match logic are frozen unless a later gameplay task explicitly reopens them.
