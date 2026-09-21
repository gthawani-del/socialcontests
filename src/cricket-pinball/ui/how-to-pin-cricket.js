import './how-to-pin-cricket.css';

export function installHowToPinCricket({ root = document.body, context = 'lobby' } = {}) {
  if (!root || root.querySelector('[data-how-pin-cricket]')) return;
  const wrapper = document.createElement('div');
  wrapper.dataset.howPinCricket = '';
  const actionLabel = context === 'gameplay' ? 'BACK TO MATCH' : 'GOT IT — PLAY';
  wrapper.innerHTML = `
    <button class="how-pin-trigger" type="button" aria-haspopup="dialog" aria-controls="howPinCricketDialog">? <span>HOW TO PIN CRICKET</span></button>
    <div class="how-pin-backdrop" hidden>
      <section class="how-pin-dialog" id="howPinCricketDialog" role="dialog" aria-modal="true" aria-labelledby="howPinTitle">
        <header class="how-pin-header"><div><span>QUICK RULEBOOK</span><h2 id="howPinTitle">HOW TO PIN CRICKET</h2></div><button type="button" class="how-pin-close" data-how-close aria-label="Close rules">×</button></header>
        <div class="how-pin-body">
          <section class="how-pin-hero"><div><b>1 BALL</b><span>One pinball delivery = one cricket ball</span></div><i>→</i><div><b>BAT</b><span>Hit with the two flipper bats</span></div><i>→</i><div><b>SCORE</b><span>Return the hit ball into a run zone</span></div></section>
          <div class="how-pin-grid">
            <section><span class="how-pin-num">01</span><h3>THE MATCH</h3><p>You play <b>Player 1 vs CPU</b>. A toss decides who bats or bowls first.</p><div class="how-pin-chips"><span>3 BALLS</span><span>1 OVER · 6</span><span>2 OVERS · 12</span></div></section>
            <section><span class="how-pin-num">02</span><h3>WHEN YOU BOWL</h3><p>Choose <b>LEFT, CENTRE or RIGHT</b> to aim. Hold <b>CHARGE</b> for power, then release to bowl.</p><div class="how-pin-aim"><span>LEFT ↖</span><span>CENTRE ↑</span><span>RIGHT ↗</span></div></section>
            <section><span class="how-pin-num">03</span><h3>WHEN YOU BAT</h3><p>Use the <b>left and right bats</b> to strike the incoming ball. Keyboard: <b>A / ←</b> and <b>D / →</b>.</p><p class="how-pin-rule">No bat contact = no runs.</p></section>
            <section><span class="how-pin-num">04</span><h3>SCORING</h3><p>Runs only count <b>after a legal bat hit</b>. Send the returning ball into a marked scoring target.</p><div class="how-pin-scores"><b>1</b><b>2</b><b>4</b><b>6</b></div></section>
            <section><span class="how-pin-num">05</span><h3>WICKETS & DOT BALLS</h3><p>A genuine wicket drain is a <b>WICKET</b>. A stalled or timed-out delivery is a <b>DOT BALL</b>. Maximum <b>2 wickets</b> per innings.</p></section>
            <section><span class="how-pin-num">06</span><h3>GUTTER RESCUE</h3><p>Before bat contact, the first side-gutter trap gets <b>one rescue bounce</b>. If trapped again, it is a <b>DOT</b> and the ball counts.</p></section>
            <section><span class="how-pin-num">07</span><h3>SECOND INNINGS</h3><p>After Innings 1, roles switch. The chase target is <b>first-innings score + 1</b>. A visible countdown starts Innings 2.</p></section>
            <section><span class="how-pin-num">08</span><h3>WINNING</h3><p>The chasing side wins by reaching the target. Otherwise the defending side wins when the chase ends. A tie goes to the configured <b>Super Over</b>.</p></section>
          </div>
          <aside class="how-pin-note"><b>PACE OF PLAY</b><span>Every resolved delivery is followed by a 5-second next-ball countdown. Technical safety resets do not award runs.</span></aside>
        </div>
        <footer class="how-pin-footer"><button type="button" data-how-close>${actionLabel}</button></footer>
      </section>
    </div>
  `;
  root.appendChild(wrapper);
  const trigger = wrapper.querySelector('.how-pin-trigger');
  const backdrop = wrapper.querySelector('.how-pin-backdrop');
  const dialog = wrapper.querySelector('.how-pin-dialog');
  let previousFocus = null;
  const open = () => { previousFocus = document.activeElement; backdrop.hidden = false; document.body.classList.add('how-pin-open'); dialog.querySelector('.how-pin-close')?.focus(); };
  const close = () => { backdrop.hidden = true; document.body.classList.remove('how-pin-open'); previousFocus?.focus?.(); };
  trigger.addEventListener('click', open);
  wrapper.querySelectorAll('[data-how-close]').forEach((button) => button.addEventListener('click', close));
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !backdrop.hidden) close(); });
}
