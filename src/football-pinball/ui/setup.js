export function addSetup(root, mode, onlineAvailable = false) {
  const section = document.createElement("form");
  section.id = "fp-setup";
  section.className = "fp-setup";
  const difficulty =
    mode === "penalty"
      ? '<option value="rookie">Rookie</option><option value="pro">Pro</option><option value="elite">Elite</option>'
      : '<option value="easy">Easy</option><option value="medium" selected>Medium</option><option value="hard">Hard</option>';
  section.innerHTML = `${["pvp", "penalty"].includes(mode) ? `<label>Difficulty<select name="difficulty">${difficulty}</select></label>` : ""}${mode === "pvp" ? `<label>Format<select name="format"><option value="quick">First to 3</option><option value="classic">Two 2-minute halves</option><option value="golden">Golden goal</option></select></label><label>Opponent<select name="opponent"><option value="cpu">CPU</option>${onlineAvailable ? '<option value="human">Online player</option>' : ""}</select></label><label>Toss call<select name="call"><option value="heads">Heads</option><option value="tails">Tails</option></select></label>` : ""}`;
  if (section.innerHTML) {
    if (mode === 'pvp') {
      const settings=document.createElement('dialog');settings.id='fp-settings-dialog';
      settings.className='fp-settings-dialog';settings.setAttribute('aria-labelledby','fp-settings-title');
      settings.innerHTML='<header><h2 id="fp-settings-title">Match settings</h2><button type="button" id="fp-settings-close" aria-label="Close match settings">×</button></header><p id="fp-settings-note">Choose settings before starting a match.</p>';
      settings.append(section,root.querySelector(".fp-how"));
      const done=document.createElement('button');done.type='button';done.id='fp-settings-done';done.textContent='Done';settings.append(done);
      root.append(settings);
      const trigger=document.createElement('button');trigger.type='button';trigger.id='fp-settings-open';trigger.setAttribute('aria-label','Match settings');trigger.setAttribute('aria-haspopup','dialog');
      trigger.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m9 3-.5 2-2 .9-1.9-.6-2 3.4 1.5 1.5v2.3L2.6 14l2 3.4 2-.6 1.9 1 .5 2.2h4l.6-2.2 1.9-1 2 .6 2-3.4-1.5-1.5v-2.3l1.5-1.5-2-3.4-2 .6-1.9-.9L13 3Z"/><circle cx="11" cy="11.5" r="3"/></svg>';
      root.querySelector('.fp-build-label').replaceWith(trigger);
      trigger.onclick=()=>{settings.showModal();root.dispatchEvent(new Event('footballsettingsopen'));};
      const close=()=>settings.close();done.onclick=close;settings.querySelector('#fp-settings-close').onclick=close;
      settings.addEventListener('click',event=>{if(event.target===settings){const r=settings.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}});
      settings.addEventListener('close',()=>{root.dispatchEvent(new Event('footballsettingsclose'));trigger.focus();});
    } else root.querySelector(".fp-hud").before(section);
  }
  section.addEventListener("submit", (e) => e.preventDefault());
  const toss = document.createElement("section");
  toss.id = "fp-toss";
  toss.className = "fp-toss";
  toss.hidden = true;
  toss.innerHTML =
    '<p id="fp-toss-label" role="status"></p><div id="fp-toss-choices" hidden><button data-choice="kickoff">Take kickoff</button><button data-choice="near">Defend near goal</button><button data-choice="far">Defend far goal</button></div>';
  if(mode==='pvp') root.querySelector("#fp-arena").append(toss);
  else root.querySelector("#fp-arena").after(toss);
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
      if(locked && mode==='pvp') section.closest('dialog')?.close();
      section.querySelectorAll("select").forEach((s) => (s.disabled = locked));
    },
    section,
    toss,
  };
}
