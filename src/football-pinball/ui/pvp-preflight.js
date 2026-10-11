import { setupIcon } from './preflight-art.js';
import './pvp-preflight.css';

// Native radio groups keep keyboard, touch, FormData and the match lock in sync.
function segment(select, title) {
  const field = document.createElement('fieldset');
  field.className = 'fp-pvp-segment';
  const legend = document.createElement('legend');
  legend.textContent = title;
  const choices = document.createElement('div');
  choices.className = 'fp-pvp-choices';
  for (const option of select.options) {
    const label = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = select.name;
    radio.value = option.value;
    radio.checked = option.selected;
    const text = document.createElement('span');
    text.textContent = option.textContent;
    label.append(radio, text);
    choices.append(label);
  }
  field.append(legend, choices);
  return field;
}

export function decoratePvPPreflight(preflight) {
  preflight.classList.add('fp-pvp-preflight');
  const back = preflight.querySelector('a');
  back.innerHTML = setupIcon('back') + '<span>Modes</span>';
  const nav = document.createElement('nav');
  nav.className = 'fp-pvp-nav';
  nav.setAttribute('aria-label', 'Football navigation');
  const brand = document.createElement('div');
  brand.className = 'fp-pvp-brand';
  brand.innerHTML = 'FOOTBALL<span>PVP</span>';
  nav.append(back, brand);

  const heading = document.createElement('header');
  heading.className = 'fp-pvp-heading';
  const title = preflight.querySelector('h1');
  title.innerHTML = 'SET YOUR MATCH<span>.</span>';
  heading.innerHTML = '<p>HEAD TO HEAD</p>';
  heading.append(title);
  preflight.querySelectorAll(':scope > p').forEach(p => p.remove());

  const form = preflight.querySelector('#fp-setup');
  const opponent = form.querySelector('[name=opponent]').closest('label');
  const difficulty = segment(form.querySelector('[name=difficulty]'), 'Difficulty');
  const format = form.querySelector('[name=format]').closest('label');
  const call = segment(form.querySelector('[name=call]'), 'Toss call');
  const quick = document.createElement('div');
  quick.className = 'fp-pvp-quick';
  quick.append(opponent, difficulty);
  const rules = document.createElement('section');
  rules.className = 'fp-pvp-rules';
  rules.setAttribute('aria-labelledby', 'fp-pvp-rules-title');
  rules.innerHTML = '<h2 id="fp-pvp-rules-title">Match rules</h2><div class="fp-pvp-rules-panel"></div>';
  rules.lastElementChild.append(format, call);
  const teams = preflight.querySelector('.fp-team-selection');
  form.replaceChildren(quick, teams, rules);

  const hint = preflight.querySelector('.fp-setup-instructions');
  hint.innerHTML = `<div>${setupIcon('boot')}<span><strong>Tap to flip</strong><small>Release to return</small></span></div><div>${setupIcon('ball')}<span><strong>Players pass & shoot</strong><small>Automatic on contact</small></span></div>`;
  const sound = preflight.querySelector('#fp-preflight-audio');
  sound.innerHTML = setupIcon('sound') + `<span data-audio-label>${sound.textContent}</span><span class="fp-pvp-sound-switch" aria-hidden="true"></span>`;
  const start = preflight.querySelector('#fp-enter-board');
  start.innerHTML = '<span>Continue</span>' + setupIcon('next');
  const actions = document.createElement('div');
  actions.className = 'fp-pvp-actions';
  actions.append(sound, start);
  preflight.replaceChildren(nav, heading, form, hint, actions);
}
