export function createStadiumFeedback({
  app,
  viewport,
  canvas,
  ballMaterial,
  getBallScreenPosition = () => ({ x: 50, y: 72 })
}) {
  let flashTimer=0, contactSeen=false, humanBatting=false, deliveryHumanBatting=false;
  const timing=document.createElement('div');timing.id='contactFeedback';timing.setAttribute('aria-live','polite');timing.hidden=true;viewport.append(timing);
  const vibrate = pattern => {
    try { navigator.vibrate?.(pattern); } catch {}
  };

  const classPulse = (name, duration = 360) => {
    app.classList.remove(name);
    void app.offsetWidth;
    app.classList.add(name);
    setTimeout(() => app.classList.remove(name), duration);
  };

  const impactBurst = strength => {
    const point = getBallScreenPosition();
    const burst = document.createElement('span');
    burst.className = 'impact-fx';
    burst.style.left = `${point.x}%`;
    burst.style.top = `${point.y}%`;
    burst.style.setProperty('--impact-scale', String(.75 + strength * .75));
    viewport.append(burst);
    setTimeout(() => burst.remove(), 380);
  };

  const flashBall = strength => {
    if (!ballMaterial?.emissive) return;
    clearTimeout(flashTimer);
    ballMaterial.emissive.set(strength > .72 ? '#d59a42' : '#8a612c');
    ballMaterial.emissiveIntensity = .55 + strength * .7;
    flashTimer = setTimeout(() => {
      ballMaterial.emissive.set('#000000');
      ballMaterial.emissiveIntensity = 1;
    }, 95);
  };

  const showTiming = feedback => {
    timing.hidden = false;
    const tips={PERFECT:'Clean contact',EARLY:'Wait a little longer',LATE:'Swing a little sooner',MISSED:'No bat contact'};
    timing.replaceChildren();
    const title=document.createElement('strong');title.textContent=feedback.timing;
    const tip=document.createElement('span');tip.textContent=tips[feedback.timing] || 'Bat contact';
    timing.append(title,tip);
    timing.dataset.timing = feedback.timing;
    clearTimeout(showTiming.timer);
    showTiming.timer = setTimeout(() => { timing.hidden = true; }, 1050);
  };

  const onBatContact = feedback => {
    contactSeen=true;
    if(deliveryHumanBatting)showTiming(feedback);
    impactBurst(feedback.quality);
    flashBall(feedback.quality);

    if (feedback.timing === 'PERFECT') {
      vibrate(18);
    } else {
      vibrate(10);
    }
  };

  const onOutcome = (outcome, metadata = {}) => {
    const value = String(outcome || '').toUpperCase();
    if(deliveryHumanBatting && !contactSeen && value !== 'DEAD_BALL')showTiming({timing:'MISSED'});
    if (metadata.reason === 'SKILL_REJECTED') {
      classPulse('score-miss', 320);
      vibrate(12);
      return;
    }
    if (value === 'SIX') {
      classPulse('score-six', 620);
      vibrate([22, 18, 35]);
    } else if (value === 'FOUR') {
      classPulse('score-four', 520);
      vibrate([18, 14, 20]);
    } else if (value === 'WICKET') {
      classPulse('score-wicket', 620);
      vibrate([35, 25, 45]);
    } else if (value === 'ONE' || value === 'TWO') {
      classPulse('score-run', 300);
      vibrate(8);
    }
  };

  const onMatchResult = result => {
    const playerWon = result?.winnerId === 'player';
    if (result?.type === 'TIE' || !result?.winnerId) {
      classPulse('match-tie', 900);
      return;
    }
    if (playerWon) {
      classPulse('match-win', 1100);
      vibrate([24, 20, 24, 20, 48]);
    } else {
      classPulse('match-loss', 900);
      vibrate([35, 28, 35]);
    }
  };

  const handle = event => {
    if (!event) return;
    if (event.type === 'CONTROL_STATE') humanBatting=event.practice==='bat' || event.humanBatting;
    if (event.type === 'DELIVERY_LAUNCH') deliveryHumanBatting=event.match?.battingPlayerId ? event.match.battingPlayerId==='player' : humanBatting;
    if (event.type === 'MATCH_RESET') deliveryHumanBatting=false;
    if (event.type === 'DELIVERY_LAUNCH' || event.type === 'MATCH_RESET') {contactSeen=false;timing.hidden=true;clearTimeout(showTiming.timer);}
    if (event.type === 'BAT_CONTACT') onBatContact(event.feedback);
    else if (event.type === 'OUTCOME') onOutcome(event.outcome, event.metadata);
    else if (event.type === 'MATCH_RESULT') {
      onMatchResult(event.result);
    }
  };

  return { handle };
}
