# Crash — multiplier and cash-out (11 October 2026)

This replaces the original skill/drain Crash specification at the user's instruction. The core loop follows the requested conventional Crash mechanic; it does not claim Spribe's proprietary mathematics or identical commercial features.

## Rules

- Each solo practice round receives a free virtual stake from 1 to 1000 points. No wallet, purchase, deposits, withdrawals or persistent balance.
- Three-second countdown; multiplier begins at 1.00× and rises automatically.
- Cash Out secures floor(stake × exit multiplier) virtual points. A crash before acceptance loses that round's stake.
- Ball, targets and boot flippers are decorative. No target multiplier labels, physical-drain loss, skill scoring or flipper controls.
- Opening controls or hiding the tab does not freeze time. No restart during an unresolved round.
- Reference composition: shared PvP stadium, boots and materials; dedicated gold-lit target/wing/goal layout; multiplier ladder and Cash Out on the right.

## Versioned authority

`virtual-crash-v1`: 32-byte random seed; commitment SHA256(version + ':' + seed). Draw from first52 bits of SHA256(version + ':threshold:' + seed). Threshold = min(100, floor(100 × 2^52 / (2^52 - draw))/100). Growth = floor(exp(elapsedMilliseconds/10000) ×100)/100. No additional house-edge adjustment; rounding and100× cap apply.

Server uses monotonic elapsed time. Exact crash boundary rejects cash-out; a terminal round cannot pay twice. Seed and threshold are revealed only after completion. Authenticated round capability, bounded capacity, rate limits and expiring results are implemented. This is inspectable commitment/reveal, not independent fairness certification.

When no public service URL is configured, the UI explicitly labels browser-only local practice. Its client-side randomness is inspectable and is not secure server authority. No silent fallback after a failed server request.

## Release limitations

Current rounds are solo, not a synchronized public multiplayer lobby. The persistent Node service needs public HTTPS hosting and VITE_FOOTBALL_SERVER_URL; no Supabase is required. In-memory results are not persistent leaderboards or account balances. Physical-phone testing remains necessary.

## QA

Test countdown, cashout before/at/after crash, duplicate cashout, hidden-tab time, restart restrictions, malformed inputs, token checks, commitment/reveal, sound lifecycle, asset loading and the right-hand panel at mobile widths. Legacy skill-based engine/replay APIs remain for backward compatibility and are not used by the current Crash screen.
