const VOICE_ID = 'bb5da5dbfad34bbeb2032098d15babe2';
const lines = {
  SIX: ['ओए गुरु! क्या ज़बरदस्त छक्का लगाया है! गेंद सीधी बाउंड्री के पार!', 'ये तो गगनचुंबी छक्का है! क्या कमाल का प्रहार!'],
  FOUR: ['वाह गुरु! क्या शानदार चौका लगाया है!', 'गेंद बाउंड्री के पार! चार रन!'],
  WICKET: ['अरे बाप रे! विकेट गिर गया! क्या गेंदबाज़ी है!', 'ओए होए! बल्लेबाज़ की गिल्लियाँ बिखर गईं!'],
  DOT: ['शानदार गेंद! इस बार कोई रन नहीं!', 'ओए गुरु, बल्लेबाज़ यहाँ चूक गया!'],
  ONE: ['एक रन मिल गया! मुकाबला जारी है!'],
  TWO: ['दो रन पूरे! अच्छी दौड़!'],
  THREE: ['तीन रन! क्या ज़बरदस्त भागदौड़ है!'],
  DEAD_BALL: ['डेड बॉल! ये गेंद गिनी नहीं जाएगी!']
};
const usage = new Map();
function pick(type) {
  const choices = lines[type] || lines.DOT;
  const n = usage.get(type) || 0;
  usage.set(type, n + 1);
  return choices[n % choices.length];
}
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const key = process.env.FISHAUDIO_API_KEY;
  if (!key) return res.status(500).json({ error: 'Fish Audio key not configured' });
  const type = String(req.body?.event || '').toUpperCase();
  if (!Object.hasOwn(lines, type)) return res.status(400).json({ error: 'Unsupported cricket event' });
  try {
    const response = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', model: 's2.1-pro' },
      body: JSON.stringify({ text: pick(type), reference_id: VOICE_ID, format: 'mp3', latency: 'normal' }),
      signal: AbortSignal.timeout(25000)
    });
    if (!response.ok) return res.status(502).json({ error: 'Commentary generation unavailable' });
    const audio = Buffer.from(await response.arrayBuffer());
    if (!audio.length) return res.status(502).json({ error: 'Empty commentary audio' });
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(audio);
  } catch { return res.status(502).json({ error: 'Commentary request failed' }); }
}
