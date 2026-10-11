# Shared SVG setup screens

All four configurations now use inline SVG mode emblems, illustrative pitch graphics, visual instruction tiles and a single-row Sound/Continue action area. High-contrast sound states retain their SVG icon when toggled. One-shot 220/600 ms entrance/ball animations and 140 ms press feedback respect reduced motion. Existing settings, team selection, audio preference and board entry are preserved.

Playwright verified the four modes, SVG presence, sound toggling/icon retention, same-row actions and no horizontal overflow at 360/390/430, reduced-motion behaviour and board entry. Underlying WebGL drawing was stopped through the development-only QA hook during configuration screenshot checks to avoid software-GPU capture stalls; this is not a frame-rate test. Production build passes. Gameplay physics was not changed.
