# Online browser verification

Run:

```
PLAYWRIGHT_MODULE=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs CHROMIUM_PATH=/tmp/cricket-browser/chromium node scripts/qa-football-online.mjs
```

This starts Vite5195 and the local authoritative service8795, then uses two independent mobile Chromium contexts with genuine HTTP commands and SSE snapshots. No production deployment occurs.

Verified: host/join, toss-winner-only side choice, player-relative camera/input, both players' real touch moving owned authoritative flippers, opponent seeing those movements, release, goal scores at both ends, interrupted SSE transport releasing held input, automatic EventSource reconnect, recovered commands, asset loading and no horizontal overflow/runtime errors.

Goal propagation uses explicitly placed authoritative ball fixtures near each goal plane, followed by real physics crossing; score is never directly assigned. These fixture rounds are not canonical replay evidence. Clean, unmodified Crash rounds and signatures/replay are separately tested in tests/football-server.test.mjs.

The disconnect test forcibly closes the actual server SSE socket through an in-process administrative method, then checks browser error, server input release and browser reconnection. Browser offline emulation alone did not close its existing SSE connection and was not accepted as evidence.

Screenshots show real independently running browser views. They do not establish physical iPhone/Safari compatibility or cross-network latency quality.
