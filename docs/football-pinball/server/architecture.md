# Authoritative service contract

The existing Vite application stays one application in `socialcontests`. A persistent Node process in the same repository is required for online physics; Vercel static hosting alone does not run long-lived matches. No production host is selected or deployed by this change.

Transport: ordered browser input requests over HTTP; server snapshots over a persistent SSE connection (no database polling). All physics executes in the shared pinned Rapier 3D match engine at 120Hz. Server snapshots at 20Hz, browser interpolates. Room membership is a random per-player bearer token, unrelated to the existing client-side demo gate. Before public access, add the operator's real identity/account integration and abuse controls. Demo room membership must not be advertised as secure account authentication.

Server routes planned:
- POST /api/sessions: create PvP room or authoritative single-player run.
- POST /api/sessions/:id/join: occupy the remaining PvP slot once.
- GET /api/sessions/:id/events?token=…: SSE snapshots, no arbitrary spectator data.
- POST /api/sessions/:id/commands with bearer token and monotonic sequence: allow only that player's controls, choose, start, bank and allowed pause/resume. Server assigns tick.
- GET /api/sessions/:id/result: signed terminal result + replay digest.
- GET /api/sessions/:id/replay: participant-only input/event record after terminal state.
- GET /api/public-key: verification key ID and public key.

Server rejects claimed scores, physics positions, client tick overrides, remote player's controls, duplicate/out-of-order sequence, duplicate banking, overlarge bodies and excessive rates. Disconnect releases held inputs; grace window allows reconnect; expiry forfeits remote PvP or terminates a single-player run. Sessions have bounded lifetime and memory. Persistent results/leaderboards are a separate storage dependency, never faked by a local scoreboard.

Crash: physical drain is processed before bank at the same tick. Only server-produced collision events score. Active-time multiplier and combo use versioned integer rules. Terminal payload includes rules/collider hash, input/replay hash, ending tick and score; sign using Ed25519. Public verification must verify signature then canonical replay in the pinned runtime. This can support auditable gameplay; it is not an independent certification or cryptographic proof of general physics fairness.

Local browser-only play is explicitly practice/unverified. Production keys must be provisioned externally and remain server-only. No private keys are committed or shipped to clients. Production hosting, TLS/CORS origin, real authentication, persistence and real-device QA remain release gates.
