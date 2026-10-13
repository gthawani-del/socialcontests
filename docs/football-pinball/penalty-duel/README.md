# Penalty Duel release

Replaces the solo penalty presentation at `?mode=penalty` and `/football-pinball/penalty`. Other football modes still use their existing engine and renderer. The existing demo access gate is preserved.

## Match and controls

- Three or five attempts per side. Toss winner chooses who shoots first. Roles alternate after every attempt.
- Early mathematical victory; tied matches continue in paired sudden death.
- Striker: aim inside the goal, then tap either boot or use the left/right arrow keys. The rolling ball must enter the boot contact region before a kick can launch. Contact timing changes accuracy and shot duration.
- Keeper: position before the kick using the slider, then commit a swipe or directional button. Arrow keys also dive. A single dive locks the chosen direction for that attempt.
- CPU targets are independent of player keeper position. CPU keepers observe ball flight only after the difficulty-specific reaction delay, then make one committed dive with bounded reach and estimation error.
- Pause freezes the simulation. Tab hiding pauses; rematch creates a fresh engine and clears all attempts.
- No extra points, wagering, manipulative outcomes, or difficulty changes within a match.

## Rendering and assets

The penalty route uses a dedicated lightweight Canvas 2D renderer with perspective WebP artwork and independently animated boot, keeper, and ball sprites. It does not load the shared Rapier/Three match engine for penalty gameplay. Saves and goal placement use normalized goal coordinates and a fixed 120 Hz update. This is an arcade trajectory simulation, not full rigid-body football physics: frame hits end the attempt rather than initiating a rebound rally.

`public/football-pinball/penalty/` contains the WebP arena, settings hero, goalkeeper, two boots, and ball. The approved two-screen concept is retained here as WebP. All UI labels and controls are real HTML, not baked into the playing surface.

## Verification

- `node --test tests/penalty-duel.test.mjs`: toss, alternating roles, single counting, 3/5 formats, early win, paired sudden death, pause, and full engine match completion.
- `scripts/qa-penalty-duel.mjs`: Chromium touch aim, actual boot contact and angle change, keeper positioning/dive, pause and viewport checks at 360×640, 390×844, 430×932, 1440×1000, 844×390. Uses explicitly marked state fixtures to reach the tested interaction.
- `scripts/qa-penalty-full-match.mjs`: one real-time production-default full five-shot match, no state mutations or clock acceleration; keyboard kicks, touch aim, keeper buttons, result, rematch reset, settings persistence.
- Browser scripts use `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` if Playwright/browser binaries are outside normal locations.

Browser checks establish Chromium behaviour. Physical iPhone Safari touch/audio feel still needs a device playtest.
