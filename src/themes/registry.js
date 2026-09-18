export const THEMES = Object.freeze({
  paris: Object.freeze({
    id: 'paris',
    name: 'Paris Nights',
    shortName: 'PARIS NIGHTS',
    statusLabel: 'PARIS NIGHTS',
    type: 'paris',
    audioProfile: 'paris',
    scene: Object.freeze({
      background: 0x04070d,
      fog: 0x04070d,
      fogDensity: 0.015,
      exposure: 1.13
    }),
    palette: Object.freeze({
      primary: '#e5ad43',
      secondary: '#315aa0',
      dark: '#07162e',
      light: '#f6ead0'
    }),
    targetLabels: Object.freeze({
      p: 'P',
      a: 'A',
      r: 'R',
      i: 'I',
      s: 'S',
      star: '★'
    }),
    targetBankLabel: 'PARIS',
    scoringZoneLabel: 'CITY LIGHT',
    assets: Object.freeze({
      playfield: '/themes/paris/assets/playfield.webp',
      backdrop: '/themes/paris/assets/backdrop.webp',
      metro: '/themes/paris/assets/metro.webp',
      cafe: '/themes/paris/assets/cafe.webp',
      paris: '/themes/paris/assets/paris.webp',
      jackpot: '/themes/paris/assets/jackpot.webp',
      hero: '/themes/paris/assets/hero.webp'
    })
  }),

  'bombay-1945': Object.freeze({
    id: 'bombay-1945',
    name: 'Bombay 1945',
    shortName: 'BOMBAY 1945',
    statusLabel: 'BOMBAY · 1945',
    type: 'bombay-1945',
    audioProfile: 'bombay-1945',
    scene: Object.freeze({
      background: 0x090c0c,
      fog: 0x111713,
      fogDensity: 0.018,
      exposure: 1.06
    }),
    palette: Object.freeze({
      primary: '#d6a84b',
      secondary: '#315b4b',
      dark: '#111713',
      light: '#ead8ad',
      maroon: '#7a342e'
    }),
    targetLabels: Object.freeze({
      p: 'B',
      a: 'O',
      r: 'M',
      i: 'B',
      s: 'A',
      star: 'Y'
    }),
    targetBankLabel: 'BOMBAY',
    scoringZoneLabel: 'TRAM BELL',
    archive: Object.freeze({
      victoriaTerminus1940: 'https://upload.wikimedia.org/wikipedia/commons/f/fd/Victoria_Terminus_in_1940_by_Homai_Vyarawalla.jpg',
      floraFountainPostcard: 'https://upload.wikimedia.org/wikipedia/commons/b/b4/Flora_fountain_Bombay.jpg'
    })
  })
});

export const DEFAULT_THEME = 'paris';

export function resolveTheme(requested) {
  const normalized = String(requested || '').trim().toLowerCase();
  return THEMES[normalized] || THEMES[DEFAULT_THEME];
}
