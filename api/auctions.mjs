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
    title: (maker + ' ' + model).trim() || String(item.carNm || '').trim(),
    year: Number(item.mnfYear || item.modelYear) || undefined,
    mileage_km: Number(item.drgMil) || undefined,
    price_sar: priceSar,
    est_dealer_price_sar: roundSar(priceSar * DEALER_MARKUP),
    // /dims/... is Lotte's own image proxy — resized webp, ~30KB a card
    image: item.imgPath1 ? IMG_BASE + item.imgPath1 + '/dims/format/webp/resize/480x!/quality/85' : undefined,
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

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
