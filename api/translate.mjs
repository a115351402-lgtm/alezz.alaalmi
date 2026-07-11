// ═══════════════════════════════════════════════════════════
// Free translation proxy (Google Translate unofficial gtx endpoint).
// Used to translate the English vehicle description to ar / ko.
//
//   /api/translate?tl=ar&q=<english text>
//
// Responses are cached on the Vercel edge for 7 days, so each
// vehicle description is translated upstream only once.
// On any upstream failure the frontend keeps the English text.
// ═══════════════════════════════════════════════════════════

const GOOGLE_URL = 'https://translate.googleapis.com/translate_a/single';

const ALLOWED_TL = { ar: 1, ko: 1 };
const MAX_TEXT = 9000;   // hard cap on input length
const SEGMENT = 1800;    // gtx endpoint rejects very long q values

// Split text into ≤SEGMENT chunks, preferring newline / sentence boundaries
function splitText(text) {
  const chunks = [];
  let rest = String(text);
  while (rest.length > SEGMENT) {
    const slice = rest.slice(0, SEGMENT);
    let cut = Math.max(slice.lastIndexOf('\n'), slice.lastIndexOf('. '));
    if (cut < SEGMENT / 2) cut = slice.lastIndexOf(' ');
    if (cut < SEGMENT / 2) cut = SEGMENT - 1;
    chunks.push(rest.slice(0, cut + 1));
    rest = rest.slice(cut + 1);
  }
  if (rest) chunks.push(rest);
  return chunks;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const tl = String(req.query.tl || 'ar').toLowerCase();
  const q = String(req.query.q || '');

  if (!ALLOWED_TL[tl]) return res.status(400).json({ error: 'Unsupported target language.' });
  if (!q.trim()) return res.status(400).json({ error: 'Missing q parameter.' });

  try {
    const chunks = splitText(q.slice(0, MAX_TEXT));
    const out = [];
    for (const chunk of chunks) {
      const url = `${GOOGLE_URL}?client=gtx&sl=en&tl=${tl}&dt=t&q=${encodeURIComponent(chunk)}`;
      const upstream = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(20000),
      });
      if (!upstream.ok) throw new Error('upstream ' + upstream.status);
      const data = await upstream.json();
      // gtx response: [[["translated","original",…], …], …]
      const seg = Array.isArray(data && data[0])
        ? data[0].map((p) => (p && p[0]) || '').join('')
        : '';
      if (!seg) throw new Error('empty translation');
      out.push(seg);
    }

    res.setHeader('Cache-Control', 's-maxage=604800, stale-while-revalidate=2592000');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({ text: out.join('') });
  } catch (err) {
    console.error('translate failed:', err && err.message);
    return res.status(502).json({ error: 'Translation service unavailable.' });
  }
}
