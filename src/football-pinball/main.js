import "../access/demo-gate.js";
import "./style.css";
import {
  renderLobby,
  renderGameShell,
  MODE_UI,
  updateHud,
  updateShotPower,
  renderResults,
} from "./ui/index.js";
import { addGameMenu } from "./ui/game-menu.js";
import { addSetup } from "./ui/setup.js";
import { saveRecord, renderRecords } from "./ui/records.js";
import { createAudio } from "./ui/audio.js";
import { bindInputs } from "./input.js";
const query = new URLSearchParams(location.search);
const mode =
  query.get("mode") || location.pathname.split("/").filter(Boolean)[1];
if (mode === "foundation") await import("./foundation-main.js");
else if (mode === 'crash') await (await import('./crash-main.js')).mountCrash();
else if (MODE_UI[mode]) await mount(mode);
else renderLobby();
async function mount(mode) {
  const root = document.querySelector("#footballApp");
  const { arena } = renderGameShell(root, mode);
  const serverBase = import.meta.env.VITE_FOOTBALL_SERVER_URL;
  const setup = addSetup(root, mode, !!serverBase);
  let sessionTeam = "blue";
  const connection = document.createElement("section");
  connection.className = "fp-network";
  if (serverBase && (mode === "pvp" || mode === "crash")) {
    connection.innerHTML =
      mode === "pvp"
        ? '<label>Join match code <input id=fp-join-code autocomplete=off placeholder="Leave blank to host"></label><p id=fp-network-status></p>'
        : "<label><input type=checkbox id=fp-authority> Server-validated round</label><p id=fp-network-status></p>";
    root.querySelector(".fp-hud").before(connection);
  }
  const audio = createAudio(root);
  {const menu=addGameMenu(root,setup,mode);if(connection.parentElement)menu.preflight.insertBefore(connection,menu.preflight.lastElementChild);}
  let engine,
    view,
    inputs,
    frame,
    last = performance.now(),
    ended = false,
    lastSide;
  try {
    const [{ createMatch }, { createMatchView }] = await Promise.all([
      import("./core/match-engine.js"),
      import("./view/scene.js"),
    ]);
    const matchOptions = ({ call, ...options }) => options;
    const seed = () => crypto.getRandomValues(new Uint32Array(1))[0] || 1;
    engine = await createMatch({
      mode,
      seed: seed(),
      ...matchOptions(setup.values()),
    });
    view = await createMatchView(arena, mode);
    root.querySelector("#fp-loading")?.remove();
    const quality = document.createElement("label");
    quality.className = "fp-quality";
    quality.innerHTML =
      '<span>Graphics</span><select aria-label="Graphics quality"><option value="auto">Automatic</option><option value="high">Full detail</option><option value="low">Reduced detail</option></select>';
    root.querySelector(".fp-how").append(quality);
    quality.querySelector("select").onchange = (e) =>
      view.setQuality(e.target.value);
    const command = (c) => engine.command(c);
    const control = {
      setInput(id, pressed) {
        const s = engine.snapshot(),
          team = id.startsWith("red") ? "red" : sessionTeam;
        const near = s.defendingEnd?.[team] !== "far";
        const left = id.endsWith("left");
        const boots = s.boots
          .filter((b) => b.team === team)
          .sort((a, b) => a.x - b.x);
        const boot = boots[left === near ? 0 : 1];
        if (boot) engine.setInput(boot.id, pressed);
      },
      releaseInputs() {
        engine.releaseInputs();
      },
    };
    inputs = bindInputs(
      root,
      control,
      () => engine.state === "active" && !engine.paused && !root.querySelector("dialog[open]") && root.dataset.stage !== "setup",
    );
    let resumeAfterSettings = false, panelSession = false;
    root.addEventListener('footballsettingsopen', () => {
      inputs.clear();
      if(!panelSession) resumeAfterSettings = engine.authority !== 'server' && !['ready','ended'].includes(engine.state) && !engine.paused;
      panelSession=true;
      if (resumeAfterSettings) engine.setPaused(true);
      root.querySelector('#fp-settings-note').textContent = engine.authority === 'server'
        ? 'Live online match continues. Match options are locked.'
        : engine.state === 'active' ? 'Match paused. Match options unlock after restart.' : 'Choose settings before starting a match.';
    });
    root.addEventListener('footballsettingsclose', () => {
      if(root.querySelector('dialog[open]'))return;
      panelSession=false;
      if (resumeAfterSettings && !['ready','ended'].includes(engine.state)) engine.setPaused(false);
      resumeAfterSettings = false;
    });
    root.querySelector("#fp-serve").onclick = async () => {
      if (engine.authority === "server") {
        if (engine.team === "blue") command({ type: "start" });
        return;
      }
      const options = setup.values();
      setup.lock(true);
      try {
        const joinId = root.querySelector("#fp-join-code")?.value.trim();
        const remote =
          serverBase &&
          (options.opponent === "human" ||
            joinId ||
            root.querySelector("#fp-authority")?.checked);
        if (remote && engine.authority !== "server") {
          const { createRemoteMatch } = await import("./network/client.js");
          const next = await createRemoteMatch({
            base: serverBase,
            mode,
            joinId,
            ...options,
          });
          engine.dispose();
          engine = next;
          sessionTeam = engine.team;
          setup.section.hidden = true;
          root.querySelector("#fp-network-status").textContent =
            `Match code: ${engine.id} · You are ${sessionTeam}. Share this code with your opponent.`;
        } else if (!remote) {
          const next = await createMatch({
            mode,
            seed: seed(),
            ...matchOptions(options),
          });
          engine.dispose();
          engine = next;
          audio.reset();
        }
        if (
          !engine.waiting &&
          (engine.authority !== "server" || engine.team === "blue")
        )
          command({ type: "start", call: options.call });
      } catch (error) {
        setup.lock(false);
        const status =
          root.querySelector("#fp-network-status") ||
          root.querySelector("#fp-status");
        status.textContent = error.message;
      }
    };
    root.querySelector("#fp-pause").onclick = () =>
      engine.setPaused(!engine.paused);
    root
      .querySelector("#fp-bank")
      ?.addEventListener("click", () => command({ type: "bank" }));
    root.querySelector("#fp-reset").onclick = async () => {
      inputs.clear();
      sessionTeam = "blue";
      setup.section.hidden = false;
      setup.lock(false);
      const next = await createMatch({
        mode,
        seed: seed(),
        ...matchOptions(setup.values()),
      });
      engine.dispose();
      engine = next;
      ended = false;
      audio.reset();
      root.querySelector("#fp-results").hidden = true;
    };
    setup.toss
      .querySelectorAll("[data-choice]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            command(
              b.dataset.choice === "kickoff"
                ? { type: "choose", choice: "kickoff" }
                : { type: "choose", choice: "side", value: b.dataset.choice },
            )),
      );
    document.addEventListener("visibilitychange", () => {
      if (
        document.hidden &&
        engine.authority !== "server" &&
        engine.state !== "ready" &&
        engine.state !== "ended"
      )
        engine.setPaused(true);
    });
    function draw(now) {
      engine.advance((now - last) / 1000);
      last = now;
      const s = engine.snapshot();
      const side = s.defendingEnd?.[sessionTeam] || "near";
      if (side !== lastSide) {
        view.setViewTeam(side === "near" ? "blue" : "red");
        lastSide = side;
        inputs.clear();
      }
      root.dataset.matchState=s.state;
      view.draw(engine.renderSnapshot ? engine.renderSnapshot() : s);
      audio.update(s.events,s);
      if(mode==='pvp')updateShotPower(root,s,sessionTeam);
      const messages = {
        ready: "Ready when you are.",
        toss: "Coin toss…",
        choice: "Choose kickoff or the goal you defend.",
        countdown: "Get ready…",
        active:
          mode === "crash"
            ? "Keep the ball alive. Bank before it drains."
            : "Play on.",
        relaunch: s.restart
          ? `Out of play. ${s.restart.team === sessionTeam ? "Your" : "Opponent"} kickoff…`
          : mode === "pvp" ? "Goal. Preparing kickoff…" : "Preparing the next ball…",
        halftime: "Half time. Teams change ends.",
        ended: "Round complete.",
      };
      updateHud(root, {
        score: s.score,
        remainingSeconds: s.remaining,
        multiplier: s.multiplier,
        basePoints: s.basePoints,
        bankValue: s.potentialBank,
        points: typeof s.points === "number" ? s.points : s.points?.blue,
        combo: s.combo,
        multiballRemaining:s.multiballRemaining,
        shots: s.shot?.index,
        totalShots: s.shot?.total,
        goals: s.shot?.goals,
        streak: s.shot?.streak,
        paused: s.paused,
        status:
          engine.error ||
          (engine.waiting
            ? "Waiting for opponent to join."
            : s.paused
              ? "Paused"
              : s.rush
                ? "Final Rush — bonus scoring active"
                : messages[s.state]),
        sessionLabel:
          engine.authority === "server"
            ? "SERVER SESSION"
            : mode === "pvp"
              ? "VS CPU"
              : "LOCAL PRACTICE",
        canServe:
          s.state === "ready" &&
          !engine.waiting &&
          (engine.authority !== "server" || engine.team === "blue"),
        canFlip: s.state === "active" && !s.paused,
        canPause:
          !["ready", "ended"].includes(s.state) &&
          !(engine.authority === "server" && mode === "pvp"),
        canReset: true,
        canBank: mode === "crash" && s.state === "active" && !s.paused,
        finalRush: s.rush,
      });
      setup.toss.hidden =
        !["toss", "choice", "countdown"].includes(s.state) || mode !== "pvp";
      if (s.toss) {
        setup.toss.querySelector("#fp-toss-label").textContent =
          s.state === "toss"
            ? "Coin toss…"
            : `${s.toss.face}. ${s.toss.winner === sessionTeam ? "You win" : `${s.toss.winner} wins`} the toss.`;
        setup.toss.querySelector("#fp-toss-choices").hidden =
          s.state !== "choice" || s.toss.winner !== sessionTeam;
      }
      if (s.state === "ended" && !ended) {
        ended = true;
        const result = s.result || {};
        const points =
          mode === "crash"
            ? result.bankedPoints
            : typeof result.points === "number"
              ? result.points
              : result.points?.[sessionTeam];
        let best = null;
        try {
          const key = `football-best-${mode}`;
          best = Math.max(Number(localStorage.getItem(key)) || 0, points || 0);
          localStorage.setItem(key, String(best));
        } catch {}
        if (mode === "arcade-rush") saveRecord(mode, points || 0);
        renderResults(root, {
          title:
            mode === "pvp"
              ? result.winner === "blue"
                ? `${root.querySelector(".fp-blue .fp-team-name small")?.textContent || "Blue"} wins`
                : result.winner === "red"
                  ? `${root.querySelector(".fp-red .fp-team-name small")?.textContent || "Red"} wins`
                  : "Draw"
              : mode === "crash"
                ? result.reason === "banked"
                  ? "Points banked"
                  : "Round ended"
                : "Round complete",
          summary:
            mode === "pvp"
              ? `${s.score.blue} – ${s.score.red}`
              : mode === "penalty"
                ? `${s.shot?.goals || 0} goals from five attempts`
                : result.reason || "",
          points,
          rows:
            best !== null
              ? [{ label: "Best on this device", value: best }]
              : [],
        });
        if (mode === "arcade-rush")
          renderRecords(root.querySelector("#fp-results"), mode);
        if (engine.authority === "server") {
          const finishedEngine = engine;
          finishedEngine
            .verificationBundle()
            .then((bundle) => {
              if (engine !== finishedEngine) return;
              const button = document.createElement("button");
              button.textContent = "Download signed replay";
              button.onclick = () => {
                const url = URL.createObjectURL(
                  new Blob([JSON.stringify(bundle, null, 2)], {
                    type: "application/json",
                  }),
                );
                const link = document.createElement("a");
                link.href = url;
                link.download = `football-${finishedEngine.id}.json`;
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              };
              root.querySelector("#fp-results").append(button);
            })
            .catch((error) => {
              root.querySelector("#fp-status").textContent =
                `Result verification download unavailable: ${error.message}`;
            });
        }
      }
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    if (import.meta.env.DEV && query.has("qa"))
      window.__football = {
        get engine() {
          return engine;
        },
        view,
        audio,
        snapshot: () => engine.snapshot(),
      };
    window.addEventListener(
      "pagehide",
      () => {
        cancelAnimationFrame(frame);
        inputs.dispose();
        audio.dispose();
        view.dispose();
        engine.dispose();
      },
      { once: true },
    );
  } catch (error) {
    console.error(error);
    root.querySelector("#fp-loading")?.remove();
    updateHud(root, {
      status: "The game could not load. Reload to try again.",
    });
  }
}
