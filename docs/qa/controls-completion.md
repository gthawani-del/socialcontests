# Controls completion

- Compact mirrored batting buttons with swing arcs, immediate press feedback, and a stable bottom row.
- Existing actual-contact Early / Perfect / Late feedback remains connected to physics.
- Human bowling shows a compact delivery/line/length/power summary during play.
- Planning restores the selected line, length, delivery and power; the physical lever relaxes separately from stored power.

Validation: 135 unit tests; production build; four batting layouts (390x844, 320x568, 844x390, 1365x900), guide dismissal without button movement; simultaneous touch with independent release and cancellation; physics contacts, six-ball first innings and separate two-wicket finish; lever alignment, cancellation and one-release/one-delivery; next-plan selection restoration; production-default access, toss, CPU bowling and human bowling route. Deterministic innings tests use seeded selection and accelerated waits. Layout captures use battery-saver rendering. Production route uses default settings.

Physical iPhone recording review remains pending. Browser emulation is not device sign-off.
