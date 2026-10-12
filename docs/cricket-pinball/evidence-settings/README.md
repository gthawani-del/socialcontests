# Cricket settings redesign

Implements the approved `../art/cricket-settings-approved.webp` as live, responsive controls. The existing logo and local condensed display font are reused. The text-free stadium illustration is a 1200 × 800 WebP, 288,982 bytes, derived from the approved visual direction. The full-page mockup remains a design reference, not a runtime overlay.

The lobby now has gold selection buttons with visible checkmarks, a dynamic 3/6/12-ball rules summary, a primary match action and separate batting/bowling practice links. The existing defaults, saved settings, CPU mode, match URL parameters and practice routes are preserved. Short viewports scroll vertically; Play is above the fold at 390 × 844. Desktop uses two columns.

Validation on the production build with headless Chromium and simulated touch input:

- 320 × 568, 390 × 844, 844 × 390 and 1365 × 900: no horizontal overflow; control targets at least 44px high. Screenshots inspected.
- Real access-gate flow; all format and difficulty selections; live summary; keyboard selection; help open/Escape close and focus return.
- Play reaches match setup with TWO_OVER/HARD intact; preferences survive return to the lobby.
- Batting practice reaches the batting HUD and enabled bats; bowling practice reaches bowler selection.
- No gameplay GLB requested by the lobby; missing hero shows fallback copy while Play remains enabled; no page errors.
- `npm run build` and `git diff --check` pass. Build retains the existing large-chunk warning.

Run `node scripts/qa-cricket-lobby.mjs` after building, with `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` set if required. `CHROMIUM_MODULE` remains an optional bundled-browser override. Exact assertions are recorded in `checks.json`; `mobile.webp` is the implementation screenshot.

This release changes the lobby, not gameplay physics. It is based on main's score/plunger/catches fixes (`5f4a508`); those changes are preserved. No full gameplay-physics claim is made from these navigation checks.
