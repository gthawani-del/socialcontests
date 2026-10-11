import { resolveKits } from './team-kits.js';
// Curated factual names checked against Colours of Football on 2026-10-11.
// Kit artwork, crests and sponsor graphics are not bundled.
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

export function addTeamSelection(root, preflight, before) {
  const section = document.createElement('section');
  section.className = 'fp-team-selection';
  section.setAttribute('aria-label', 'Choose teams');
  section.innerHTML = '<h2>Choose teams</h2><label>Competition<select id="fp-team-type"><option value="country">Countries</option><option value="club">Clubs</option></select></label><div class="fp-team-pickers"><label>Player 1 · Blue<select id="fp-blue-team"></select></label><label>Player 2 / CPU · Red<select id="fp-red-team"></select></label></div><p>Jerseys follow your team; boot controls stay blue/red.</p>';
  preflight.insertBefore(section, before);
  const type = section.querySelector('#fp-team-type');
  const blue = section.querySelector('#fp-blue-team');
  const red = section.querySelector('#fp-red-team');
  function update() {
    root.querySelector('.fp-blue .fp-team-name small').textContent = blue.value;
    root.querySelector('.fp-red .fp-team-name small').textContent = red.value;
    root.footballKits = resolveKits(blue.value,red.value);
    const kits=root.footballKits;
    section.querySelector('p').textContent=`${blue.value}: ${kits.blue.label}. ${red.value}: ${kits.red.label}. Boot controls stay blue/red.`;
  }
  function populate() {
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
