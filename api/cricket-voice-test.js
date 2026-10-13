const VOICE_ID = 'bb5da5dbfad34bbeb2032098d15babe2';
const SAMPLE = 'Oye hoye! Kya zabardast chhakka maara hai! Ball seedha stadium ke baahar!';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const key = process.env.FISHAUDIO_API_KEY || process.env.FISH_AUDIO_API_KEY;
  if (!key) return res.status(500).json({ error: 'Fish Audio API key missing in Vercel environment' });
  const started = Date.now();
  try {
    const response = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', model: 's2.1-pro' },
      body: JSON.stringify({ text: SAMPLE, reference_id: VOICE_ID, format: 'mp3', latency: 'normal' }),
      signal: AbortSignal.timeout(25000)
    });
    if (!response.ok) {
      const details = (await response.text()).slice(0, 350);
      return res.status(response.status).json({ error: `Fish Audio returned HTTP ${response.status}`, details });
    }
    const audio = Buffer.from(await response.arrayBuffer());
    if (!audio.length) return res.status(502).json({ error: 'Fish Audio returned empty audio' });
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Voice-Latency-Ms', String(Date.now() - started));
    return res.status(200).send(audio);
  } catch (error) {
    return res.status(502).json({ error: error.name === 'TimeoutError' ? 'Fish Audio request timed out' : 'Fish Audio request failed' });
  }
}
