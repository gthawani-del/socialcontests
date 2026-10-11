// Simplified team-colour palettes, not season-specific replica shirts.
// Reference directory: https://www.colours-of-football.com/ (historical kit archive).
// Hex values are our game-art colours; no sponsor, crest or source artwork is copied.
const C = { red:'#cf263e', blue:'#1766cc', navy:'#142d64', white:'#eeeeea', yellow:'#f3ca25', green:'#15834b', black:'#20252d', sky:'#79bce8', maroon:'#792b43', orange:'#ed7629' };
const rows = {
  Argentina:['sky','white','navy'], Australia:['yellow','yellow','green'], Belgium:['red','red','white'], Brazil:['yellow','yellow','blue'],
  Cameroon:['green','green','yellow'], Canada:['red','red','white'], Colombia:['yellow','yellow','navy'], Croatia:['white','red','navy'],
  Denmark:['red','red','white'], Egypt:['red','red','white'], England:['white','white','red'], France:['blue','blue','white'],
  Germany:['white','white','black'], Ghana:['white','white','red'], India:['blue','blue','orange'], Italy:['blue','blue','white'],
  Japan:['blue','blue','white'], 'Korea Republic':['red','red','white'], Mexico:['green','green','white'], Morocco:['red','red','white'],
  'New Zealand':['white','white','black'], Nigeria:['green','green','white'], Norway:['red','red','white'], Portugal:['red','red','white'],
  'Saudi Arabia':['white','white','green'], Scotland:['navy','navy','white'], Senegal:['white','white','green'], 'South Africa':['yellow','yellow','green'],
  Spain:['red','red','white'], Sweden:['yellow','yellow','blue'], Switzerland:['red','red','white'], Uruguay:['sky','sky','white'], USA:['white','white','navy'], Wales:['red','red','white'],
  Arsenal:['red','white','yellow'], 'Aston Villa':['maroon','sky','white'], Chelsea:['blue','blue','yellow'], Everton:['blue','blue','yellow'],
  Liverpool:['red','red','white'], 'Manchester City':['sky','sky','navy'], 'Manchester United':['red','red','white'], 'Newcastle United':['black','white','yellow'],
  'Tottenham Hotspur':['white','white','navy'], 'West Ham United':['maroon','sky','white'], 'Athletic Club Bilbao':['red','white','black'],
  'Club Atletico de Madrid':['red','white','navy'], 'FC Barcelona':['blue','maroon','yellow'], 'Real Betis Balompie':['green','white','black'],
  'Real Madrid CF':['white','white','navy'], 'Sevilla FC':['white','white','red'], 'Valencia CF':['white','white','orange'],
  'Villarreal CF':['yellow','yellow','blue'], 'AC Milan':['red','black','white'], 'AS Roma':['maroon','maroon','white'], 'Atalanta BC':['blue','black','white'],
  'FC Internazionale':['blue','black','white'], 'Juventus FC':['black','white','blue'], 'SSC Napoli':['sky','sky','white'],
};
export const TEAM_KITS = Object.fromEntries(Object.entries(rows).map(([name,[main,secondary,away]])=>[name,{
  home:{ primary:C[main], secondary:C[secondary], pattern:name==='Croatia'?'checks':'stripes', label:'Home colours' },
  away:{ primary:C[away], secondary:C[away], label:'Alternate colours' },
}]));
// Deliberately conservative RGB distance: red/maroon and blue/navy trigger a change.
function distance(a,b){const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));const x=rgb(a),y=rgb(b);return Math.hypot(...x.map((v,i)=>v-y[i]));}
function separation(a,b){return Math.min(...[a.primary,a.secondary].flatMap(x=>[b.primary,b.secondary].map(y=>distance(x,y))));}
export function resolveKits(blueName,redName){
  const b=TEAM_KITS[blueName],r=TEAM_KITS[redName];
  if(!b||!r)throw new Error('Unknown team kit');
  let blue=b.home,red=r.home;
  if(separation(blue,red)<105){
    const pairs=[[b.home,r.away],[b.away,r.home],[b.away,r.away]];
    [blue,red]=pairs.sort((a,b)=>separation(...b)-separation(...a))[0];
  }
  return {blue,red};
}
