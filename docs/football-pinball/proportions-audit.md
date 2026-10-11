# PvP proportions and sound audit — 11 October 2026

Scope: reported PvP height regression, small ball, apparent oversized boots, and unpleasant audio. This is an engineering audit with reproducible evidence, not an independent financial-audit certification.

| Finding | Severity | Cause | Change / disposition |
|---|---|---|---|
| Portrait arena shortened | High | CSS capped height at viewport width × 1.5, even with space available | PvP cap increased to × 1.8; viewport height and safe areas remain limits. Camera elevation adjusted to reduce foreshortening; no nonuniform stretching. |
| Ball difficult to read | High | PvP radius 0.11 world units | Radius 0.15 in both physics and rendering; rules version incremented. |
| Boots appear oversized | Medium | Small ball and foreshortened table exaggerated proportions | Preserve 1.2 asset scale: authored length 1.55 × 1.2 = collider length 1.86. No arbitrary visual-only shrink. |
| Disturbing continuous sound | High | Two-second filtered random-noise loop presented as crowd | Removed loop and synthetic goal crowd burst. Effects master reduced from 0.35 to 0.22. Real cheering replacement blocked: no audio attachment available. |

## Evidence

`evidence-proportions/before.json` and `after.json` record browser dimensions, model bounds, radius, errors and audio state. Mobile widths 360/390/430: arena heights 540/585/645 → 648/702/774 CSS pixels. Landscape 844×390: 330 → 326 pixels, preserving HUD space. These are arena measurements, not claims that the physical cabinet fills every pixel. Perspective and surrounding stadium remain visible.

`qa-football-proportions.mjs` checks overflow, dimensions, ball radius and absence of synthetic ambience. Its screenshots use a stationary centre ball for a repeatable comparison. Chromium uses software WebGL, not a physical phone.

`qa-football-roles.mjs` verifies browser gesture audio unlock, both real touch flipper movements, actual ball collision and forward velocity, release/cancel return, contact-strength indicators and mute voice cleanup. Fixtures place the ball and step physics deterministically. All 67 football tests passed. Frontend build passed.

## Open items / release limits

- Supplied cheering recording must be reattached before replacement, loop continuity, loudness and mute/pause behavior can be verified.
- Physical-phone performance, speaker comfort and human balance remain unverified. Browser automation does not establish these.
- A larger collider changes match behavior; seeded tests pass but a human play session is still needed for balance.
- No homepage, Cricket, team selection, access gate or disclaimer changes in this patch.
