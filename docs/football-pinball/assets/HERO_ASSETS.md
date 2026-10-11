# Football Pinball hero asset provenance and integration

These assets are individually authored using hosted Higgsfield 3D Jutsu's actual Blender 5.2 runtime. They are not generated images, downloaded catalog models, or a flattened board. Python sources in `scripts/football-assets/` reproduce the geometry. Each project exports its own GLB and editable Blender scene. Original procedural geometry; no third-party meshes, textures, marks or logos are used. No paid image/video generation was submitted.

## Portable contract

All files are in metres. Blender source Z-up converts once at glTF export to Y-up. GLB file includes a root named `ASSET_<filename>` and separate preview camera/lights; runtime should instantiate only the ASSET root. All geometry uses portable Principled base color/roughness/metallic values. All mesh primitives carry UVs; no external textures or texture memory. `Team_Primary` is the runtime team tint. Semantic parts are described in the source recipes and consolidated by material for low draw calls. This does not imply independently rigged limbs.

| Asset | Project | Revision | Pivot / forward | Collision guidance |
|---|---|---|---|---|
| boot | da328c33-2e7b-4f8e-a09e-1331e3f234ed | 2 | Heel hinge at origin; toe +X | Existing capsule length1.55 radius.16; sole width includes trim. Lower studs are visible detail. |
| football | 295f07fd-be04-40a9-a7b8-54d769e940e6 | 2 | Ball center origin | Sphere radius.13. 32 constructed pentagon/hexagon panels, thin seams; faceted mobile silhouette. |
| goal | 78cadde8-f5e1-47f2-8aee-fe1e5d85ba3c | 1 | Front/base center origin; depth +Z | Clear opening2.2 wide1.2 high; analytic goal trigger and post colliders remain in engine. |
| player-bumper | 894e51a0-472f-4923-bc5c-a3bddb8cb211 | 3 | Base center origin; faces +Z | Base radius.257, adult miniature height1.047. Engine radius.32 requires intentional runtime sizing/collider mapping; no automatic geometry claim. |
| keeper | 552e06f9-be3a-4c87-9698-3459ff0661f4 | 3 | Feet base center origin; faces +Z | Runtime whole-body lateral movement, no baked skeletal animation; actual bounds Y.01..1.047, width1.13. |

## Verification

Hosted preview renders were inspected. The initial ball had core/panel intersections; revision2 lowers the core beneath the panels and removes irregular black artifacts. Framing was corrected for miniature previews. GLB validator checks embedded finite positions/normals/UVs, exact hierarchy-transformed geometry bounds, triangles, mesh counts, bytes and SHA256. Results are in `hero-validation.json`. Parent integration QA owns actual WebGL exported-view inspection, pivot/physics alignment, runtime replacement and mobile performance. A successful Blender export is not proof of those runtime checks.

Collision proxies are documented analytic sphere/capsule/cylinder/box shapes in the engine. They are intentionally not exported as visible duplicate meshes. Geometry is static: game movement comes from runtime transforms. No skeletal or net-deformation animation is claimed. These are optimized sports miniatures; they do not claim photoreal humans or exact reconstruction of the conceptual reference render.

## Reproduction

For boot run `boot.py`, then `boot-optimize.py` in its inspected project. For other assets prepend `ASSET='<filename>'`, then concatenate `common.py` and the matching asset script. For the keeper run `keeper-refine.py` after its base script; for the player run `player-refine.py` after its base script. Follow the guarded hosted workflow: get project, query settled state, run against exact revision/scene sequence, wait for terminal success, inspect render, retrieve GLB/blend and show the exact final revision once. Never rerun a base recipe into an already populated scene without explicitly clearing that authorized asset project or using an empty new project.
