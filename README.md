# socialcontests

Browser game experiments and social contest experiences.

## Infinite Pinball prototype

Current production viewer: **V3**

- `public/models/infinite-pinball-base-v3.glb` — compressed Jutsu table
- `public/models/infinite-pinball-base-v3.json` — model/theme-slot metadata
- `src/main.js` — Three.js production viewer

V3 is the final neutral geometry pass before gameplay physics. It moves the ramp to the perimeter, introduces tapered flippers, domed bumpers, a stronger jackpot zone, clearer inlane/outlane geometry and a lower browser camera.

### Run locally

```bash
npm install
npm run dev
```

### Production build

```bash
npm run build
```
