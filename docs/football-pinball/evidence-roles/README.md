# Football roles, sound and power feedback

Implemented PvP formations with one defender, midfielder and striker per team. Strikers occupy the opposition half; lanes are staggered. Ownership and facing use the formation's home end rather than current pitch position, including halftime swaps.

Physical facing-side contact triggers a defender clearance to the midfielder, a midfielder pass to the striker, or a striker shot toward a goal corner. Each player has a 90-tick cooldown. Rear contacts remain rebounds. Numbering is 4/8/9. Pass targets now seek the striker. Keeper visual height increases from 1.15 to 1.45, collision width from .72 to .84, and depth from .38 to .44; reaction speed and travel stay limited.

Boot controls remain immediate. Gold arcs report actual planar ball speed after contact as a percentage of the speed cap, for two simulation seconds. They are feedback meters, not hold-to-charge controls. Mapping follows the controlled team's end after side swaps.

Sound defaults on unless the player previously muted it. A visible pre-match toggle and the in-game dial share the same preference. Audio unlock still requires a user gesture. Synthesized crowd ambience runs only during active visible unpaused play; mute stops voices and ambience. Added distinct player-kick sound and a WebGL contact flash. No audio files, APIs or Supabase were added.

Validation: 67 scoped tests passed; production build passed with existing bundle-size warning. Browser checks at mobile widths 390 and 430 verified actual touch contact/movement/release/cancel, power labels, sound gesture unlock, crowd start, pause stop, mute cleanup and resume. Screenshots are actual renders using a software GPU; ball-placement/manual-step fixtures are disclosed in browser.json. Physical phone speaker quality and performance remain unverified.

Nine complete seeded automated rounds completed. There were six goals and eleven out-of-table events; scoring remains low and needs human balancing. These simulations are not human playtests. Public multiplayer and global persistent rankings remain unconfigured.
