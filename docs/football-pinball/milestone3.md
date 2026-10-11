# Milestone 3 — UI module

## Implemented
- Four-mode lobby with real query-string navigation: `?mode=pvp`, `?mode=crash`, `?mode=penalty`, `?mode=arcade-rush`.
- Per-mode HUD, large left/right input controls, native expandable rules, results panel, mode navigation.
- Crash uses Bank Points and virtual points only; no cash language.
- Responsive layout, keyboard focus, reduced-motion support, safe-area spacing, DOM-based text and UI.
- Parent controller owns routing, access gating, physics/actions and state. Controls start disabled until controller enables them.

## Reference review
Inspected all five supplied images. Implemented compact lobby, two-column four-mode cards, dark restrained palette with separate mode accent colors; top statistics and thumb controls remain outside the board. Images are reference only and are not flattened playable boards. Production 3D assets remain a separate milestone. Penalty reference is conceptual per its supplied NOTES.md.

## Integration API
`src/football-pinball/ui/index.js` imports its CSS.
- `renderLobby(root)` renders mode links.
- `renderGameShell(root, mode, {localControls:false})` returns `{arena,status}`. Set localControls true only for local four-control play.
- `updateHud(root,state)` sets only supplied fields: score.blue/red, remainingSeconds, multiplier, basePoints, bankValue, points, combo, shots, totalShots, goals, streak, status, sessionLabel, paused, serveLabel, canServe, canBank, canPause, canReset, canFlip, finalRush.
- `renderResults(root,{title,summary,points,rows:[{label,value}]})` displays safe text and focuses the result heading. Replay is through the existing Restart control.

Stable IDs: fp-arena, fp-loading, fp-status, fp-serve, fp-pause, fp-reset, fp-bank (Crash only), fp-results. Input attributes: data-boot blue-left/blue-right; optional red-left/red-right.

## Verification
`node --check src/football-pinball/ui/index.js` passed. Parent must verify integrated routes, input and responsive screens in Playwright. No gameplay completion or asset-production claim is made by this UI milestone.
