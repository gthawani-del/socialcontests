# Approved controls review implementation

Shared radial menu and pre-game setup now cover all four modes. Left/right boot names remain visible while PvP shot-strength feedback appears above them. Crash Bank is exposed between the boots and includes its current value. Secondary HUD stats live in Help; Arcade multiball retains an active badge. Short pre-game instructions explain immediate flipping and automatic player actions. No new charging or manual passing mechanic was added.

Validation: 67 football tests pass; Vite production build passes with the existing large-chunk warning. qa-football-roles verifies real touch boot motion/contact/release/cancel and audio activation/mute/resume. qa-football-controls verifies simultaneous two-touch motion and cancel, setup/menu/help flow, visible controls at 360/390/430 widths, and a real bank command ending a Crash round. Fixtures and software-GPU limitations are recorded in JSON. Screenshot inspection covered the gameplay layouts. Physical phone audio, frame rate and human balance are still unverified.

Homepage, Cricket files and access gate are unchanged. No Supabase dependency was added.
