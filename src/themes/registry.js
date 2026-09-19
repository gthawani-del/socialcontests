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
  }),

  bollywood: Object.freeze({
    id: 'bollywood',
    name: 'Bollywood Legends',
    shortName: 'BOLLYWOOD LEGENDS',
    statusLabel: 'BOLLYWOOD · LEGENDS',
    type: 'bollywood-legends',
    audioProfile: 'bollywood',
    scene: Object.freeze({
      background: 0x050305,
      fog: 0x12070b,
      fogDensity: 0.015,
      exposure: 1.08
    }),
    palette: Object.freeze({
      primary: '#b8862e',
      secondary: '#8d1627',
      dark: '#090709',
      light: '#f1d8a1',
      crimson: '#4b0a13'
    }),
    targetLabels: Object.freeze({
      p: 'C',
      a: 'I',
      r: 'N',
      i: 'E',
      s: 'M',
      star: 'A'
    }),
    targetBankLabel: 'CINEMA',
    scoringZoneLabel: 'SPOTLIGHT',
    assets: Object.freeze({
      environment: '/models/bollywood-legends-environment.glb.gz',
      portraits: Object.freeze({
        Amitabh_Bachchan: 'https://d8j0ntlcm91z4.cloudfront.net/user_3BjwTJYCzFGxri4Mx2xQr2GkqBc/hf_20260919_153504_7207219c-c8f2-43c2-a222-d93950fb57fb.png',
        Shah_Rukh_Khan: 'https://d8j0ntlcm91z4.cloudfront.net/user_3BjwTJYCzFGxri4Mx2xQr2GkqBc/hf_20260919_153504_cf85b95c-eef0-46cc-aaa7-a61642a488e1.png',
        Madhuri_Dixit: 'https://d8j0ntlcm91z4.cloudfront.net/user_3BjwTJYCzFGxri4Mx2xQr2GkqBc/hf_20260919_153504_65bebcb0-7e84-4315-bc4e-98d6b21f33b7.png',
        Sridevi: 'https://d8j0ntlcm91z4.cloudfront.net/user_3BjwTJYCzFGxri4Mx2xQr2GkqBc/hf_20260919_153504_34d2159c-c3ab-411f-8b72-fbc68494bf96.png',
        Raj_Kapoor: 'https://d8j0ntlcm91z4.cloudfront.net/user_3BjwTJYCzFGxri4Mx2xQr2GkqBc/hf_20260919_153541_8efadb57-674b-46b4-a8cc-e3f65930101e.png',
        Rekha: 'https://d8j0ntlcm91z4.cloudfront.net/user_3BjwTJYCzFGxri4Mx2xQr2GkqBc/hf_20260919_153504_ff823c16-b738-49b2-8bc8-c24698d4e754.png',
        Salman_Khan: 'https://d8j0ntlcm91z4.cloudfront.net/user_3BjwTJYCzFGxri4Mx2xQr2GkqBc/hf_20260919_153541_4aea8105-fbd5-41d7-b443-78e1b125fb09.png'
      })
    })
  })
});

export const DEFAULT_THEME = 'paris';

export function resolveTheme(requested) {
  const normalized = String(requested || '').trim().toLowerCase();
  return THEMES[normalized] || THEMES[DEFAULT_THEME];
}
