# Higgsfield 3D Jutsu -> Blender -> GLB SOP
1. Approve graybox collider positions and gameplay first.
2. Generate each visible asset individually with Higgsfield 3D Jutsu: boot, player, keeper, goal, rails, bumpers, arena modules. Confirm actual service capabilities before automating; no assumption of guaranteed GLB quality.
3. Import to Blender; fix topology/normals/UVs, remove unwanted geometry, set scale and axes, pivot at boot hinge, separate movable meshes, create low-poly collision proxies, optimise material/texture sizes.
4. Export glTF 2.0 binary GLB individually; validate in viewer, check pivot animation, bounding box, texture budget, render on mobile. Record manifest hashes and source licensing.
5. Integrate one GLB at a time over functioning graybox, preserve collider logic, verify collision alignment and performance. Maintain graybox fallback.
6. Generate imagery only for seamless turf, jersey textures, decals; do not use full UI image as texture. Remove invented slogans and AI marker text.
Acceptance per asset: visual screenshot, GLB viewer check, animated pivot demonstration, physics alignment, mobile FPS/memory measurement.
