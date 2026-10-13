# Cricket settings cards

Replaced the two segmented button rows with native select controls inside two compact cards. The cards retain all existing match formats and difficulties, show the selected values and useful helper text, and keep keyboard and screen-reader labels. Simplified the header and match summary, reused the existing stadium WebP and font, and kept help and practice links.

Validation: production build passed. Updated `scripts/qa-cricket-lobby.mjs` passed in headless Chromium with simulated touch at 390×844, 390×664 (reduced browser viewport), 320×568, 1365×900, and 844×390. Verified every option, changing helper text, keyboard selection, minimum 44px targets, no horizontal overflow, Play visibility on standard mobile sizes, login, help focus return, persisted preferences, selected match settings on the play route, both practice routes, and image failure fallback. No runtime errors or gameplay model loads on the settings page. Inspected mobile, reduced-height mobile and desktop screenshots.

Gameplay physics were not changed. Browser emulation does not establish physical iPhone validation. Small and landscape viewports retain natural vertical scrolling.
