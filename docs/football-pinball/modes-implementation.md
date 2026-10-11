# Football modes implementation

## Shared canonical engine
`core/match-engine.js` uses pinned Rapier 3D 0.19.3 at 120 Hz. Coordinates: board (x,y) maps to world (x,height,-y). Ball radius .13, maximum total speed16. Physics and geometry are returned by `canonicalRules()` for server hashing. Version is football-3d-1. Rules are proposed starter-pack baseline values, pending gameplay tuning. Legacy 2D foundation remains unchanged.

Boot GLB heel pivot stays at root. Versioned rounded cuboid core half-extents (.705,.06,.10), border radius .07, local center(.675,.20,0) gives outer bounds X[-.10,1.45], height [.07,.33], half-width .17. Valid rising physical boot contact applies bounded vertical loft3.4 units/s; enabled skill consumes +25% planar boost. Total speed remains capped16. Goal requires entire ball cross plane at Y±5 and fit within1.2 goal height.

## API and coordinates
`createMatch({mode,seed,difficulty,format,opponent})`; methods `start(call)`, `command`, `setInput`, `releaseInputs`, `setPaused`, `advance(seconds)`, `step`, `snapshot`, `exportReplay`, `canonicalRules`, `forfeit(team)` and `dispose`. `forfeit` is authoritative service API, never accepted as client command. Format quick/classic/golden. Opponent cpu/human.

Commands: start(call heads/tails), flip(id,pressed), pause, resume, choose(choice kickoff), choose(choice side,value near/far). Toss winner chooses; CPU red chooses kickoff automatically. 120-tick toss,180-tick countdown. Snapshot provides toss face/call/winner, bottomTeam and defendingEnd mapping.

Boot IDs are fixed physical fixture IDs: blue-left/right are world near fixtures; red-left/right are world far fixtures. Their `team` changes with side selection/halftime. Local controls must select current team boot, and reverse world-left/right for a far-side camera.

## PvP checkpoint
Implemented CPU through ordinary boot inputs, bounded physical keepers, player bumpers, SKILL/PASS/COMBO collisions, goal score separate from arcade points, quick first3, golden first goal, classic2×120 active seconds, halftime end switching, automatic relaunch, pause and forfeit. No currency/reward conversion: ZIP gives no reward exchange formula.

Tests: `node --test tests/football-modes.test.mjs` 10 passed: four distinct physical flipper contact/loft tests, exact goal crossing/height, keeper collision save, classic sides/results, pause, invalid client score command and repeatable seeded CPU simulation. Browser QA is a separate integration gate; no device compatibility claim from these unit tests.

## Remaining integration gates
All four mode engines are implemented. Online authority/signatures service integration and real-device performance remain separate gates. No cryptographic provable fairness claim.

## Crash checkpoint
Crash uses two boots, one ball, seven physical targets and physical lower drain. BANK queues for next physics tick; collision and drain resolution precede bank. Bank ends the run, drain awards zero banked points. No hidden threshold or multiplier-dependent physics. Combo expires after600 active ticks and caps1.5. A target only scores on collision start, with minimum30-tick rearm debounce per ball/target.

Integer score: scale10000; M=min(100000,10000+floor((ticks²+3600ticks)/960)); C=10000+1000min(5,charge); bank=floor(BASE×M×C/100000000), using BigInt intermediate arithmetic. No clock input exists. Pause freezes ticks and clears held boots. No currency.

Replay export includes ordered tick/sequence commands, full canonical event ledger and terminal outcome. `verifyReplay` reconstructs pinned runtime and compares all three; malformed ordering, oversized logs and nonadvancing replay rejected. Maximum216000 ticks and100000 commands. This proves reproduction relative to supplied data, **not origin authenticity**: trusted server signatures remain mandatory for ranked outcomes. No cryptographic fairness claim.

Tests now15/15: fixed-point examples/caps, pause farming rejection, duplicate banking, same-tick physical drain priority, actual target contact, canonical reproduction and ledger/input/order tamper rejection, plus prior PvP tests. Browser integration QA remains separate.

## Penalty checkpoint
Five attempts, physical bounded goalkeeper, full-ball goal classification including actual vertical top-corner crossing, perfect-strike/precision/streak bonuses,8-second active-time timeout, physical save, miss recovery and final summary. Top corner requires |x|≥.6 and center height≥.78 at goal plane; precision requires |x|≥.6. No random goal/save assignment. Difficulty changes reaction ticks38/22/10, speed1.7/2.2/3, width.60/.72/.82 and bounded prediction error. Goalkeeper height remains.70.

Visible arena rail height is.45. Ball leaving outer bounds(|x|>3.4,|y|>6.2 or falling below floor) emits BALL_OUT_OF_PLAY: Penalty miss; PvP documented two-second refeed; Crash ends drained with zero points. This recovery is visible in ledger and is baseline operational tuning, not score manipulation. Player bumper collider height1.01 matches radius-scaled authored mesh.

18/18 tests passed including five physical top-corner goals/4800 points, keeper contact save, timeout, Elite reach/speed bounds and out-of-play recovery. Fixture acceleration sets active clock near halftime/timeout to test transitions; it does not establish real-device performance or visual quality.


## Arcade Rush and final engine verification
90-second active clock continues during one-second drain relaunch. Two +10-second bonuses maximum; absolute cap120 seconds. Moving advanced target, three-ball multiball for10 seconds, unique IDs, one active multiball event, collision-start dedupe30 ticks, timed x2–x5 combo and retained points on drain. Final15 seconds explicitly doubles arcade points; physics never changes with phase. Super target arms next strike, super-shot goal adds300 before combo/phase multiplication. Perfect strike adds150. BANK is rejected.

Ramp collision matches the authored GLB:16-segment quadratic top, width.7,length2, entry.02,rise.43, profile top=.02+.43t², localZ+1 entry to−1 exit. Renderer uses plain translation at(x2,height0,boardY2); no rotation. Physical lips are segmented at x±.34. Real collision test verifies ascent above.3 height.

Crash/Rush upper goals return by physical goal-backwall collision, without teleport. Side switching updates player/keeper rendered ownership and collider metadata. Canonical option objects and rule dictionaries are frozen; unknown keys, invalid seeds and object-valued fields rejected. Reset reconstructs a fresh physics world including moving targets and contact state.

`exportReplay` also carries finalState and systemEvents. Trusted forfeit is recorded separately from client commands with one unified sequence; client forfeit commands remain rejected. Replay compares final 3D state, commands, system events, complete ledger and result. A valid unsigned replay is reproducible data, not proof of authenticity.

Final engine test checkpoint: **31/31 passed** (`node --test tests/football-modes.test.mjs`). Covers all four modes, ramp lift, exact corner height, canonical replay for each, tampering, forfeit, reset, target ownership and goal backwall. Browser integration/device QA is reported separately by main integration work.

Penalty now has a dedicated shorter/narrower lane: half-width2.3, near drain−3.5, far goal5, center.75, play length8.5. Boots at x±1.65/y−2.4; feed at x−.7/y−1.5. Goal/drain detection uses configured near plane. Render field and camera use exported geometry. Final checkpoint **32/32 engine tests passed**, including shortened-lane physical boot contact and drain.
