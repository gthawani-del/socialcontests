# Gameplay feedback release

## Implemented

- Bowling controls retain 44–46 px targets across mobile, desktop and landscape. The delivery type uses a readable native select and the power readout follows the pull.
- Plunger cancellation/blur no longer launches a ball. A 64 × 100 px touch area follows the actual artwork and stays inside the viewport. The mechanism pulses when ready, brightens on pull and flashes on release. Framing includes the full lever.
- Tap the score strip for both innings, actual ball results and written commentary. Opening the panel pauses physics and pending match timers; closing resumes. Scores and commentary use confirmed delivery records, with duplicate legal-delivery suppression and separate dead-ball messages.
- Original bundled synthesized impacts, spring release, wicket and applause; separate persisted effects/crowd volume, mute and test sound. Audio unlocks from player input, stops when the page is hidden, and does not block gameplay if loading fails. These are designed effects, not field recordings.
- Pooled WebGL sparks, a short ball trail, scoring/wicket rings and reduced-motion handling. Existing game rules and bat collision shapes are unchanged.

## Verification

Build and 100 tests passed. The deterministic browser batting fixture verifies touch movement/cancel, pause/resume, six real-contact deliveries, six scorecard entries, six commentary entries, innings totals, decoded audio and mute settings. Its seeded CPU delivery and accelerated/manual stepping remain test fixtures, not production timing.

The bowling fixture verifies readable targets and lever bounds at 390×700, 320×568, 844×390 and 1365×900, ready/pull/live glow states, cancelled touch does not bowl, one release counts once, and scorecard/commentary reflect that result. Screenshots inspected; the initially cropped landscape lever was corrected before release.

Physical iPhone audio playback/feel and sustained hardware GPU performance have not been certified. The previously reported one-ball innings ending remains unreproduced. The launch chute still uses the previously documented constrained launch motion.
