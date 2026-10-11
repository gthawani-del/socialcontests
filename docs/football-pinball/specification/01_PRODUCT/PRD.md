# PRD
Goal: mobile-first browser 3D Football Pinball using existing socialcontests authentication, routing and shared shell. Four visually distinct arenas on one rendering, physics, input, audio and scoring foundation.
Flows: existing auth -> game selection -> mode setup -> tutorial -> gameplay -> results -> rematch/modes. Deep links require existing auth.
P0: repo inspection, approved landing UI, graybox, ball/flippers/goals, CPU PvP, playable four modes, scoring tests. P1: GLBs, sound/VFX, rewards and performance. P2: online PvP, rankings, tournaments (network architecture designed early).
Shared: left/right independent boot controls, ball collisions, pause, mute, settings, results, virtual nonredeemable coins/badges/cosmetics, performance presets. No pay-to-win.
QA: 360/390/430px mobile widths, iOS Safari and Chrome, real-device touch, Playwright, ball visible, no control overlap, graceful frame-rate fallback. No fake user statistics or unimplemented buttons.
Open: tune scoring, difficulty, combo and timers via playtest; do not assert verified implementation.
