# Football homepage integration

Adds a real two-slide Cricket/Football hero carousel, replaces only the Football Featured Worlds cover and implements the supplied Football lobby layout with illustrated mode cards, a hero and working Help dialog. Existing Cricket artwork, gameplay and access gate are preserved. Football's older Coming Soon labels now link to its lobby.

Artwork: generated with the built-in image-generation tool from the supplied Cricket card and Football homepage reference. Three WebP assets total about 323 KB. The four-mode texture atlas uses CSS quadrant positioning. No fictional profile, level or hosted multiplayer claim is added.

Prompt briefs: (1) match Cricket's portrait cover composition, replacing bat/ball with football boot/ball and PIN FOOT; (2) four equal artwork quadrants: opposing boots, keeper, red combo target, blue circular target, no UI; (3) panoramic dark cabinet hero with red boot, football and goal, blank left area for real HTML text.

QA: Vite build passed. Playwright checked direct Football demo gate, help open/close, four mode links reaching pre-game setup, hero selection/CTA, equal adjacent card dimensions, and no horizontal overflow at 360/390/430/1280. Rendered screenshots inspected. Gameplay engine files are not changed.
