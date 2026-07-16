// ═══════════════════════════════════════════════════════════
// Auction cars feed — LOTTE Auto Global (lotte-autoglobal.net).
//
// Lotte has no public API, but its export listing page is fed by
// an open JSON endpoint (the same one the page's own JS calls):
//
//   POST /by/buy/selectGdListAjax.do   (form-urlencoded)
//     pageIndex=1&perPage=12[&search_mcmpCd=<maker code>]
//
// It returns { paginationInfo, resultList: [...] } with prices in
// USD and image paths served from img.lotte-autoglobal.net (which
// also offers on-the-fly webp resizing via /dims/...).
//
//   /api/auctions                → { updated, source, cars: [...] }
//   /api/auctions?page=2
//   /api/auctions?make=genesis   → filter by maker
//   /api/auctions?id=<gdId>      → single car detail: all photos,
//                                  specs, options, inspection results
//                                  (parsed from the server-rendered
//                                  detail page /car/gd/BY/<gdId>/)
//   /api/auctions?insp=<gdId>    → proxies the official inspection
//                                  sheet image (damage/repair map) —
//                                  upstream serves it with a generic
//                                  content type, so we set image/jpeg
//   /api/auctions?diag=1         → upstream status + raw sample
//
// Edge-cached 6h. On any failure the bundled fallback below is
// served instead, so the auctions section never breaks.
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

const LIST_URL = 'https://www.lotte-autoglobal.net/by/buy/selectGdListAjax.do';
const IMG_BASE = 'https://img.lotte-autoglobal.net';
const DETAIL_BASE = 'https://www.lotte-autoglobal.net/car/gd/BY/';

const USD_TO_SAR = 3.75;          // SAR is pegged to USD
const DEALER_MARKUP = 1.2;        // estimated Saudi showroom price vs auction

// Maker codes from the site's own filter form (?make=<key>)
const MAKER_CODES = {
  hyundai: '1052', kia: '1053', genesis: '1072', bmw: '1012',
  benz: '1014', mercedes: '1014', audi: '1018', volkswagen: '1017',
  volvo: '1039', porsche: '1040', ford: '1035', ssangyong: '1056',
  chevrolet: '1054', renault: '1055', tesla: '1068', toyota: '1004',
  lexus: '1051', honda: '1005', nissan: '1009', jeep: '1073',
  landrover: '1059', mini: '10001', jaguar: '1028', peugeot: '1036',
  lincoln: '1045', infiniti: '1064', cadillac: '1022',
};

// Arabic display names — makers as returned in mcmpNm
const MAKER_AR = {
  'HYUNDAI': 'هيونداي', 'KIA': 'كيا', 'GENESIS': 'جينيسيس',
  'BENZ': 'مرسيدس', 'BMW': 'بي إم دبليو', 'AUDI': 'أودي',
  'VOLKSWAGEN': 'فولكس واجن', 'VOLVO': 'فولفو', 'FORD': 'فورد',
  'CHEVROLET': 'شفروليه', 'CHEVROLET(GM)': 'شفروليه',
  'SSANGYONG': 'سانغ يونغ', 'RENAULT KOREA': 'رينو', 'RENAULT': 'رينو',
  'PORSCHE': 'بورشه', 'LEXUS': 'لكزس', 'TOYOTA': 'تويوتا',
  'HONDA': 'هوندا', 'NISSAN': 'نيسان', 'JEEP': 'جيب', 'TESLA': 'تسلا',
  'LAND ROVER': 'لاند روفر', 'MINI': 'ميني', 'PEUGEOT': 'بيجو',
  'JAGUAR': 'جاغوار', 'LINCOLN': 'لينكولن', 'INFINITI': 'إنفينيتي',
  'CADILLAC': 'كاديلاك',
};

// Arabic model names for the Korean models that dominate the feed;
// anything unmapped keeps its English name (renders fine in the card)
const MODEL_AR = {
  'TUCSON': 'توسان', 'SONATA': 'سوناتا', 'AVANTE': 'أفانتي',
  'GRANDEUR': 'جراندير', 'SANTA FE': 'سانتافي', 'PALISADE': 'باليسيد',
  'CASPER': 'كاسبر', 'KONA': 'كونا', 'VENUE': 'فينيو', 'IONIQ': 'أيونيك',
  'SORENTO': 'سورينتو', 'SPORTAGE': 'سبورتاج', 'CARNIVAL': 'كرنفال',
  'MORNING': 'مورنينج', 'RAY': 'راي', 'SELTOS': 'سيلتوس', 'NIRO': 'نيرو',
  'STINGER': 'ستينجر', 'K3': 'كي 3', 'K5': 'كي 5', 'K7': 'كي 7',
  'K8': 'كي 8', 'K9': 'كي 9', 'EV6': 'إي في 6', 'EV9': 'إي في 9',
  'G70': 'جي 70', 'G80': 'جي 80', 'G90': 'جي 90',
  'GV60': 'جي في 60', 'GV70': 'جي في 70', 'GV80': 'جي في 80',
};

// sortOpt values from the site's own sort dropdown (?sort=<key>)
const SORT_OPTS = {
  recent: 'RecentAdded', price_asc: 'LowPrice', price_desc: 'HighPrice',
  newest: 'New', oldest: 'Old',
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

function roundSar(n) {
  return Math.round(n / 100) * 100;
}

function toCar(item) {
  const usd = Number(item.dcCarAmt || item.carAmt || item.searchCarAmt);
  if (!usd || usd <= 0) return null;

  const makerEn = String(item.mcmpNm || '').trim().toUpperCase();
  const modelEn = String(item.modelNm || '').trim().toUpperCase();
  const maker = MAKER_AR[makerEn] || item.mcmpNm || '';
  const model = MODEL_AR[modelEn] || item.modelNm || '';
  const priceSar = roundSar(usd * USD_TO_SAR);

  return {
    house: 'lotte',
    id: item.gdId || undefined,
    title: (maker + ' ' + model).trim() || String(item.carNm || '').trim(),
    year: Number(item.mnfYear || item.modelYear) || undefined,
    mileage_km: Number(item.drgMil) || undefined,
    price_sar: priceSar,
    est_dealer_price_sar: roundSar(priceSar * DEALER_MARKUP),
    // /dims/... is Lotte's own image proxy — 800px covers 3-col cards
    // on high-DPI screens without going blurry
    image: item.imgPath1 ? IMG_BASE + item.imgPath1 + '/dims/format/webp/resize/800x!/quality/88' : undefined,
    status: item.hotYn === 'Y' || Number(item.interestCnt) >= 3 ? 'hot' : 'available',
    // Extra context the current cards don't use yet, but costs nothing
    detail_url: item.gdId ? DETAIL_BASE + item.gdId + '/' : undefined,
    fuel: item.gasSeNm || undefined,
    body: item.mocaCdNm || undefined,
    inspected: item.inspYn === 'Y' || undefined,
  };
}

async function fetchLotte(query) {
  const page = Math.max(1, Number(query.page) || 1);
  const perPage = Math.min(24, Math.max(1, Number(query.page_size || query.limit) || 12));

  const form = new URLSearchParams({
    pageIndex: String(page),
    perPage: String(perPage),
    // sortVal must be PRESENT (even empty) or the server ignores
    // sortOpt and returns the oldest inventory first
    sortVal: '',
    sortOpt: SORT_OPTS[String(query.sort || '').toLowerCase()] || 'RecentAdded',
  });
  const makerCd = MAKER_CODES[String(query.make || '').toLowerCase().replace(/[\s_-]/g, '')];
  if (makerCd) form.set('search_mcmpCd', makerCd);
  if (/^\d{4}$/.test(query.year_min || '')) form.set('search_mnfYearSt', query.year_min);
  if (/^\d{4}$/.test(query.year_max || '')) form.set('search_mnfYearEd', query.year_max);

  const res = await fetch(LIST_URL, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: form.toString(),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) throw new Error('lotte upstream ' + res.status);
  const data = await res.json();
  const list = Array.isArray(data.resultList) ? data.resultList : [];
  return {
    total: Number(data.paginationInfo && data.paginationInfo.totalRecordCount) || list.length,
    cars: list.map(toCar).filter(Boolean),
    raw: list,
  };
}

// ── Detail extraction ────────────────────────────────────────
// The detail page is server-rendered. Spec rows look like
//   <th>label</th><!-- 제조사 --> <td>value</td>
// The Korean comments are stable across locales, so they are used
// as canonical keys.
const KO_KEYS = {
  '제조사': 'maker', '모델': 'model', '차종': 'body', '연식': 'year',
  '차대번호': 'vin', '연료': 'fuel', '주행거리': 'mileage_km',
  '배기량': 'displacement_cc', '변속기': 'transmission',
  '구동방식': 'drive', '인승': 'seats', '색상': 'color',
  '평가점': 'grade', '엔진': 'engine', '동력전달': 'powertrain',
  '미션': 'gearbox', '공조': 'ac', '제동': 'brakes',
  '조항': 'steering', '전기': 'electrics', '특이사항': 'notes',
};

function arabicTitle(makerEn, modelEn) {
  const maker = MAKER_AR[String(makerEn || '').trim().toUpperCase()] || makerEn || '';
  const modelUp = String(modelEn || '').toUpperCase();
  // detail model names carry prefixes ("THE ALL NEW TUCSON") — find a known token
  let model = '';
  for (const key of Object.keys(MODEL_AR).sort((a, b) => b.length - a.length)) {
    if (modelUp.includes(key)) { model = MODEL_AR[key]; break; }
  }
  return (maker + ' ' + (model || modelEn || '')).trim();
}

// exported for reuse by api/_lib/sources.mjs (vehicle snapshots)
export async function fetchLotteDetail(gdId) {
  const res = await fetch(DETAIL_BASE + encodeURIComponent(gdId) + '/', {
    headers: { 'User-Agent': UA, 'Accept': 'text/html' },
    signal: AbortSignal.timeout(20000),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('lotte detail ' + res.status);
  const html = await res.text();

  // Specs + evaluation rows (both tables share the same markup)
  const fields = {};
  const rowRe = /<th>([^<]*)<\/th>\s*(?:<!--\s*([^>]*?)\s*-->)?\s*<td[^>]*>([\s\S]*?)<\/td>/g;
  let m;
  while ((m = rowRe.exec(html))) {
    const key = KO_KEYS[(m[2] || '').trim()];
    if (!key || fields[key] !== undefined) continue;
    fields[key] = m[3].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  if (!fields.maker && !fields.model) throw new Error('detail markup not recognized');

  // Options: <span title="Sun Roof" class="cate-2 is-disabled">
  // (markup repeats for the desktop and mobile layouts — dedupe)
  const optMap = {};
  const optRe = /<span title="([^"]+)" class="cate-\d+( is-disabled)?\s*"/g;
  while ((m = optRe.exec(html))) optMap[m[1]] = optMap[m[1]] || !m[2];
  const options = Object.keys(optMap).map((name) => ({ name, enabled: optMap[name] }));

  // Price in USD (booking summary is server-rendered with the value)
  const priceM = html.match(/id="bkRq_dcCarAmt"[^>]*>\s*([\d,]+)\s*</)
    || html.match(/<span class="unit">USD<\/span>\s*<strong class="commaFmt">([\d,]+)/);
  const usd = priceM ? Number(priceM[1].replace(/,/g, '')) : 0;
  const priceSar = usd ? roundSar(usd * USD_TO_SAR) : undefined;

  // Gallery: every /goods/ image sharing the og:image directory
  // (excludes "similar cars" thumbnails further down the page)
  const ogM = html.match(/property="og:image" content="https?:\/\/[^/"]+(\/goods\/[^"]+?\.(?:jpe?g|png|webp))/i);
  const images = [];
  const thumbs = [];
  if (ogM) {
    const dir = ogM[1].replace(/\/{2,}/g, '/').replace(/\/[^/]*$/, '/');
    const seen = {};
    let im;
    const imgRe = /img\.lotte-autoglobal\.net(\/goods\/[^"'\s)]+?\.(?:jpe?g|png|webp))/gi;
    while ((im = imgRe.exec(html)) && images.length < 40) {
      const path = im[1].replace(/\/{2,}/g, '/');
      if (!path.startsWith(dir) || seen[path]) continue;
      seen[path] = 1;
      images.push(IMG_BASE + path + '/dims/format/webp/resize/1600x!/quality/90');
      thumbs.push(IMG_BASE + path + '/dims/format/webp/resize/360x!/quality/80');
    }
  }

  // Official inspection sheet (damage/repair diagram) — not every car
  // has one; the frontend hides the block if the proxy 404s
  const hasInsp = html.includes('loadMode=inspFile');

  const titleEn = (html.match(/property="og:title" content="Buy Used ([^"]+?)\s*- LOTTE AUTOGLOBAL"/) || [])[1]
    || [fields.year, fields.maker, fields.model].filter(Boolean).join(' ');

  return {
    house: 'lotte',
    id: String(gdId),
    title: arabicTitle(fields.maker, fields.model),
    title_en: titleEn,
    year: Number(fields.year) || undefined,
    mileage_km: Number(String(fields.mileage_km || '').replace(/[^\d]/g, '')) || undefined,
    price_sar: priceSar,
    est_dealer_price_sar: priceSar ? roundSar(priceSar * DEALER_MARKUP) : undefined,
    maker: fields.maker,
    model: fields.model,
    body: fields.body,
    fuel: fields.fuel,
    transmission: fields.transmission,
    drive: fields.drive,
    seats: Number(fields.seats) || undefined,
    color: fields.color,
    displacement_cc: Number(String(fields.displacement_cc || '').replace(/[^\d]/g, '')) || undefined,
    vin: fields.vin,
    images,
    thumbs,
    inspection_sheet: hasInsp ? '/api/auctions?insp=' + gdId : undefined,
    options,
    evaluation: {
      grade: fields.grade, engine: fields.engine, powertrain: fields.powertrain,
      gearbox: fields.gearbox, ac: fields.ac, brakes: fields.brakes,
      steering: fields.steering, electrics: fields.electrics, notes: fields.notes,
    },
    detail_url: DETAIL_BASE + gdId + '/',
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Inspection-sheet image proxy (upstream sends octet-stream, which
  // browsers may refuse to render — re-serve it as image/jpeg)
  if (req.query.insp) {
    try {
      const gdId = String(req.query.insp).replace(/[^\d]/g, '');
      const up = await fetch(
        'https://www.lotte-autoglobal.net/co/comnFile/doLoadImage.do?loadMode=inspFile&gdId=' + gdId,
        { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) },
      );
      const buf = Buffer.from(await up.arrayBuffer());
      // a missing sheet comes back as a tiny placeholder / error body
      if (!up.ok || buf.length < 2000 || buf[0] !== 0xff) {
        return res.status(404).json({ error: 'No inspection sheet for this car.' });
      }
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
      return res.status(200).send(buf);
    } catch (err) {
      console.error('inspection sheet failed:', err && err.message);
      return res.status(404).json({ error: 'No inspection sheet for this car.' });
    }
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // Single-car detail mode
  if (req.query.id) {
    try {
      const car = await fetchLotteDetail(String(req.query.id).replace(/[^\d]/g, ''));
      res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
      return res.status(200).json({ source: 'lotte-autoglobal', car });
    } catch (err) {
      console.error('auction detail failed:', err && err.message);
      return res.status(404).json({ error: 'Car not found or no longer listed.' });
    }
  }

  try {
    const result = await fetchLotte(req.query || {});

    if (req.query.diag === '1') {
      return res.status(200).json({
        upstream: LIST_URL,
        total: result.total,
        extracted: result.cars.length,
        cars: result.cars.slice(0, 2),
        raw_sample: result.raw.slice(0, 1),
      });
    }

    if (result.cars.length) {
      res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
      return res.status(200).json({
        updated: new Date().toISOString().slice(0, 10),
        source: 'lotte-autoglobal',
        total: result.total,
        cars: result.cars,
      });
    }
  } catch (err) {
    console.error('auctions fetch failed:', err && err.message);
    if (req.query.diag === '1') {
      return res.status(200).json({ upstream: LIST_URL, error: String(err && err.message) });
    }
  }

  // Upstream down or empty — serve the curated fallback (short cache
  // so recovery takes effect quickly)
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).json(fallback);
}
