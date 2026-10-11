# Crash visual polish

Reuses PvP boot GLBs, cabinet, metal materials and stadium crowd image. Adds raised illuminated targets, colour-coded rails, directional pitch graphics, larger cosmetic football and low-strength WebGL bloom. Rendering only: no target alters multiplier or payout.

Turf texture: public/football-pinball/art/turf-detail.webp, 512 × 512, generated with built-in image generation and compressed for the game.
Prompt: Flat orthographic seamless football turf albedo texture, finely detailed emerald/olive short grass, subtle horizontal mowing bands, evenly lit; no pitch lines, objects, lettering, shadows or perspective. Pitch lines remain deterministic canvas graphics.

Low quality disables bloom. Real-phone GPU performance still requires physical-device testing.

Second model pass: reusable arcade-props.js provides turned-metal bumpers with domed caps, dual light rings and star inserts, plus bevelled wing panels with recessed faces and metal fasteners. Crash opts into these props; other modes are unchanged. A more oblique camera exposes the model depth.

Multiplier faceplate: public/football-pinball/art/multiplier-panel.webp, 256 × 768, built-in image generation. Prompt: front-on portrait black enamel/brushed gunmetal multiplier faceplate, chrome bevels and corner screws, cyan lower edge and amber upper edge illumination; centre clear and dark; no baked text, ticks, values, pointer or button. SVG live values/indicator and HTML Cash out remain functional above this image.

Round controls: points stake and Play/Play again share one row on the board. Whole-number stakes 1–1,000 are validated before each round. This row is hidden and the input disabled during countdown/live play; Cash out is the round interaction. Change setup removed.
