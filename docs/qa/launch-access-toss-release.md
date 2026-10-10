# Launch page, mobile access and toss reveal repair

Base release: 2d76ed243163dd694c17a3a30749dfbf222833ab.

- Launch page: full-width stadium preview, equal-width option buttons, scoped fieldset styles that do not depend on browser fieldset/grid quirks, compact mobile hierarchy and visible Play action at 390 x 700. Preview captured from the actual table at 1000 x 600, camera (0, 2.4, 4.8), lookAt (0, 0, .05), FOV 44; WebP quality 90. Gameplay camera unchanged.
- Access: homepage and direct game entry share one responsive gate stylesheet. Constrained form width, scrollable gate, safe-area padding, 16px inputs and no forced mobile autofocus. Use demo password fills username/password without submitting or bypassing consent. Existing attempt limit retained.
- Toss: reveal waits for both rendered lift and flip animations to finish, then a short landing hold. Reset guards discard stale reveals; pause/resume handles animations; reduced-motion gets a static reveal.

Checks: production build; 109 unit tests; qa-access-mobile.mjs across both routes at 320x568, 390x700, 844x390 and 390x320; qa-bowling-feedback.mjs including holding animation beyond the old timer, both final faces, lever input and cancellation; qa-cricket-lobby.mjs for layouts, help, saved choices, match entry and preview failure fallback. Screenshots visually reviewed. Reduced viewport checks simulate available keyboard space; they are not a physical iPhone keyboard test.

No new dependencies. One grouped release; rollback by reverting this commit.
