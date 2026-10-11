export function addSetup(root, mode, onlineAvailable = false) {
  const section = document.createElement("form");
  section.id = "fp-setup";
  section.className = "fp-setup";
  const difficulty =
    mode === "penalty"
      ? '<option value="rookie">Rookie</option><option value="pro">Pro</option><option value="elite">Elite</option>'
      : '<option value="easy">Easy</option><option value="medium" selected>Medium</option><option value="hard">Hard</option>';
  section.innerHTML = `${["pvp", "penalty"].includes(mode) ? `<label>Difficulty<select name="difficulty">${difficulty}</select></label>` : ""}${mode === "pvp" ? `<label>Format<select name="format"><option value="quick">First to 3</option><option value="classic">Two 2-minute halves</option><option value="golden">Golden goal</option></select></label><label>Opponent<select name="opponent"><option value="cpu">CPU</option>${onlineAvailable ? '<option value="human">Online player</option>' : ""}</select></label><label>Toss call<select name="call"><option value="heads">Heads</option><option value="tails">Tails</option></select></label>` : ""}`;
  if (section.innerHTML) root.querySelector(".fp-hud").before(section);
  section.addEventListener("submit", (e) => e.preventDefault());
  const toss = document.createElement("section");
  toss.id = "fp-toss";
  toss.className = "fp-toss";
  toss.hidden = true;
  toss.innerHTML =
    '<p id="fp-toss-label" role="status"></p><div id="fp-toss-choices" hidden><button data-choice="kickoff">Take kickoff</button><button data-choice="near">Defend near goal</button><button data-choice="far">Defend far goal</button></div>';
  root.querySelector("#fp-arena").after(toss);
  return {
    values() {
      const d = new FormData(section);
      return {
        difficulty: d.get("difficulty") || "medium",
        format: d.get("format") || "quick",
        opponent: d.get("opponent") || "cpu",
        call: d.get("call") || "heads",
      };
    },
    lock(locked) {
      section.querySelectorAll("select").forEach((s) => (s.disabled = locked));
    },
    section,
    toss,
  };
}
