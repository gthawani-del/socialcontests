# socialcontests

Browser game experiments and social contest experiences.

## Infinite Pinball prototype

Current production viewer: **V4**

- `public/models/infinite-pinball-base-v4.glb` — compressed Jutsu table
- `public/models/infinite-pinball-base-v4.json` — model/theme-slot metadata
- `src/main.js` — Three.js responsive production viewer

V4 is the final visual geometry pass before gameplay physics. It keeps the V3.2 responsive browser framing and refines the physical table: smaller premium flippers, a thinner perimeter ramp, a clearer jackpot zone, compact target banks, smaller posts, cleaner lane guides, playfield inserts, and polished bumper trims.

### Run locally

```bash
npm install
npm run dev
```

### Production build

```bash
npm run build
```
