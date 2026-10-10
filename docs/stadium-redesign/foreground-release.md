# Stadium foreground release

Integrated the reviewed art branch onto production baseline 7b663d4, preserving the 96-test gameplay branch, bowling plunger, automatic CPU bowling, feedback, result layer, telemetry and mobile UI. Uses the r28 GLB with pavilion backdrop, camera/light rig, rolled-soil pitch, printed bat faces, navy ramp surfaces and remapped seated crowd strips. Ramp half-width updated from .22 to .25 model units to match r28.

Validation: production build and all 96 automated tests pass. Playwright completed the access gate, toss, automatic CPU delivery and first counted ball; restarted into human bowling and successfully selected line/movement and pulled/released the plunger. All three art textures and r28 returned HTTP 200. Mobile, desktop and landscape captures are in docs/qa/stadium-production-route*. No browser page errors. Physical-device performance remains unverified.

Rollback: revert this release commit to restore production r13 and its visual runtime; retained r13 assets support that rollback.
