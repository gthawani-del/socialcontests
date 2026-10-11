import { createMatch } from "./match-engine.js";
import { RULE_VERSION, PHYSICS } from "../modes/rules.js";
export const canonicalJSON = (value) =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]]),
        )
      : v,
  );
export async function verifyReplay(replay) {
  if (
    !replay ||
    replay.version !== RULE_VERSION ||
    !Array.isArray(replay.commands) ||
    replay.commands.length > PHYSICS.maxCommands ||
    !Number.isSafeInteger(replay.finalTick) ||
    replay.finalTick < 0 ||
    replay.finalTick > PHYSICS.maxTicks
  )
    return { valid: false, reason: "Invalid replay envelope" };
  const systems = replay.systemEvents || [];
  if (
    !Array.isArray(systems) ||
    systems.length > 1 ||
    systems.some(
      (e) => e.type !== "forfeit" || !["blue", "red"].includes(e.team),
    )
  )
    return { valid: false, reason: "Invalid system events" };
  const entries = [
    ...replay.commands.map((e) => ({ ...e, kind: "input" })),
    ...systems.map((e) => ({ ...e, kind: "system" })),
  ].sort((a, b) => a.sequence - b.sequence);
  let previousTick = -1,
    previousSequence = 0;
  for (const entry of entries) {
    if (
      !entry ||
      !Number.isSafeInteger(entry.tick) ||
      entry.tick < previousTick ||
      entry.tick > replay.finalTick ||
      entry.sequence !== previousSequence + 1 ||
      (entry.kind === "input" &&
        (!entry.command ||
          !["start", "flip", "bank", "pause", "resume", "choose"].includes(
            entry.command.type,
          )))
    )
      return { valid: false, reason: "Invalid input ordering" };
    previousTick = entry.tick;
    previousSequence = entry.sequence;
  }
  let engine;
  try {
    engine = await createMatch(replay.options);
    let index = 0;
    while (engine.tick <= replay.finalTick) {
      while (index < entries.length && entries[index].tick === engine.tick) {
        const e = entries[index++];
        if (e.kind === "system") engine.forfeit(e.team);
        else engine.command(e.command);
      }
      if (engine.tick === replay.finalTick) break;
      const tick = engine.tick;
      engine.step();
      if (engine.tick === tick)
        return { valid: false, reason: "Replay cannot advance" };
    }
    const actual = engine.exportReplay();
    if (
      index !== entries.length ||
      canonicalJSON(actual.commands) !== canonicalJSON(replay.commands) ||
      canonicalJSON(actual.systemEvents) !== canonicalJSON(systems) ||
      canonicalJSON(actual.ledger) !== canonicalJSON(replay.ledger) ||
      canonicalJSON(actual.result) !== canonicalJSON(replay.result) ||
      canonicalJSON(actual.finalState) !== canonicalJSON(replay.finalState)
    )
      return { valid: false, reason: "Canonical simulation mismatch" };
    return {
      valid: true,
      result: actual.result,
      canonical: actual,
      notice:
        "Reproduction only; authenticity requires a trusted server signature",
    };
  } catch (error) {
    return { valid: false, reason: error.message };
  } finally {
    engine?.dispose();
  }
}
