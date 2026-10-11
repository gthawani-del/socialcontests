# Football Crash introduction

Route: `/football-pinball/?mode=crash` (also `/football-pinball/crash`).

Implements the approved stadium design with faded boot flippers at the curve origin.
The headline, curve, rule explanations, sound control and Continue action are live
HTML/SVG. The background is a 1200 × 1032 WebP (127,796 bytes). Round type and its
practice disclosure are available in settings before entering the game.

- Approved reference: `crash-intro-approved.webp` in this folder.
- Runtime artwork: `public/football-pinball/art/crash-intro-stadium.webp`.
- Display font: locally served Barlow Condensed ExtraBold, Latin subset, with OFL license.
- Browser evidence: `../evidence-crash-intro/` (390px and 1000px screenshots).

Verification: production build; nine Crash motion/round tests; intro browser QA at
320, 390, 430, 1000 and landscape 844px; existing hosted/local Crash browser QA.
Checks include persisted mute state, moving the same audio button into/out of
settings, Continue, starting a round, cashing out and Play again. Hosted QA checks
server cashout, stake validation and crash boundaries after accessing the selector
through settings.

Browser checks use Chromium/SwiftShader, touch emulation, the existing demo-access
fixture and development-only deterministic round inputs. These are not physical
iPhone or phone-speaker tests. Round mechanics, scoring and physics are unchanged.

Baseline: `bf8879bdb0ca646f66191aba4269f3d6beb8a4b0`.
Rollback: revert the single introduction-design commit.
