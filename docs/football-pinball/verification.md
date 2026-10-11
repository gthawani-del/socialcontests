> Historical Milestones1–2 record. The user subsequently authorized all four modes. Current status: [requirements](requirements.md), [four-mode report](four-mode-report.md) and [server setup](../../..//server/football-pinball/README.md).

# Milestone 2 verification

## Delivered
Four independently controlled flippers (blue pair/red pair), Rapier ball/rail/flipper collisions, two goal mouths, whole-ball goal detection, one point per goal, alternating serve, pause/resume/reset and mobile controls. Route `/football-pinball/` reuses the existing demo gate. Main homepage Football card sits directly beside Cricket and reuses existing football artwork. No new generated production assets.

## Executed checks
- `npm run build`: PASS. Existing Cricket GLB/build preparation passed. Its timestamp-only tracked output changes were restored before commit.
- `node --test tests/football-foundation.test.mjs`: 13/13 PASS. Includes actual contact and outgoing velocity for all four boots; high-speed CCD/rail rebound; end rail and post rejection; whole-ball plane/one-score reset at both ends; fixed-step partition equivalence; pause; same-runtime reproducibility; bounded diagnostics.
- `npm test`: 148/148 PASS including existing Cricket tests and the 13 above.
- `scripts/qa-football-foundation.mjs`: PASS using Playwright + Chromium 153. Consent/login via existing gate; simulation stays idle behind gate; native CDP two-finger touch changes actual flipper angles; cancellation releases; pointer-operated contact fixtures for each boot; both goal fixtures update HUD once; pause/resume/blur; layout at 360x740, 390x844, 430x932, 1440x1000, 844x390; built homepage navigation; built Football launch; Cricket lobby smoke check; QA fixture hook absent in production. No page errors or failed requests.
- Screenshots inspected at mobile and during normal-serve gameplay. Landscape page intentionally scrolls to preserve usable board/control size.
- Frame sample: 180 frames under Chromium software rendering; median 16.6ms, p95 19.1ms. Renderer reported 46 geometries, 0 textures, 46 draw calls. This is a short headless sample, not sustained physical-phone FPS/thermal or comprehensive memory-leak verification.

## Evidence
`evidence/qa-results.json`, five viewport screenshots, `production-mobile.png`, `graybox-gameplay.mp4`. Video consists of 70 actual browser screenshots during a normal serve and timed keyboard input, assembled at 10fps; it is playback evidence, not a real-time benchmark. Collision/goal browser tests explicitly use deterministic fixtures. Tests do not prove subjective game feel.

## Reproduce
Install dependencies with `npm ci`, then `npm run build` and `npm test`. Provide an installed Playwright module and Chromium executable:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs CHROMIUM_PATH=/absolute/path/to/chromium node scripts/qa-football-foundation.mjs
ffmpeg -y -framerate 10 -i docs/football-pinball/evidence/frames/%03d.png -c:v libx264 -pix_fmt yuv420p -movflags +faststart docs/football-pinball/evidence/graybox-gameplay.mp4
```

No additional browser dependency was added to the application. The script starts and closes its own Vite development/preview servers.

## Remaining limits / blockers
WebKit downloaded through its fallback mirror, but cannot start without GTK/GStreamer/other host libraries. Playwright install-deps failed with `setgroups`/permission errors. Safari/WebKit and real iPhone/Android verification are BLOCKED, not passed. No production deployment occurred.

Rapier compatibility JS/WASM produces a Football-only bundle of 1.70MB (632.67KB gzip), plus shared Three.js. Vite reports a chunk-size warning. It is not loaded by the homepage or Cricket entry. Future asset/mobile optimization remains necessary. Rapier emits an upstream initialization deprecation warning despite its public zero-argument init API; no runtime failure observed.

Graybox uses planar Rapier simulation rendered with Three.js, not a vertical 3D ramp engine. No keepers, CPU, toss, production boot GLBs, four-mode lobby, Crash/server fairness, Penalty, Rush, online matches, rewards or leaderboards are implemented. Existing client-only demo access is not secure authentication. These are later milestones.

STOP: M2 implementation and available automated QA are complete. Review graybox and address Safari/real-device verification before approving the next milestone. No merge, production deploy or production asset generation is authorized.
