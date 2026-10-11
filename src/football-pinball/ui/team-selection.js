import { resolveKits } from './team-kits.js';
import { setupIcon } from './preflight-art.js';
// Curated factual names checked against Colours of Football on 2026-10-11.
// Preview shirts are original generic artwork, without crests or sponsors.
export const TEAM_CATALOGUE = {
  country: {
    source: 'https://www.colours-of-football.com/national_teams_kits/football_national_teams.html',
    names: ['Argentina','Australia','Belgium','Brazil','Cameroon','Canada','Colombia','Croatia','Denmark','Egypt','England','France','Germany','Ghana','India','Italy','Japan','Korea Republic','Mexico','Morocco','New Zealand','Nigeria','Norway','Portugal','Saudi Arabia','Scotland','Senegal','South Africa','Spain','Sweden','Switzerland','Uruguay','USA','Wales'],
  },
  club: {
    sources: [
      'https://www.colours-of-football.com/colours03/eng/eng.html',
      'https://www.colours-of-football.com/colours03/esp/esp.html',
      'https://www.colours-of-football.com/colours03/ita/italy.html',
    ],
    names: ['Arsenal','Aston Villa','Chelsea','Everton','Liverpool','Manchester City','Manchester United','Newcastle United','Tottenham Hotspur','West Ham United','Athletic Club Bilbao','Club Atletico de Madrid','FC Barcelona','Real Betis Balompie','Real Madrid CF','Sevilla FC','Valencia CF','Villarreal CF','AC Milan','AS Roma','Atalanta BC','FC Internazionale','Juventus FC','SSC Napoli'],
  },
};

const COUNTRY_CODES = ['AR','AU','BE','BR','CM','CA','CO','HR','DK','EG','', 'FR','DE','GH','IN','IT','JP','KR','MX','MA','NZ','NG','NO','PT','SA','GB','SN','ZA','ES','SE','CH','UY','US','GB'];
function teamBadge(name, type) {
  if (name === 'India') return '<svg viewBox="0 0 30 21" aria-hidden="true"><path fill="#ff982e" d="M0 0h30v7H0z"/><path fill="#fff" d="M0 7h30v7H0z"/><path fill="#14843b" d="M0 14h30v7H0z"/><circle cx="15" cy="10.5" r="2.7" fill="none" stroke="#1e3790" stroke-width=".7"/><path stroke="#1e3790" stroke-width=".5" d="M15 8v5m-2.5-2.5h5m-4.3-1.8 3.6 3.6m0-3.6-3.6 3.6"/></svg>';
  if (name === 'England') return '<svg viewBox="0 0 30 21" aria-hidden="true"><path fill="#fff" d="M0 0h30v21H0z"/><path fill="#d52b3c" d="M12 0h6v21h-6z"/><path fill="#d52b3c" d="M0 8h30v5H0z"/></svg>';
  if (type === 'country' && !['Scotland', 'Wales'].includes(name)) {
    const code = COUNTRY_CODES[TEAM_CATALOGUE.country.names.indexOf(name)];
    return [...code].map(letter => String.fromCodePoint(127397 + letter.charCodeAt())).join('');
  }
  return name.split(' ').slice(0,2).map(word => word[0]).join('');
}

function teamCard(side, title) {
  return `<article class="fp-pvp-team" data-side="${side}">
    <h3>${title}</h3>
    <div class="fp-pvp-jersey" aria-hidden="true"><div class="fp-pvp-kit-paint"></div><img src="/football-pinball/art/pvp-kit-${side === 'blue' ? 'india' : 'neutral'}.webp" width="600" height="623" alt="" decoding="async"></div>
    <label class="fp-pvp-team-control"><span class="fp-pvp-badge" aria-hidden="true"></span><select id="fp-${side}-team" aria-label="${title}" aria-describedby="fp-pvp-kit-note"></select></label>
    <div class="fp-pvp-control-colour">${setupIcon('boot')}<span>${side === 'blue' ? 'Blue' : 'Red'} controls</span></div>
  </article>`;
}

function updatePreview(card, name, kit, type) {
  card.querySelector('.fp-pvp-badge').innerHTML = teamBadge(name, type);
  card.querySelector('select').title = name;
  const shirt = card.querySelector('.fp-pvp-jersey');
  const india = name === 'India' && kit.label === 'Home colours';
  shirt.dataset.original = String(india || (name === 'England' && kit.label === 'Home colours'));
  shirt.dataset.pattern = kit.primary === kit.secondary ? 'solid' : kit.pattern || 'solid';
  shirt.style.setProperty('--kit-primary', kit.primary);
  shirt.style.setProperty('--kit-secondary', kit.secondary);
  card.querySelector('img').src = `/football-pinball/art/pvp-kit-${india ? 'india' : 'neutral'}.webp`;
  card.dataset.kit = kit.label;
}

export function addTeamSelection(root, preflight, before) {
  const section = document.createElement('section');
  section.className = 'fp-team-selection';
  section.setAttribute('aria-label', 'Choose teams');
  section.innerHTML = `<div class="fp-pvp-teams-heading"><h2>Choose teams</h2><label><span class="fp-pvp-competition-label">Competition</span><select id="fp-team-type"><option value="country">Countries</option><option value="club">Clubs</option></select></label></div><div class="fp-team-pickers">${teamCard('blue', 'Your team')}<span class="fp-pvp-versus" aria-hidden="true">VS</span>${teamCard('red', 'CPU team')}</div><p id="fp-pvp-kit-note" role="status"></p>`;
  preflight.insertBefore(section, before);
  const type = section.querySelector('#fp-team-type');
  const blue = section.querySelector('#fp-blue-team');
  const red = section.querySelector('#fp-red-team');
  function update() {
    root.querySelector('.fp-blue .fp-team-name small').textContent = blue.value;
    root.querySelector('.fp-red .fp-team-name small').textContent = red.value;
    root.footballKits = resolveKits(blue.value,red.value);
    const kits=root.footballKits;
    updatePreview(section.querySelector('[data-side=blue]'), blue.value, kits.blue, type.value);
    updatePreview(section.querySelector('[data-side=red]'), red.value, kits.red, type.value);
    section.querySelector('p').textContent = kits.blue.label === 'Home colours' && kits.red.label === 'Home colours'
      ? 'Home kits. Boot controls stay blue/red.'
      : `${kits.blue.label === 'Alternate colours' ? blue.value : red.value} uses alternate colours to avoid a clash. Boot controls stay blue/red.`;
  }
  function populate() {
    section.dataset.competition = type.value;
    const names = [...TEAM_CATALOGUE[type.value].names].sort((a,b)=>a.localeCompare(b));
    for (const select of [blue,red]) select.replaceChildren(...names.map(name=>new Option(name,name)));
    blue.value = type.value === 'country' ? 'India' : 'Chelsea';
    red.value = type.value === 'country' ? 'England' : 'Liverpool';
    update();
  }
  type.addEventListener('change',populate);
  blue.addEventListener('change',update);
  red.addEventListener('change',update);
  // Online team identities must come from the shared session, not client-only labels.
  const opponent = root.querySelector('[name=opponent]');
  function availability() {
    const online = opponent?.value === 'human';
    section.dataset.online = String(online);
    section.querySelector('[data-side=red] h3').textContent = online ? 'Opponent' : 'CPU team';
    red.setAttribute('aria-label', online ? 'Opponent team' : 'CPU team');
    for (const select of [type,blue,red]) select.disabled = online;
    section.querySelector('p').textContent = online ? 'Country and club selection is currently available for CPU matches.' : 'Jerseys follow your team; boot controls stay blue/red.';
    if (online) {
      root.footballKits = null;
      root.querySelector('.fp-blue .fp-team-name small').textContent='Blue team';
      root.querySelector('.fp-red .fp-team-name small').textContent='Red team';
    } else update();
  }
  opponent?.addEventListener('change',availability);
  populate();availability();
}
