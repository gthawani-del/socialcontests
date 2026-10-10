# Toss, lever and recorded-audio repair

Base production release: 151adcd60d80ffebc7794c0fbbfa491461433659.

Changes:
- Vertical coin lift and end-over-end rotation around the horizontal axis, with separate heads/tails faces that match the result. Reduced-motion preference respected.
- Raised the right-side plunger mounting and cleared obstructing decorative seating; brighter spring/shaft material. Glow remains on handle and tip.
- Replaced procedural bursts with quieter recorded foley and applause; source attribution and reproducible audio conversion script included. Foley substitutes are not authentic cricket-match recordings.

Release checks: build and 100 unit tests; qa-batting-regression.mjs (seeded/accelerated six-ball innings and real touch/contact); qa-bowling-feedback.mjs (both toss faces, four viewports, plunger pull/cancel/release); qa-stadium-route.mjs (normal access/toss/CPU delivery/human bowling). JSON evidence is saved alongside this file. See live route evidence after deployment.

Unchanged: bounce/spin physics. A height-aware bounce and post-bounce spin are a separate pending implementation. The previously reported one-ball innings ending remains unreproduced; a passing controlled full over does not establish its root cause.

Physical iPhone speaker quality and Safari rendering still require device validation. Rollback: revert this release commit in one deployment.
