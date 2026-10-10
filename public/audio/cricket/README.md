# Cricket Pinball sound sources

The previous procedural pack was replaced with recorded foley and applause.
All sources below are CC0. No external audio requests occur during play.

- Kenney, Impact Sounds: https://kenney.nl/assets/impact-sounds
  Download: https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip
  Bat: impactPlank_medium_000; flipper: impactMetal_light_002;
  rail: impactGeneric_light_002; launch: impactMetal_light_004;
  wicket: impactWood_medium_000. These are foley substitutes, not recordings of a cricket match.
- qubodup, Well Done: https://opengameart.org/content/well-done
  crowd.wav uses the recorded applause. The author changed its licence to CC0
  on 2024-10-05; the original filename still contains CCBY3.

Adaptations: low-pass filtering, reduced gain, short fades, trimming and
conversion to 24 kHz mono 16-bit PCM. Rebuild using
`python scripts/build-cricket-audio.py SOURCE_DIRECTORY`.
