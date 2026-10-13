# Penalty Duel release

Replaces the solo penalty presentation at `?mode=penalty` and `/football-pinball/penalty`. Other football modes still use their existing engine and renderer. The existing demo access gate is preserved.

## Match and controls

- Standard: three or five attempts per side; switch roles after every penalty. Early mathematical victory and paired sudden death.
- Fixed Role: toss winner chooses striker/keeper for the whole round. Goals score for striker; saves and misses score for keeper. First to a majority of three/five wins.
- Striker: aim inside the goal, hold either boot or left/right arrow to charge, release to kick. Power controls flight speed; timing controls accuracy, with a narrower perfect window at high power. Cancellation and pause do not shoot.
- Keeper: drag on the arena or hold left/right controls/arrows to position, including during ball flight. Separate diagonal buttons commit a dive and lock its direction.
- Keeper physics: acceleration/braking, planted feet and inverse-kinematic knees, push-off, ballistic gravity, landing friction and recovery. An articulated texture mesh follows the joints; the same joints drive capsule/hand collision checks.
- CPU targets are independent of player keeper position. CPU keepers observe ball flight only after the difficulty-specific reaction delay, then make one committed dive with bounded reach and estimation error.
- Pause freezes the simulation. Tab hiding pauses; rematch creates a fresh engine and clears all attempts.
- No extra points, wagering, manipulative outcomes, or difficulty changes within a match.

## Rendering and assets

The penalty route uses a dedicated lightweight Canvas 2D renderer with perspective WebP artwork and animated boots and ball, plus an articulated goalkeeper mesh. It does not load the shared Rapier/Three match engine for penalty gameplay. Saves and goal placement use normalized goal coordinates and a fixed 120 Hz update. This is an arcade trajectory simulation, not full rigid-body football physics: frame hits end the attempt rather than initiating a rebound rally.

`public/football-pinball/penalty/` contains the WebP arena, settings hero, goalkeeper, two boots, and ball. The approved two-screen concept is retained here as WebP. All UI labels and controls are real HTML, not baked into the playing surface.

## Verification

- `node --test tests/penalty-duel.test.mjs`: toss, alternating roles, single counting, 3/5 formats, early win, paired sudden death, pause, and full engine match completion.
- `scripts/qa-penalty-duel.mjs`: Chromium touch aim, actual boot contact and angle change, keeper positioning/dive, pause and viewport checks at 360×640, 390×844, 430×932, 1440×1000, 844×390. Uses explicitly marked state fixtures to reach the tested interaction.
- `scripts/qa-penalty-full-match.mjs`: one real-time production-default full five-shot match, no state mutations or clock acceleration; keyboard kicks, touch aim, keeper buttons, result, rematch reset, settings persistence.
- `scripts/qa-penalty-motion.mjs`: normal-speed Fixed Role round, direct arena drag, dive motion captures and role persistence, without state mutation.
- Browser scripts use `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` if Playwright/browser binaries are outside normal locations.

Browser checks establish Chromium behaviour. Physical iPhone Safari touch/audio feel still needs a device playtest.
