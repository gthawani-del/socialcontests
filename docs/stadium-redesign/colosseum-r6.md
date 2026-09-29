# Cricket Pinball stadium revision 6

## Current runtime
- Production route loads `public/models/cricket-stadium-colosseum-r6.glb`.
- R6 GLB size: 3,190,396 bytes.
- Source scene: Higgsfield 3D Jutsu project `4118757a-3b8d-4152-8cd2-1f5df64d4aec`, revision 6.
- The old peaked pavilion roof is removed. R6 contains the authored sculpted pavilion canopy, so no runtime-generated canopy fallback is used.
- Runtime camera, lighting, field, pitch and crowd material tuning remain code-driven.
- Gameplay collision, scoring zones, match rules and pitch measurements are unchanged from the verified stadium implementation.

## R6 visual changes
- Sculpted cream/champagne pavilion canopy replaces the pyramid roof.
- Production camera is tighter and lower for a fuller mobile stadium composition.
- Floodlight presence and night contrast are increased.
- Grass, pitch and crowd palette are tuned toward the approved final-look reference.
- Branded bat materials remain authored in the GLB.

## Verification
- Vercel deployment for the R6 runtime switch completed successfully.
- Live 390x844 Playwright check loaded `cricket-stadium-colosseum-r6.glb` with HTTP 200 and no page errors.
- The live toss flow completed through batting selection and reached an enabled delivery control.
- Repository gameplay suite: 67/67 tests passed.
- A separate sandbox production build attempt was blocked by the sandbox's Node 20.9.0 runtime; current Vite requires Node 20.19+ or 22.12+. This is an environment mismatch, not a production deployment failure.
