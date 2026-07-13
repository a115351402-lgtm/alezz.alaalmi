// ═══════════════════════════════════════════════════════════
// Auction cars feed — Hyundai Glovis (Autobell Global) + Lotte
// Auto Global. Neither auction house offers a public API, so this
// reads their PUBLIC export-facing listing pages server-side and
// normalises the result. Edge-cached 6h, so upstream traffic is a
// handful of requests per day.
//
//   /api/auctions          → { updated, source, cars: [...] }
//   /api/auctions?diag=1   → fetch statuses + response snippets
//                            (used to tune the extractors against
//                             the real markup via Vercel logs)
//
// On any failure the bundled auctions.json is served instead, so
// the auctions section never breaks.
// ═══════════════════════════════════════════════════════════

// Curated fallback, inlined so the function has zero file dependencies
// (a JSON import attribute broke the Vercel build → 404 on the route).
// Keep in sync with /auctions.json, which documents the schema.
const fallback = {
  updated: '2026-07-13',
  source: 'fallback',
  cars: [
    { house: 'glovis', title: 'جينيسس 2025', year: 2025, mileage_km: 1200, price_sar: 82000, est_dealer_price_sar: 98000, image: 'genesis_2025_black.webp', status: 'available' },
    { house: 'lotte', title: 'هونداي ازيرا 2025', year: 2025, mileage_km: 3200, price_sar: 95000, est_dealer_price_sar: 116000, image: 'hyundai_azera_2025_black.webp', status: 'hot' },
    { house: 'glovis', title: 'كيا كي 8', year: 2025, mileage_km: 4500, price_sar: 88000, est_dealer_price_sar: 104000, image: 'kia_k8_black.webp', status: 'ending' },
  ],
};

const KRW_TO_SAR = 0.0026; // approximate; prices are indicative anyway

const SOURCES = [
  {
    house: 'glovis',
    // Autobell Global — Glovis' public export platform
    urls: ['https://www.autobellglobal.com/car/list', 'https://www.autobellglobal.com/'],
  },
  {
    house: 'lotte',
    // Lotte Auto Global — Lotte's public export platform
    urls: ['https://www.lotte-autoglobal.net/car/list', 'https://www.lotte-autoglobal.net/'],
  },
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'text/html,application/json;q=0.9,*/*;q=0.8' },
    signal: AbortSignal.timeout(20000),
    redirect: 'follow',
  });
  const body = await res.text();
  return { status: res.status, type: res.headers.get('content-type') || '', body };
}

// Best-effort extractors. These are tuned iteratively against the
// real responses (see ?diag=1); until they match, we fall back.
function extractCars(house, body) {
  const cars = [];

  // 1) Embedded JSON (Nuxt/Next state or API payloads) — most reliable.
  // Arrays of flat objects first, then standalone objects.
  const jsonBlobs = [
    ...(body.match(/\[\s*\{[^\[\]]{80,60000}?\}\s*\]/g) || []),
    ...(body.match(/\{"[^"]{2,40}":[\s\S]{100,50000}?\}(?=\s*[;<,\]])/g) || []),
  ];
  for (const blob of jsonBlobs) {
    if (cars.length >= 12) break;
    if (!/price|model|vehicle|car/i.test(blob)) continue;
    try {
      const data = JSON.parse(blob);
      collectFromJson(data, house, cars);
    } catch (e) { /* not valid JSON — skip */ }
  }
  if (cars.length) return cars.slice(0, 12);

  // 2) Listing-card HTML pattern: <img …> near a title + price
  const cardRe = /<img[^>]+src="([^"]+)"[^>]*>[\s\S]{0,600}?(?:alt="([^"]{3,60})"|<(?:h\d|strong|p)[^>]*>([^<]{3,60})<)[\s\S]{0,400}?([\d,]{4,12})\s*(?:KRW|원|won)/gi;
  let m;
  while ((m = cardRe.exec(body)) && cars.length < 12) {
    const krw = Number((m[4] || '').replace(/,/g, ''));
    if (!krw || krw < 100000) continue;
    cars.push({
      house,
      title: (m[2] || m[3] || '').trim(),
      price_sar: Math.round(krw * KRW_TO_SAR / 100) * 100,
      image: absolutize(m[1], house),
      status: 'available',
    });
  }
  return cars;
}

function collectFromJson(node, house, out, depth) {
  depth = depth || 0;
  if (!node || depth > 6 || out.length >= 12) return;
  if (Array.isArray(node)) {
    for (const item of node) collectFromJson(item, house, out, depth + 1);
    return;
  }
  if (typeof node !== 'object') return;
  const title = node.modelName || node.carName || node.vehicleName || node.title || node.name;
  const price = node.price || node.startPrice || node.bidPrice || node.salePrice;
  const image = node.imageUrl || node.image || node.thumbUrl || node.photo || node.mainImage;
  if (title && price && Number(price) > 100000) {
    out.push({
      house,
      title: String(title).trim(),
      year: node.year || node.modelYear || undefined,
      mileage_km: node.mileage || node.km || undefined,
      price_sar: Math.round(Number(price) * KRW_TO_SAR / 100) * 100,
      image: image ? absolutize(String(image), house) : undefined,
      status: 'available',
    });
    return;
  }
  for (const key of Object.keys(node)) collectFromJson(node[key], house, out, depth + 1);
}

function absolutize(src, house) {
  if (/^https?:\/\//.test(src)) return src;
  const base = house === 'glovis' ? 'https://www.autobellglobal.com' : 'https://www.lotte-autoglobal.net';
  return src.startsWith('/') ? base + src : base + '/' + src;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const diag = req.query.diag === '1';
  const diagInfo = [];
  const cars = [];

  for (const source of SOURCES) {
    for (const url of source.urls) {
      try {
        const r = await fetchText(url);
        if (diag) {
          diagInfo.push({ url, status: r.status, type: r.type, snippet: r.body.slice(0, 600) });
          console.log('auctions diag:', url, r.status, r.type, r.body.slice(0, 400));
        }
        if (r.status !== 200) continue;
        const found = extractCars(source.house, r.body);
        if (found.length) { cars.push(...found); break; }
      } catch (err) {
        if (diag) diagInfo.push({ url, error: String(err && err.message) });
        console.error('auctions fetch failed:', url, err && err.message);
      }
    }
  }

  if (diag) {
    return res.status(200).json({ extracted: cars.length, cars: cars.slice(0, 4), fetches: diagInfo });
  }

  if (cars.length) {
    const seen = {};
    const unique = cars.filter((c) => {
      const key = c.title + '|' + c.price_sar;
      if (seen[key]) return false;
      seen[key] = 1;
      return true;
    });
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).json({ updated: new Date().toISOString().slice(0, 10), source: 'live', cars: unique.slice(0, 24) });
  }

  // Nothing extracted — serve the curated fallback (short cache so a
  // fixed extractor takes effect quickly)
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).json(fallback);
}
