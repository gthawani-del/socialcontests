# PvP settings implementation

Implements the approved [PvP mockup](../art/pvp-settings-approved.webp) on `/football-pinball/?mode=pvp`.

- Stadium backdrop, condensed sports typography, lime selections and full-width Continue.
- Native radio groups for difficulty and toss call; native selects for opponent, format, competition and teams.
- Team cards update from the existing kit resolver, including alternate colours for clashes. Preview shirts are original generic artwork, not official replica kits. Boot identity stays blue/red.
- Existing online availability restrictions, match options, toss, audio state, navigation and gameplay remain connected to the same handlers.
- New styling is scoped to the PvP setup. This change includes the PvP gameplay fixes already on main at `86d1ec0` without modifying their physics.

## Artwork

Runtime assets, all WebP:

| File under `public/football-pinball/art/` | Dimensions | Bytes |
| --- | --- | --- |
| `pvp-settings-stadium.webp` | 1000 × 1500 | 200368 |
| `pvp-kit-india.webp` | 600 × 623 | 77038 |
| `pvp-kit-neutral.webp` | 600 × 623 | 62528 |

Built-in image generation used the approved mockup as its visual reference. Transparency was preserved for both jersey cutouts; exports were resized and encoded as WebP. The existing locally hosted Barlow Condensed font is reused.

Final asset prompts:

1. **Stadium:** Reconstruct only the floodlit night football stadium backdrop from the reference, removing all UI, text, jerseys, flags, panels, buttons and icons. Portrait 1024 × 1536. Symmetrical large football stadium, bright small floodlights near upper left/right corners, very dark navy-black sky and stands, green detailed turf in the lower third, thin central white pitch line at bottom center, crowd softly blurred. Match the reference's premium realistic sports videogame art, deep cyan-black mood and subtle atmospheric haze. Keep the center relatively dark for separate live UI. No foreground people, football, lettering, logo or watermark. Full-bleed background only.
2. **India preview:** Extract and reconstruct only the blue jersey with orange collar and sleeve trim from the left team card. One realistic front-facing blue football shirt on an invisible torso, symmetrical spread short sleeves, subtle tonal diagonal fabric pattern, orange narrow V-neck trim and orange sleeve ends. Full shirt to hem, large and centered with breathing room. Straight front view, photoreal game merchandising render, dimensional folds and fabric texture. Transparent background with clean alpha edges. No person, mannequin, logo, badge, words, external shadows or UI. Preserve the reference blue/orange appearance.
3. **Neutral preview:** Extract and reconstruct only the white jersey from the right team card. One realistic front-facing white football shirt on an invisible torso, navy V-neck collar and thin navy/red sleeve trim. Symmetrical spread short sleeves, full shirt to hem, large and centered with breathing room. Straight front view, natural dimensional folds and knitted fabric detail. Bright white material, dark navy neckline, transparent background with clean alpha edges. No person, mannequin, logo, badge, words, external shadows or UI. Preserve the generic unbranded England-like style. Recolourable in CSS for other teams.

## Validation

- `npm run build` passed. Existing large bundle advisory remains.
- `node --test tests/football-team-kits.test.mjs tests/football-pvp-gameplay.test.mjs tests/football-modes.test.mjs`: **64 passed**.
- `scripts/qa-football-pvp-settings.mjs`: real touch-emulated and keyboard input, six viewport widths (320, 360, 390, 430, 768, 1000), no horizontal overflow, 44px minimum targets, image loading, default values, countries/clubs, resolved kit previews, persistent mute, selected match options and toss, team HUD, advancing rendered match and help dialog. See `browser.json`.
- `scripts/qa-football-pvp-gameplay.mjs`: real touch press/release/cancel changes physical boot angles, creates strong ball contact, slow-ball recovery and goal-line restart; unfrozen rally passed. See `gameplay-regression.json`.
- `scripts/qa-football-setup.mjs` with `FOOTBALL_SETUP_MODES=penalty,arcade-rush`: shared menu regression passed. See `other-modes.json`.
- Visually inspected mobile, wider layout, club previews and live match screenshots. `setup-430.webp` uses a 430 × 1040 viewport to show the full design; shorter screens scroll vertically.

Browser checks use Chromium with touch emulation/software GPU and the existing session access fixture. Physics contact checks use seeded/manual ball placement before a normal advancing rally. These are not physical iPhone or speaker-quality tests. No online server was configured for this local CPU-match verification.
