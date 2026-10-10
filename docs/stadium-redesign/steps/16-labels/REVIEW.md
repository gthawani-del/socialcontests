# Scoring labels

Replaced the five thin target-number meshes with bold, high-contrast texture faces using deterministic canvas text. Labels stay attached to the existing target transforms and respect depth; scoring geometry and values are unchanged. Uses four small shared 256-square textures. This change follows deployed release 05b95da.

Production build passes. Playwright verifies the local production build through toss, CPU delivery, first counted ball and human pull-to-bowl, with no page errors, plus mobile/desktop/landscape captures. All release artwork loads HTTP 200. The 96-test suite passed for the deployed integration; not repeated for this label-only change.

This next pass is local and is not deployed. It can be included in the next grouped visual release.
