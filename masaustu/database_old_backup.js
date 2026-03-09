const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const config = {
  server: '10.35.20.15\\SQLSRV',
  database: 'SNCG',
  user: 'ozgur.copkur',
  password: 'Oz2025!!',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool = null;
let columnCache = null;
let rateCache = { ts: 0, ttl: 10 * 60 * 1000, rates: null };

// Date filter: SQL will fetch data from February 2026 onwards
// January 2026 data comes from static file
const DATE_FILTER = '2026-02-01';

// Load static January 2026 data
let staticOcakData = [];
try {
  // Veri dosyasını birden fazla konumda ara
  let staticDataPath = path.join(__dirname, 'ocak_2026_data.json');
  
  // __dirname'de bulamazsa, process.cwd()'de ara
  if (!fs.existsSync(staticDataPath)) {
    staticDataPath = path.join(process.cwd(), 'ocak_2026_data.json');
  }
  
  // Hala bulamazsa, uygulamanın çalıştığı dizinde ara
  if (!fs.existsSync(staticDataPath)) {
    staticDataPath = path.join(process.cwd(), '..', 'Satin Alma Rapor', 'ocak_2026_data.json');
  }
  
  if (fs.existsSync(staticDataPath)) {
    const staticJson = JSON.parse(fs.readFileSync(staticDataPath, 'utf8'));
    // Hem düz dizi hem { records: [] } formatını destekle (mobil ile aynı)
    staticOcakData = Array.isArray(staticJson) ? staticJson : (staticJson.records || []);
    console.log(`Loaded ${staticOcakData.length} static January 2026 records from: ${staticDataPath}`);
  } else {
    console.warn('Static data file not found in any expected location');
  }
} catch (e) {
  console.error('Error loading static January data:', e.message);
}

// Deduplicate static data using same key as API/mobile
// (ROW_NUMBER PARTITION BY SiparisNo, SiparisMalzeme, Miktar, BirimFiyat)
if (staticOcakData.length > 0) {
  const beforeCount = staticOcakData.length;
  const seen = new Set();
  const deduped = [];
  for (const r of staticOcakData) {
    const sipNo = r.SIPARIS_NO || r['SİPARİŞ NUMARASI'] || '';
    const sipMalzeme = r.SIPARIS_MALZEME || r['SİPARİŞ MALZEME'] || '';
    const miktar = r.MIKTAR || r['MİKTAR'] || '';
    const birimFiyat = r.BIRIM_FIYAT || r['BİRİM FİYAT'] || '';
    const key = `${sipNo}|${sipMalzeme}|${miktar}|${birimFiyat}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(r);
    }
  }
  staticOcakData = deduped;
  console.log(`Deduped static data: ${beforeCount} -> ${staticOcakData.length} records`);
}

// Map static data column names to match SQL column names
function mapStaticRecordToSqlFormat(record) {
  return {
    TALEP_NO: record.TALEP_NO,
    SIPARIS_NO: record.SIPARIS_NO,
    TESLIM_TARIHI: record.TESLIM_TARIHI,
    TESLIM_EVRAK_NO: record.TESLIM_EVRAK_NO,
    CARI_UNVANI: record.CARI_UNVANI,
    TOPLAM: record.TOPLAM,
    SIPARIS_TARIHI: record.SIPARIS_TARIHI,
    TALEP_EDEN: record.TALEP_EDEN,
    MASRAF_MERKEZI: record.MASRAF_MERKEZI,
    PARA_BIRIMI: record.PARA_BIRIMI,
    TUR: record.TUR,
    TALEP_TARIHI: record.TALEP_TARIHI,
    ISYERI: record.ISYERI,
    SIPARIS_ONAYLAYAN: record.SIPARIS_ONAYLAYAN,
    ODEME_VADESI: record.ODEME_VADESI,
    BIRIM_FIYAT: record.BIRIM_FIYAT,
    MIKTAR: record.MIKTAR,
    SIPARIS_MALZEME: record.SIPARIS_MALZEME,
    AMBAR: record.AMBAR,
    BIRIM: record.BIRIM,
    FATURA_NO: record.FATURA_NO,
    FATURAYI_KAYDEDEN: record.FATURAYI_KAYDEDEN
  };
}

// TİRE fabrikasını tüm analizlerde hariç tut (mobil ile aynı davranış)
const EXCLUDED_FACTORIES = ['TİRE'];

function normalizeAmbarName(ambar) {
  if (!ambar) return '';
  return ambar.toLocaleUpperCase('tr-TR');
}

// Helper function to calculate statistics from static data
function getStaticStats(ambarFilter) {
  let filteredData = staticOcakData.filter(r => r.TUR && r.TUR !== '');
  
  // TİRE'yi hariç tut (mobil ile aynı)
  filteredData = filteredData.filter(r => !r.AMBAR || !EXCLUDED_FACTORIES.includes(normalizeAmbarName(r.AMBAR)));
  
  if (ambarFilter && ambarFilter !== 'all') {
    const normalizedFilter = normalizeAmbarName(ambarFilter);
    filteredData = filteredData.filter(r => normalizeAmbarName(r.AMBAR) === normalizedFilter);
  }
  
  const uniqueTalep = new Set(filteredData.map(r => r.TALEP_NO).filter(Boolean));
  const uniqueSiparis = new Set(filteredData.map(r => r.SIPARIS_NO).filter(Boolean));
  const uniqueTedarikci = new Set(filteredData.map(r => r.CARI_UNVANI).filter(Boolean));
  const uniqueTalepEden = new Set(filteredData.map(r => r.TALEP_EDEN).filter(Boolean));
  
  // Check delivery status per siparis (FATURAYI_KAYDEDEN dolu ise teslim edilmiş)
  const siparisDeliveryStatus = new Map();
  for (const r of filteredData) {
    if (!r.SIPARIS_NO) continue;
    const hasDelivery = r.FATURAYI_KAYDEDEN && r.FATURAYI_KAYDEDEN !== '';
    if (!siparisDeliveryStatus.has(r.SIPARIS_NO) || hasDelivery) {
      siparisDeliveryStatus.set(r.SIPARIS_NO, hasDelivery || siparisDeliveryStatus.get(r.SIPARIS_NO) || false);
    }
  }
  
  let teslimEdilen = 0;
  let bekleyen = 0;
  for (const hasDelivery of siparisDeliveryStatus.values()) {
    if (hasDelivery) teslimEdilen++;
    else bekleyen++;
  }
  
  // Calculate totals per currency
  const currencyTotals = new Map();
  for (const r of filteredData) {
    const cur = r.PARA_BIRIMI || 'TL';
    const amount = Number(r.TOPLAM) || 0;
    currencyTotals.set(cur, (currencyTotals.get(cur) || 0) + amount);
  }
  
  // Group by various fields
  const groupBy = (field) => {
    const groups = new Map();
    for (const r of filteredData) {
      const key = r[field] || 'Belirsiz';
      if (!groups.has(key)) {
        groups.set(key, { count: 0, siparisSet: new Set(), talepSet: new Set(), toplam: 0, paraBirimi: new Map() });
      }
      const g = groups.get(key);
      g.count++;
      if (r.SIPARIS_NO) g.siparisSet.add(r.SIPARIS_NO);
      if (r.TALEP_NO) g.talepSet.add(r.TALEP_NO);
      const cur = r.PARA_BIRIMI || 'TL';
      const amount = Number(r.TOPLAM) || 0;
      g.paraBirimi.set(cur, (g.paraBirimi.get(cur) || 0) + amount);
      g.toplam += amount;
    }
    return groups;
  };
  
  // Monthly trend
  const monthlyGroups = new Map();
  for (const r of filteredData) {
    if (!r.SIPARIS_TARIHI) continue;
    const date = new Date(r.SIPARIS_TARIHI);
    const ay = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyGroups.has(ay)) {
      monthlyGroups.set(ay, { siparisSet: new Set(), toplam: 0, paraBirimi: new Map() });
    }
    const g = monthlyGroups.get(ay);
    if (r.SIPARIS_NO) g.siparisSet.add(r.SIPARIS_NO);
    const cur = r.PARA_BIRIMI || 'TL';
    const amount = Number(r.TOPLAM) || 0;
    g.paraBirimi.set(cur, (g.paraBirimi.get(cur) || 0) + amount);
  }
  
  // Calculate delivery time from static data
  const deliveryTimes = [];
  for (const r of filteredData) {
    if (r.SIPARIS_TARIHI && r.TESLIM_TARIHI) {
      const siparisTarihi = new Date(r.SIPARIS_TARIHI);
      const teslimTarihi = new Date(r.TESLIM_TARIHI);
      if (!isNaN(siparisTarihi) && !isNaN(teslimTarihi)) {
        const diffDays = Math.round((teslimTarihi - siparisTarihi) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays < 365) { // Reasonable range
          deliveryTimes.push(diffDays);
        }
      }
    }
  }
  
  return {
    totalTalep: uniqueTalep.size,
    totalSiparis: uniqueSiparis.size,
    totalTeslimat: teslimEdilen,
    bekleyenTeslimat: bekleyen,
    totalTedarikci: uniqueTedarikci.size,
    totalTalepEden: uniqueTalepEden.size,
    currencyTotals,
    talepEdenGroups: groupBy('TALEP_EDEN'),
    masrafMerkeziGroups: groupBy('MASRAF_MERKEZI'),
    tedarikciGroups: groupBy('CARI_UNVANI'),
    turGroups: groupBy('TUR'),
    ambarGroups: groupBy('AMBAR'),
    isyeriGroups: groupBy('ISYERI'),
    onaylayanGroups: groupBy('SIPARIS_ONAYLAYAN'),
    odemeVadesiGroups: groupBy('ODEME_VADESI'),
    paraBirimiGroups: groupBy('PARA_BIRIMI'),
    monthlyGroups,
    records: filteredData,
    deliveryTimes: deliveryTimes,
    avgDeliveryTime: deliveryTimes.length > 0 ? Math.round(deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length) : 0,
    minDeliveryTime: deliveryTimes.length > 0 ? Math.min(...deliveryTimes) : 0,
    maxDeliveryTime: deliveryTimes.length > 0 ? Math.max(...deliveryTimes) : 0
  };
}

// Merge static and SQL stats
function mergeGroupStats(staticGroups, sqlResults, keyField, rates) {
  const merged = new Map();
  
  // Add static data
  for (const [key, data] of staticGroups) {
    let totalTRY = 0;
    for (const [cur, amount] of data.paraBirimi) {
      const normCur = normalizeCurrencyKeySync(cur);
      if (normCur === 'TRY') {
        totalTRY += amount;
      } else {
        const ratePerTRY = rates[normCur];
        if (ratePerTRY && ratePerTRY !== 0) {
          totalTRY += amount * (1 / ratePerTRY);
        }
      }
    }
    merged.set(key, {
      siparisAdedi: data.siparisSet.size,
      talepAdedi: data.talepSet.size,
      kayitAdedi: data.count || 0,
      toplamTutar: totalTRY
    });
  }
  
  // Add SQL data
  for (const row of sqlResults) {
    const key = row[keyField] || 'Belirsiz';
    const existing = merged.get(key) || { siparisAdedi: 0, talepAdedi: 0, kayitAdedi: 0, toplamTutar: 0 };
    existing.siparisAdedi += Number(row.siparisAdedi) || 0;
    existing.talepAdedi += Number(row.talepAdedi || row.kayitAdedi) || 0;
    existing.kayitAdedi += Number(row.kayitAdedi || row.talepAdedi) || 0;
    existing.toplamTutar += Number(row.toplamTutar) || 0;
    merged.set(key, existing);
  }
  
  // Convert to array and sort
  return Array.from(merged.entries())
    .map(([key, data]) => ({ [keyField]: key, ...data }))
    .sort((a, b) => b.toplamTutar - a.toplamTutar);
}

// Sync version of normalizeCurrencyKey for use in non-async contexts
function normalizeCurrencyKeySync(s) {
  if (!s) return 'TRY';
  let t = String(s).trim().toUpperCase();
  if (t === 'TL' || t === '₺' || t === 'TRY' || t === 'TUR') return 'TRY';
  t = t.replace(/[^A-Z]/g, '');
  return t || 'TRY';
}

async function getConnection() {
  if (!pool) {
    pool = await sql.connect(config);
  }
  return pool;
}

async function getColumnNames() {
  if (columnCache) return columnCache;
  const conn = await getConnection();
  const result = await conn.request().query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'YLZ_TALEP_SIPARIS' ORDER BY ORDINAL_POSITION"
  );
  const cols = result.recordset.map(r => r.COLUMN_NAME);
  console.log('All columns from DB:', cols);

  const wrap = (s) => '[' + String(s || '').replace(/]/g, ']]') + ']';

  // normalize helper: remove diacritics and non-letters, uppercase
  const normalize = (s) => {
    if (!s) return '';
    try {
      return s.toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^A-Za-z0-9 ]/g, '').toUpperCase();
    } catch (e) {
      // fallback for environments without Unicode property escapes
      return s.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 ]/g, '').toUpperCase();
    }
  };

  const findByCandidates = (candidates) => {
    for (const cand of candidates) {
      const nc = normalize(cand);
      const found = cols.find(c => normalize(c).includes(nc));
      if (found) return found;
    }
    return null;
  };

  // find important columns robustly
  const foundToplam = findByCandidates(['TOPLAM', 'TUTAR']);
  const foundPara = findByCandidates(['PARA BIRIMI', 'PARA_BIRIMI', 'PARA']);
  const foundSiparisTarihi = findByCandidates(['SIPARIS TARIHI', 'SIPARIS_TARIHI', 'SIPARIS TARİHİ']);
  const foundTalepTarihi = findByCandidates(['TALEP TARIHI', 'TALEP_TARIHI', 'TALEP TARİHİ']);

  if (!foundToplam || !foundPara || !foundSiparisTarihi || !foundTalepTarihi) {
    console.error('Required columns not found. Available columns:', cols);
    throw new Error('Required columns missing. Make sure table YLZ_TALEP_SIPARIS contains columns for TOPLAM, PARA BIRIMI, SIPARIS TARİHİ and TALEP TARİHİ. Found: ' + cols.join(', '));
  }

  columnCache = {
    TALEP_NO: findByCandidates(['TALEP NUMARASI','TALEP_NO','TALEP']) || 'TALEP NUMARASI',
    SIPARIS_NO: findByCandidates(['SIPARIS NUMARASI','SIPARIS_NO','SIPARIS']) || 'SIPARIS NUMARASI',
    TESLIM_TARIHI: findByCandidates(['TESLIM TARIHI','TESLIM_TARIHI','TESLİM TARİHİ']) || 'TESLİM TARİHİ',
    TESLIM_EVRAK_NO: findByCandidates(['TESLIM EVRAK NO','TESLIM_EVRAK_NO','TESLIM EVRAK']) || 'TESLİM EVRAK NO',
    CARI_UNVANI: findByCandidates(['CARI UNVANI','CARİ ÜNVANI','CARI_UNVANI']) || 'CARİ UNVANI',
    TOPLAM: foundToplam,
    SIPARIS_TARIHI: foundSiparisTarihi,
    TALEP_EDEN: findByCandidates(['TALEP EDEN','TALEP_EDEN']) || 'TALEP EDEN',
    MASRAF_MERKEZI: findByCandidates(['MASRAF MERKEZI','MASRAF_MERKEZI']) || 'MASRAF MERKEZİ',
    PARA_BIRIMI: foundPara,
    TUR: findByCandidates(['TUR','TÜR']) || 'TÜR',
    TALEP_TARIHI: foundTalepTarihi,
    ISYERI: findByCandidates(['ISYERI','İŞ YERİ','IS YERI']) || 'İŞ YERİ',
    SIPARIS_ONAYLAYAN: findByCandidates(['SIPARIS ONAYLAYAN','SIPARIS_ONAYLAYAN']) || 'SİPARİŞ ONAYLAYAN',
    ODEME_VADESI: findByCandidates(['ODEME VADESI','ÖDEME VADESİ','ODEME_VADESI']) || 'ÖDEME VADESİ',
    BIRIM_FIYAT: findByCandidates(['BIRIM FIYAT','BIRIM_FIYAT','BİRİM FİYAT']) || 'BİRİM FİYAT',
    MIKTAR: findByCandidates(['MIKTAR','MİKTAR']) || 'MIKTAR',
    SIPARIS_MALZEME: findByCandidates(['SIPARIS MALZEME','SIPARIS_MALZEME']) || 'SİPARİŞ MALZEME',
    AMBAR: findByCandidates(['AMBAR']) || 'AMBAR',
    BIRIM: findByCandidates(['BIRIM','BİRİM']) || 'BİRİM',
    FATURA_NO: findByCandidates(['FATURA NO','FATURA_NO','FATURA']) || 'FATURA NO',
    FATURAYI_KAYDEDEN: findByCandidates(['FATURAYI KAYDEDEN','FATURA KAYDEDEN','FATURAYI_KAYDEDEN']) || 'FATURAYI KAYDEDEN'
  };

  console.log('Column mapping:', columnCache);
  return columnCache;
}

// helper to wrap identifier safely
function q(col) {
  if (!col) throw new Error('Missing column name for query');
  return '[' + String(col).replace(/]/g, ']]') + ']';
}

// Helper: wrap SQL query with CTE that deduplicates YLZ_TALEP_SIPARIS rows.
// The database view has LEFT JOINs causing fan-out (duplicate rows per siparis).
// This uses ROW_NUMBER() OVER PARTITION BY the same composite key as the API/mobile.
function withDedup(queryStr, C) {
  const cte = `WITH _src AS (SELECT * FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY ${q(C.SIPARIS_NO)}, ${q(C.SIPARIS_MALZEME)}, ${q(C.MIKTAR)}, ${q(C.BIRIM_FIYAT)} ORDER BY (SELECT NULL)) as _rn FROM YLZ_TALEP_SIPARIS) _d WHERE _d._rn = 1) `;
  return cte + queryStr.replace(/YLZ_TALEP_SIPARIS/g, '_src');
}

// Export column names for frontend
async function getColumnMapping() {
  return await getColumnNames();
}

async function executeQuery(query) {
  const conn = await getConnection();
  const result = await conn.request().query(query);
  return result.recordset;
}

async function getAllData() {
  const C = await getColumnNames();
  const selectFields = Object.keys(C).map(key => q(C[key]) + ' AS ' + key).join(', ');
  const query = `SELECT ${selectFields} FROM YLZ_TALEP_SIPARIS WHERE ${q(C.SIPARIS_TARIHI)} >= '${DATE_FILTER}'`;
  // exclude rows where TÜR is null/empty
  const turFilter = ` AND (${q(C.TUR)} IS NOT NULL AND ${q(C.TUR)} <> '')`;
  const queryWithTur = withDedup(query + turFilter, C);
  const sqlData = await executeQuery(queryWithTur);
  
  // Combine static January data with SQL data (February onwards)
  const staticMapped = staticOcakData
    .filter(r => r.TUR && r.TUR !== '') // exclude records where TÜR is null/empty
    .map(mapStaticRecordToSqlFormat);
  const data = [...staticMapped, ...sqlData];
  
  console.log(`Combined data: ${staticMapped.length} static + ${sqlData.length} SQL = ${data.length} total`);
  
  // try to attach per-row converted TRY amounts; if rates unavailable, TOPLAM_TRY will be null
  try {
    const rates = await fetchLatestRates();
    for (const row of data) {
      const rawAmount = Number(row['TOPLAM']) || 0;
      const paraRaw = row['PARA_BIRIMI'];
      const para = normalizeCurrencyKey(paraRaw);
      if (para === 'TRY') {
        row['TOPLAM_TRY'] = rawAmount;
      } else {
        const ratePerTRY = rates[para];
        if (ratePerTRY && ratePerTRY !== 0) {
          const curToTry = 1 / ratePerTRY;
          row['TOPLAM_TRY'] = rawAmount * curToTry;
        } else {
          row['TOPLAM_TRY'] = null;
        }
      }
    }
  } catch (e) {
    console.error('getAllData conversion error:', e && e.message ? e.message : e);
  }

  return { data, columns: Object.keys(C) };
}

async function getIsyeriList() {
  const C = await getColumnNames();
  const query = `SELECT DISTINCT ${q(C.ISYERI)} as isyeri FROM YLZ_TALEP_SIPARIS WHERE ${q(C.SIPARIS_TARIHI)} >= '${DATE_FILTER}' AND ${q(C.ISYERI)} IS NOT NULL AND ${q(C.ISYERI)} != '' AND ${q(C.TUR)} IS NOT NULL AND ${q(C.TUR)} <> '' ORDER BY ${q(C.ISYERI)}`;
  const sqlList = await executeQuery(withDedup(query, C));
  
  // Get unique isyeri from static data
  const staticIsyeri = [...new Set(staticOcakData
    .filter(r => r.ISYERI && r.ISYERI !== '' && r.TUR && r.TUR !== '')
    .map(r => r.ISYERI)
  )].map(isyeri => ({ isyeri }));
  
  // Combine and deduplicate
  const combined = [...staticIsyeri, ...sqlList];
  const unique = [...new Map(combined.map(item => [item.isyeri, item])).values()];
  return unique.sort((a, b) => (a.isyeri || '').localeCompare(b.isyeri || ''));
}

// Ambar listesi getir (frontend 'ambar' secimi icin)
async function getAmbarList() {
  const C = await getColumnNames();
  // TİRE'yi SQL sorgusundan da hariç tut (mobil ile aynı)
  const query = `SELECT DISTINCT ${q(C.AMBAR)} as ambar FROM YLZ_TALEP_SIPARIS WHERE ${q(C.SIPARIS_TARIHI)} >= '${DATE_FILTER}' AND ${q(C.AMBAR)} IS NOT NULL AND ${q(C.AMBAR)} != '' AND ${q(C.TUR)} IS NOT NULL AND ${q(C.TUR)} <> '' AND ${q(C.AMBAR)} != N'TİRE' ORDER BY ${q(C.AMBAR)}`;
  const sqlList = await executeQuery(withDedup(query, C));
  
  // Get unique ambar from static data (TİRE hariç)
  const staticAmbar = [...new Set(staticOcakData
    .filter(r => r.AMBAR && r.AMBAR !== '' && r.TUR && r.TUR !== '' && !EXCLUDED_FACTORIES.includes(normalizeAmbarName(r.AMBAR)))
    .map(r => r.AMBAR)
  )].map(ambar => ({ ambar }));
  
  // Combine and deduplicate
  const combined = [...staticAmbar, ...sqlList];
  const unique = [...new Map(combined.map(item => [item.ambar, item])).values()];
  return unique.sort((a, b) => (a.ambar || '').localeCompare(b.ambar || '', 'tr-TR'));
}

// compute total in TRY for rows matching whereClause (must start with WHERE or be empty)
async function computeTotalInTRY(whereClause = '') {
  const C = await getColumnNames();
  const defaultDateClause = `${q(C.SIPARIS_TARIHI)} >= '${DATE_FILTER}'`;
  const defaultTurClause = `(${q(C.TUR)} IS NOT NULL AND ${q(C.TUR)} <> '')`;
  if (!whereClause || !whereClause.toString().trim()) {
    whereClause = ` WHERE ${defaultDateClause} AND ${defaultTurClause}`;
  } else {
    if (!/^\s*WHERE/i.test(whereClause)) whereClause = ' ' + whereClause;
  }

  const groupQuery = `SELECT ISNULL(${q(C.PARA_BIRIMI)}, 'TRY') as paraBirimi, ISNULL(SUM(${q(C.TOPLAM)}),0) as toplam FROM YLZ_TALEP_SIPARIS ${whereClause} GROUP BY ISNULL(${q(C.PARA_BIRIMI)}, 'TRY')`;
  const groups = await executeQuery(withDedup(groupQuery, C));
  const rates = await fetchLatestRates();
  let totalTRY = 0;
  for (const g of groups) {
    const para = normalizeCurrencyKey(g.paraBirimi);
    const amount = Number(g.toplam) || 0;
    if (para === 'TRY') { totalTRY += amount; continue; }
    const ratePerTRY = rates[para];
    if (!ratePerTRY || ratePerTRY === 0) continue;
    const curToTry = 1 / ratePerTRY;
    totalTRY += amount * curToTry;
  }
  return totalTRY;
}

// fetch latest exchange rates (base=TRY) and return mapping
async function fetchLatestRates() {
  // return cached if fresh
  const now = Date.now();
  if (rateCache.rates && (now - rateCache.ts) < rateCache.ttl) return rateCache.rates;

  const https = require('https');
  const getJson = (url, timeout = 5000) => new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let raw = '';
      res.on('data', (c) => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
      });
    });
    req.on('error', (e) => reject(e));
    req.setTimeout(timeout, () => { req.destroy(new Error('Request timeout')); });
  });

  try {
    // Try a sequence of providers (prefer base=TRY responses)
    const providers = [
      { url: 'https://api.exchangerate.host/latest?base=TRY', getRates: r => r && r.rates },
      { url: 'https://open.er-api.com/v6/latest/TRY', getRates: r => r && r.rates },
      { url: 'https://api.exchangerate-api.com/v4/latest/TRY', getRates: r => r && r.rates },
      { url: 'https://api.exchangerate.host/latest', getRates: r => r && r.rates }
    ];

    for (const p of providers) {
      try {
        const res = await getJson(p.url);
        const rates = p.getRates(res);
        if (rates && Object.keys(rates).length > 0) {
          // If provider returned base=TRY style (rates relative to TRY), use directly.
          if (rates['TRY'] === undefined) {
            // If there's no TRY key, but provider was asked with base=TRY, it's fine.
            rateCache = { ts: now, ttl: rateCache.ttl, rates };
            return rates;
          } else {
            // If rates contain TRY, we'll derive currency per TRY below in fallback block
            rateCache = { ts: now, ttl: rateCache.ttl, rates };
            return rates;
          }
        }
      } catch (e) {
        // try next provider
        console.error('fetchLatestRates provider error for', p.url, e && e.message ? e.message : e);
      }
    }
  } catch (e) {
    // continue to fallback
    console.error('fetchLatestRates primary error:', e && e.message ? e.message : e);
  }
  // As a last attempt, try a generic latest and derive per-TRY rates if TRY present
  try {
    const url2 = 'https://api.exchangerate.host/latest';
    const res2 = await getJson(url2);
    if (res2 && res2.rates && res2.rates['TRY']) {
      const baseRates = res2.rates; // rates per base
      const tryPerBase = baseRates['TRY'];
      const derived = {};
      for (const k of Object.keys(baseRates)) {
        try { derived[k] = baseRates[k] / tryPerBase; } catch (e) { }
      }
      rateCache = { ts: now, ttl: rateCache.ttl, rates: derived };
      return derived;
    }
  } catch (e) {
    console.error('fetchLatestRates final fallback error:', e && e.message ? e.message : e);
  }

  // If all providers failed, return empty mapping (callers will skip conversions)
  return {};
}

function normalizeCurrencyKey(s) {
  if (!s) return 'TRY';
  let t = String(s).trim().toUpperCase();
  if (t === 'TL' || t === '₺' || t === 'TRY' || t === 'TUR') return 'TRY';
  t = t.replace(/[^A-Z]/g, '');
  return t || 'TRY';
}

async function convertGroupedQuery(fieldExpr, aliasName, whereClause = '') {
  const C = await getColumnNames();
  const defaultDateClause = `${q(C.SIPARIS_TARIHI)} >= '${DATE_FILTER}'`;
  const defaultTurClause = `(${q(C.TUR)} IS NOT NULL AND ${q(C.TUR)} <> '')`;
  if (!whereClause || !whereClause.toString().trim()) {
    whereClause = ` WHERE ${defaultDateClause} AND ${defaultTurClause}`;
  } else {
    if (!/^\s*WHERE/i.test(whereClause)) whereClause = ' ' + whereClause;
  }

  const groupQuery = `SELECT ${fieldExpr} as grp, ISNULL(${q(C.PARA_BIRIMI)}, 'TRY') as paraBirimi, ISNULL(SUM(${q(C.TOPLAM)}),0) as toplam FROM YLZ_TALEP_SIPARIS ${whereClause} GROUP BY ${fieldExpr}, ISNULL(${q(C.PARA_BIRIMI)}, 'TRY')`;
  const rows = await executeQuery(withDedup(groupQuery, C));
  const rates = await fetchLatestRates();
  const sumMap = new Map();
  for (const r of rows) {
    const grp = r.grp === null || r.grp === undefined ? 'Belirsiz' : r.grp;
    const para = normalizeCurrencyKey(r.paraBirimi);
    const amount = Number(r.toplam) || 0;
    let converted = 0;
    if (para === 'TRY') converted = amount;
    else {
      const ratePerTRY = rates[para];
      if (ratePerTRY && ratePerTRY !== 0) {
        const curToTry = 1 / ratePerTRY;
        converted = amount * curToTry;
      } else converted = 0;
    }
    sumMap.set(grp, (sumMap.get(grp) || 0) + converted);
  }

  const countsQuery = `SELECT ${fieldExpr} as grp, COUNT(DISTINCT ${q((await getColumnNames()).SIPARIS_NO)}) as siparisAdedi, COUNT(*) as kayitAdedi FROM YLZ_TALEP_SIPARIS ${whereClause} GROUP BY ${fieldExpr}`;
  const countsRows = await executeQuery(withDedup(countsQuery, C));
  const countsMap = new Map();
  for (const c of countsRows) {
    const grp = c.grp === null || c.grp === undefined ? 'Belirsiz' : c.grp;
    countsMap.set(grp, { siparisAdedi: Number(c.siparisAdedi) || 0, talepAdedi: Number(c.kayitAdedi) || 0 });
  }

  const arr = Array.from(sumMap.entries()).map(([k,v]) => {
    const counts = countsMap.get(k) || { siparisAdedi: 0, talepAdedi: 0 };
    return { [aliasName]: k, toplamTutar: v, siparisAdedi: counts.siparisAdedi, talepAdedi: counts.talepAdedi };
  });
  arr.sort((a,b) => b.toplamTutar - a.toplamTutar);
  return arr;
}

async function getDashboardStats(ambarFilter) {
  const connection = await getConnection();
  const C = await getColumnNames();
  const q = (col) => '[' + String(col).replace(/]/g, ']]') + ']';
  
  // Get static January data statistics
  const staticStats = getStaticStats(ambarFilter);
  const rates = await fetchLatestRates();
  
  // Date filter base
  const dateClause = `${q(C.SIPARIS_TARIHI)} >= '${DATE_FILTER}'`;

  // Exclude rows where TÜR is null or empty
  const turClause = ` AND (${q(C.TUR)} IS NOT NULL AND ${q(C.TUR)} <> '')`;

  // TİRE fabrikasını hariç tut (mobil ile birebir aynı davranış)
  const tireClause = ` AND (${q(C.AMBAR)} IS NULL OR ${q(C.AMBAR)} != N'TİRE')`;

  // Ambar filtresi (AMBAR kolonunu kullan - mobil ile aynı)
  const ambarCondition = ambarFilter && ambarFilter !== 'all' 
    ? ` AND ${q(C.AMBAR)} = N'${ambarFilter.replace(/'/g, "''")}'` 
    : '';

  const whereClause = ` WHERE ${dateClause}${ambarCondition}${turClause}${tireClause}`;
  const andClause = ` AND ${dateClause}${ambarCondition}${turClause}${tireClause}`;

  // Summary (treat SIPARIS_NO as delivered if ANY row for that SIPARIS_NO has a non-empty FATURAYI_KAYDEDEN)
  const summaryQuery = `SELECT
    (SELECT COUNT(DISTINCT ${q(C.TALEP_NO)}) FROM YLZ_TALEP_SIPARIS${whereClause}) as totalTalep,
    (SELECT COUNT(DISTINCT ${q(C.SIPARIS_NO)}) FROM YLZ_TALEP_SIPARIS${whereClause}) as totalSiparis,
    (SELECT COUNT(*) FROM (SELECT ${q(C.SIPARIS_NO)}, MAX(CASE WHEN ${q(C.FATURAYI_KAYDEDEN)} IS NOT NULL AND ${q(C.FATURAYI_KAYDEDEN)} <> '' THEN 1 ELSE 0 END) as hasE FROM YLZ_TALEP_SIPARIS${whereClause} GROUP BY ${q(C.SIPARIS_NO)}) x WHERE x.hasE = 1) as totalTeslimat,
    (SELECT COUNT(*) FROM (SELECT ${q(C.SIPARIS_NO)}, MAX(CASE WHEN ${q(C.FATURAYI_KAYDEDEN)} IS NOT NULL AND ${q(C.FATURAYI_KAYDEDEN)} <> '' THEN 1 ELSE 0 END) as hasE FROM YLZ_TALEP_SIPARIS${whereClause} GROUP BY ${q(C.SIPARIS_NO)}) x WHERE x.hasE = 0) as bekleyenTeslimat,
    (SELECT COUNT(DISTINCT ${q(C.CARI_UNVANI)}) FROM YLZ_TALEP_SIPARIS${whereClause}) as totalTedarikci,
    (SELECT COUNT(DISTINCT ${q(C.TALEP_EDEN)}) FROM YLZ_TALEP_SIPARIS${whereClause}) as totalTalepEden`;

  // Toplam tutar (grouped per siparis)
  const toplamTutarQuery = `SELECT ISNULL(SUM(t.toplamTutar),0) as toplamTutar FROM (SELECT ${q(C.SIPARIS_NO)}, SUM(${q(C.TOPLAM)}) as toplamTutar FROM YLZ_TALEP_SIPARIS${whereClause} AND ${q(C.SIPARIS_NO)} IS NOT NULL GROUP BY ${q(C.SIPARIS_NO)}) t`;

  const monthlyTrendQuery = `SELECT FORMAT(${q(C.SIPARIS_TARIHI)}, 'yyyy-MM') as ay, COUNT(DISTINCT ${q(C.SIPARIS_NO)}) as siparisAdedi, ISNULL(SUM(${q(C.TOPLAM)}),0) as toplamTutar FROM YLZ_TALEP_SIPARIS WHERE ${q(C.SIPARIS_TARIHI)} IS NOT NULL${andClause} GROUP BY FORMAT(${q(C.SIPARIS_TARIHI)}, 'yyyy-MM') ORDER BY ay DESC`;

  const talepEdenQuery = `SELECT TOP 10 ${q(C.TALEP_EDEN)} as talepEden, COUNT(DISTINCT ${q(C.SIPARIS_NO)}) as siparisAdedi, COUNT(*) as talepAdedi, ISNULL(SUM(${q(C.TOPLAM)}),0) as toplamTutar FROM YLZ_TALEP_SIPARIS WHERE ${q(C.TALEP_EDEN)} IS NOT NULL AND ${q(C.TALEP_EDEN)} != ''${andClause} GROUP BY ${q(C.TALEP_EDEN)} ORDER BY toplamTutar DESC`;

  const masrafMerkeziQuery = `SELECT TOP 10 ${q(C.MASRAF_MERKEZI)} as masrafMerkezi, COUNT(DISTINCT ${q(C.SIPARIS_NO)}) as siparisAdedi, ISNULL(SUM(${q(C.TOPLAM)}),0) as toplamTutar FROM YLZ_TALEP_SIPARIS WHERE ${q(C.MASRAF_MERKEZI)} IS NOT NULL AND ${q(C.MASRAF_MERKEZI)} != ''${andClause} GROUP BY ${q(C.MASRAF_MERKEZI)} ORDER BY toplamTutar DESC`;

  const tedarikciQuery = `SELECT TOP 10 ${q(C.CARI_UNVANI)} as tedarikci, COUNT(DISTINCT ${q(C.SIPARIS_NO)}) as siparisAdedi, ISNULL(SUM(${q(C.TOPLAM)}),0) as toplamTutar FROM YLZ_TALEP_SIPARIS WHERE ${q(C.CARI_UNVANI)} IS NOT NULL AND ${q(C.CARI_UNVANI)} != ''${andClause} GROUP BY ${q(C.CARI_UNVANI)} ORDER BY toplamTutar DESC`;

  const paraBirimiQuery = `SELECT ISNULL(${q(C.PARA_BIRIMI)}, 'TRY') as paraBirimi, COUNT(DISTINCT ${q(C.SIPARIS_NO)}) as siparisAdedi, COUNT(*) as kayitAdedi, ISNULL(SUM(${q(C.TOPLAM)}),0) as toplamTutar FROM YLZ_TALEP_SIPARIS${whereClause} GROUP BY ${q(C.PARA_BIRIMI)} ORDER BY toplamTutar DESC`;

  const turQuery = `SELECT ISNULL(${q(C.TUR)}, 'Belirsiz') as tur, COUNT(DISTINCT ${q(C.SIPARIS_NO)}) as siparisAdedi, COUNT(*) as kayitAdedi, ISNULL(SUM(${q(C.TOPLAM)}),0) as toplamTutar FROM YLZ_TALEP_SIPARIS${whereClause} GROUP BY ${q(C.TUR)} ORDER BY toplamTutar DESC`;

  const teslimDurumQuery = `SELECT CASE WHEN t.hasE = 1 THEN 'Teslim Edildi' ELSE 'Teslim Bekliyor' END as durum, COUNT(*) as siparisAdedi, SUM(t.kayitAdedi) as kayitAdedi, ISNULL(SUM(t.toplamTutar),0) as toplamTutar FROM (
    SELECT ${q(C.SIPARIS_NO)} as siparisNo, MAX(CASE WHEN ${q(C.FATURAYI_KAYDEDEN)} IS NOT NULL AND ${q(C.FATURAYI_KAYDEDEN)} <> '' THEN 1 ELSE 0 END) as hasE, COUNT(*) as kayitAdedi, ISNULL(SUM(${q(C.TOPLAM)}),0) as toplamTutar
    FROM YLZ_TALEP_SIPARIS${whereClause} AND ${q(C.SIPARIS_NO)} IS NOT NULL GROUP BY ${q(C.SIPARIS_NO)}
  ) t
  GROUP BY t.hasE ORDER BY toplamTutar DESC`;

  const ambarQuery = `SELECT ISNULL(${q(C.AMBAR)}, 'Belirsiz') as ambar, COUNT(DISTINCT ${q(C.SIPARIS_NO)}) as siparisAdedi, COUNT(*) as kayitAdedi, ISNULL(SUM(${q(C.TOPLAM)}),0) as toplamTutar FROM YLZ_TALEP_SIPARIS${whereClause} GROUP BY ${q(C.AMBAR)} ORDER BY toplamTutar DESC`;

  const isyeriQuery = `SELECT ISNULL(${q(C.ISYERI)}, 'Belirsiz') as isyeri, COUNT(DISTINCT ${q(C.SIPARIS_NO)}) as siparisAdedi, COUNT(*) as kayitAdedi, ISNULL(SUM(${q(C.TOPLAM)}),0) as toplamTutar FROM YLZ_TALEP_SIPARIS${whereClause} GROUP BY ${q(C.ISYERI)} ORDER BY toplamTutar DESC`;

  const onaylayanQuery = `SELECT TOP 10 ${q(C.SIPARIS_ONAYLAYAN)} as onaylayan, COUNT(DISTINCT ${q(C.SIPARIS_NO)}) as siparisAdedi, ISNULL(SUM(${q(C.TOPLAM)}),0) as toplamTutar FROM YLZ_TALEP_SIPARIS WHERE ${q(C.SIPARIS_ONAYLAYAN)} IS NOT NULL AND ${q(C.SIPARIS_ONAYLAYAN)} != ''${andClause} GROUP BY ${q(C.SIPARIS_ONAYLAYAN)} ORDER BY toplamTutar DESC`;

  const odemeVadesiQuery = `SELECT ISNULL(${q(C.ODEME_VADESI)}, 'Belirsiz') as odemeVadesi, COUNT(DISTINCT ${q(C.SIPARIS_NO)}) as siparisAdedi, COUNT(*) as kayitAdedi, ISNULL(SUM(${q(C.TOPLAM)}),0) as toplamTutar FROM YLZ_TALEP_SIPARIS${whereClause} GROUP BY ${q(C.ODEME_VADESI)} ORDER BY toplamTutar DESC`;

  const teslimatSuresiQuery = `SELECT AVG(DATEDIFF(DAY, ${q(C.SIPARIS_TARIHI)}, ${q(C.TESLIM_TARIHI)})) as ortalamaTeslimatSuresi, MIN(DATEDIFF(DAY, ${q(C.SIPARIS_TARIHI)}, ${q(C.TESLIM_TARIHI)})) as minTeslimatSuresi, MAX(DATEDIFF(DAY, ${q(C.SIPARIS_TARIHI)}, ${q(C.TESLIM_TARIHI)})) as maxTeslimatSuresi FROM YLZ_TALEP_SIPARIS WHERE ${q(C.SIPARIS_TARIHI)} IS NOT NULL AND ${q(C.TESLIM_TARIHI)} IS NOT NULL${andClause}`;

  const [summary, toplamTutar, monthlyTrendRaw, talepEdenRaw, masrafMerkeziRaw, tedarikciRaw, paraBirimiRaw, turRaw, teslimDurumRaw, ambarRaw, isyeriRaw, onaylayanRaw, odemeVadesiRaw, teslimatSuresi] = await Promise.all([
    connection.request().query(withDedup(summaryQuery, C)),
    connection.request().query(withDedup(toplamTutarQuery, C)),
    connection.request().query(withDedup(monthlyTrendQuery, C)),
    connection.request().query(withDedup(talepEdenQuery, C)),
    connection.request().query(withDedup(masrafMerkeziQuery, C)),
    connection.request().query(withDedup(tedarikciQuery, C)),
    connection.request().query(withDedup(paraBirimiQuery, C)),
    connection.request().query(withDedup(turQuery, C)),
    connection.request().query(withDedup(teslimDurumQuery, C)),
    connection.request().query(withDedup(ambarQuery, C)),
    connection.request().query(withDedup(isyeriQuery, C)),
    connection.request().query(withDedup(onaylayanQuery, C)),
    connection.request().query(withDedup(odemeVadesiQuery, C)),
    connection.request().query(withDedup(teslimatSuresiQuery, C))
  ]);

  // compute live-converted total to TRY (uses whereClause constructed above)
  let toplamTutarTRY = 0;
  try {
    toplamTutarTRY = await computeTotalInTRY(whereClause);
  } catch (e) {
    console.error('Error computing TRY total:', e);
    toplamTutarTRY = 0;
  }
  
  // Add static data TRY total
  let staticTotalTRY = 0;
  for (const [cur, amount] of staticStats.currencyTotals) {
    const normCur = normalizeCurrencyKeySync(cur);
    if (normCur === 'TRY') {
      staticTotalTRY += amount;
    } else {
      const ratePerTRY = rates[normCur];
      if (ratePerTRY && ratePerTRY !== 0) {
        staticTotalTRY += amount * (1 / ratePerTRY);
      }
    }
  }
  toplamTutarTRY += staticTotalTRY;

  // Convert grouped datasets to TRY using live rates
  let monthlyTrendConverted = [];
  try {
    const monthWhere = ` WHERE ${q(C.SIPARIS_TARIHI)} IS NOT NULL${andClause}`;
    const months = await convertGroupedQuery(`FORMAT(${q(C.SIPARIS_TARIHI)}, 'yyyy-MM')`, 'ay', monthWhere);
    const countsQuery = `SELECT FORMAT(${q(C.SIPARIS_TARIHI)}, 'yyyy-MM') as ay, COUNT(DISTINCT ${q(C.SIPARIS_NO)}) as siparisAdedi FROM YLZ_TALEP_SIPARIS ${monthWhere} GROUP BY FORMAT(${q(C.SIPARIS_TARIHI)}, 'yyyy-MM')`;
    const counts = await executeQuery(withDedup(countsQuery, C));
    const countsMap = new Map(counts.map(r => [r.ay, r.siparisAdedi]));
    monthlyTrendConverted = months.map(m => ({ ay: m.ay, siparisAdedi: countsMap.get(m.ay) || 0, toplamTutar: m.toplamTutar }));
    
    // Add static monthly data (January 2026)
    for (const [ay, data] of staticStats.monthlyGroups) {
      let monthTotalTRY = 0;
      for (const [cur, amount] of data.paraBirimi) {
        const normCur = normalizeCurrencyKeySync(cur);
        if (normCur === 'TRY') {
          monthTotalTRY += amount;
        } else {
          const ratePerTRY = rates[normCur];
          if (ratePerTRY && ratePerTRY !== 0) {
            monthTotalTRY += amount * (1 / ratePerTRY);
          }
        }
      }
      const existing = monthlyTrendConverted.find(m => m.ay === ay);
      if (existing) {
        existing.siparisAdedi += data.siparisSet.size;
        existing.toplamTutar += monthTotalTRY;
      } else {
        monthlyTrendConverted.push({ ay, siparisAdedi: data.siparisSet.size, toplamTutar: monthTotalTRY });
      }
    }
    monthlyTrendConverted.sort((a, b) => b.ay.localeCompare(a.ay));
  } catch (e) {
    console.error('monthlyTrend conversion error:', e);
    monthlyTrendConverted = monthlyTrendRaw.recordset;
  }

  async function convertAndFallback(fieldExpr, alias, rawRecordset) {
    try {
      const arr = await convertGroupedQuery(fieldExpr, alias, whereClause);
      return arr.map(r => ({ [alias]: r[alias], toplamTutar: r.toplamTutar, siparisAdedi: r.siparisAdedi, talepAdedi: r.talepAdedi }));
    } catch (e) {
      console.error('convert grouping error for', alias, e);
      return rawRecordset.recordset;
    }
  }

  const talepEdenSql = await convertAndFallback(`COALESCE(${q(C.TALEP_EDEN)}, 'Belirsiz')`, 'talepEden', talepEdenRaw);
  const masrafMerkeziSql = await convertAndFallback(`COALESCE(${q(C.MASRAF_MERKEZI)}, 'Belirsiz')`, 'masrafMerkezi', masrafMerkeziRaw);
  const tedarikciSql = await convertAndFallback(`COALESCE(${q(C.CARI_UNVANI)}, 'Belirsiz')`, 'tedarikci', tedarikciRaw);
  const ambarSql = await convertAndFallback(`COALESCE(${q(C.AMBAR)}, 'Belirsiz')`, 'ambar', ambarRaw);
  const isyeriSql = await convertAndFallback(`COALESCE(${q(C.ISYERI)}, 'Belirsiz')`, 'isyeri', isyeriRaw);
  const onaylayanSql = await convertAndFallback(`COALESCE(${q(C.SIPARIS_ONAYLAYAN)}, 'Belirsiz')`, 'onaylayan', onaylayanRaw);
  const odemeVadesiSql = await convertAndFallback(`COALESCE(${q(C.ODEME_VADESI)}, 'Belirsiz')`, 'odemeVadesi', odemeVadesiRaw);
  const teslimDurumSql = await convertAndFallback(`CASE WHEN ${q(C.FATURAYI_KAYDEDEN)} IS NOT NULL AND ${q(C.FATURAYI_KAYDEDEN)} != '' THEN 'Teslim Edildi' ELSE 'Teslim Bekliyor' END`, 'durum', teslimDurumRaw);

  // Merge static and SQL data for each grouping
  const talepEden = mergeGroupStats(staticStats.talepEdenGroups, talepEdenSql, 'talepEden', rates);
  const masrafMerkezi = mergeGroupStats(staticStats.masrafMerkeziGroups, masrafMerkeziSql, 'masrafMerkezi', rates);
  const tedarikci = mergeGroupStats(staticStats.tedarikciGroups, tedarikciSql, 'tedarikci', rates);
  const ambarData = mergeGroupStats(staticStats.ambarGroups, ambarSql, 'ambar', rates);
  const isyeriData = mergeGroupStats(staticStats.isyeriGroups, isyeriSql, 'isyeri', rates);
  const onaylayan = mergeGroupStats(staticStats.onaylayanGroups, onaylayanSql, 'onaylayan', rates);
  const odemeVadesi = mergeGroupStats(staticStats.odemeVadesiGroups, odemeVadesiSql, 'odemeVadesi', rates);
  
  // Merge delivery status
  const teslimDurumMerged = [];
  const teslimEdildiStatic = { siparisAdedi: staticStats.totalTeslimat, talepAdedi: 0, toplamTutar: 0 };
  const teslimBekleyenStatic = { siparisAdedi: staticStats.bekleyenTeslimat, talepAdedi: 0, toplamTutar: 0 };
  
  // Calculate totals for delivery status from static data
  for (const r of staticStats.records) {
    const hasDelivery = r.FATURAYI_KAYDEDEN && r.FATURAYI_KAYDEDEN !== '';
    const amount = Number(r.TOPLAM) || 0;
    const cur = normalizeCurrencyKeySync(r.PARA_BIRIMI || 'TL');
    let tryAmount = amount;
    if (cur !== 'TRY') {
      const ratePerTRY = rates[cur];
      if (ratePerTRY && ratePerTRY !== 0) {
        tryAmount = amount * (1 / ratePerTRY);
      } else {
        tryAmount = 0;
      }
    }
    if (hasDelivery) {
      teslimEdildiStatic.toplamTutar += tryAmount;
      teslimEdildiStatic.talepAdedi++;
    } else {
      teslimBekleyenStatic.toplamTutar += tryAmount;
      teslimBekleyenStatic.talepAdedi++;
    }
  }
  
  for (const sql of teslimDurumSql) {
    const staticData = sql.durum === 'Teslim Edildi' ? teslimEdildiStatic : teslimBekleyenStatic;
    teslimDurumMerged.push({
      durum: sql.durum,
      siparisAdedi: (sql.siparisAdedi || 0) + staticData.siparisAdedi,
      talepAdedi: (sql.talepAdedi || 0) + staticData.talepAdedi,
      toplamTutar: (sql.toplamTutar || 0) + staticData.toplamTutar
    });
  }
  // Add static-only delivery status if not in SQL results
  if (!teslimDurumSql.find(s => s.durum === 'Teslim Edildi') && teslimEdildiStatic.siparisAdedi > 0) {
    teslimDurumMerged.push({ durum: 'Teslim Edildi', ...teslimEdildiStatic });
  }
  if (!teslimDurumSql.find(s => s.durum === 'Teslim Bekliyor') && teslimBekleyenStatic.siparisAdedi > 0) {
    teslimDurumMerged.push({ durum: 'Teslim Bekliyor', ...teslimBekleyenStatic });
  }

  let paraBirimiConverted = [];
  try {
    const perCur = await convertGroupedQuery(`${q(C.PARA_BIRIMI)}`, 'paraBirimi', whereClause);
    paraBirimiConverted = perCur.map(p => ({ paraBirimi: p.paraBirimi || 'TRY', toplam: p.toplamTutar, convertedTRY: p.toplamTutar }));
    
    // Add static currency data (also include kayitAdedi and siparisAdedi)
    for (const [cur, amount] of staticStats.currencyTotals) {
      const normCur = normalizeCurrencyKeySync(cur);
      let tryAmount = amount;
      if (normCur !== 'TRY') {
        const ratePerTRY = rates[normCur];
        if (ratePerTRY && ratePerTRY !== 0) {
          tryAmount = amount * (1 / ratePerTRY);
        }
      }
      const staticGroup = staticStats.paraBirimiGroups.get(cur) || staticStats.paraBirimiGroups.get(normCur) || { count: 0, siparisSet: new Set() };
      const staticKayit = staticGroup.count || 0;
      const staticSiparis = staticGroup.siparisSet ? staticGroup.siparisSet.size : 0;
      const existing = paraBirimiConverted.find(p => normalizeCurrencyKeySync(p.paraBirimi) === normCur);
      if (existing) {
        existing.toplam += amount;
        existing.convertedTRY += tryAmount;
        existing.kayitAdedi = (existing.kayitAdedi || 0) + staticKayit;
        existing.siparisAdedi = (existing.siparisAdedi || 0) + staticSiparis;
      } else {
        paraBirimiConverted.push({ paraBirimi: cur, toplam: amount, convertedTRY: tryAmount, kayitAdedi: staticKayit, siparisAdedi: staticSiparis });
      }
    }
  } catch (e) {
    console.error('paraBirimiConverted error:', e);
    paraBirimiConverted = paraBirimiRaw.recordset;
  }

  // Build combined paraBirimi array (unique currencies from SQL + static)
  const combinedCurrenciesMap = new Map();
  // from SQL raw
  for (const p of (paraBirimiRaw.recordset || [])) {
    const key = normalizeCurrencyKeySync(p.paraBirimi || 'TRY');
    combinedCurrenciesMap.set(key, { paraBirimi: p.paraBirimi || 'TRY', toplam: Number(p.toplamTutar) || 0, kayitAdedi: Number(p.kayitAdedi) || 0 });
  }
  // from static
  for (const [cur, group] of staticStats.paraBirimiGroups) {
    const key = normalizeCurrencyKeySync(cur || 'TRY');
    const existing = combinedCurrenciesMap.get(key);
    const amount = group.toplam || 0;
    const kayit = group.count || 0;
    if (existing) {
      existing.toplam = (existing.toplam || 0) + amount;
      existing.kayitAdedi = (existing.kayitAdedi || 0) + kayit;
      combinedCurrenciesMap.set(key, existing);
    } else {
      combinedCurrenciesMap.set(key, { paraBirimi: cur, toplam: amount, kayitAdedi: kayit });
    }
  }
  const paraBirimiCombined = Array.from(combinedCurrenciesMap.values());

  // Merge summary statistics
  const sqlSummary = summary.recordset[0] || {};
  const mergedSummary = {
    totalTalep: (sqlSummary.totalTalep || 0) + staticStats.totalTalep,
    totalSiparis: (sqlSummary.totalSiparis || 0) + staticStats.totalSiparis,
    totalTeslimat: (sqlSummary.totalTeslimat || 0) + staticStats.totalTeslimat,
    bekleyenTeslimat: (sqlSummary.bekleyenTeslimat || 0) + staticStats.bekleyenTeslimat,
    totalTedarikci: 0,  // will be computed from merged tedarikci list below to avoid double-counting
    totalTalepEden: (sqlSummary.totalTalepEden || 0) + staticStats.totalTalepEden,
    toplamTutar: (toplamTutar.recordset[0]?.toplamTutar || 0) + Array.from(staticStats.currencyTotals.values()).reduce((s, v) => s + v, 0),
    toplamTutarTRY
  };

  // Ortalama siparis tutari (TRY bazında)
  mergedSummary.ortalamaTutar = mergedSummary.totalSiparis > 0 ? (mergedSummary.toplamTutarTRY || toplamTutarTRY) / mergedSummary.totalSiparis : 0;

  // Merge delivery time from SQL and static data
  const sqlDelivery = teslimatSuresi.recordset[0] || {};
  const sqlAvg = sqlDelivery.ortalamaTeslimatSuresi || 0;
  const sqlMin = sqlDelivery.minTeslimatSuresi || 0;
  const sqlMax = sqlDelivery.maxTeslimatSuresi || 0;
  
  // Combine static and SQL delivery times
  let mergedAvgDelivery = 0;
  let mergedMinDelivery = 0;
  let mergedMaxDelivery = 0;
  
  if (staticStats.deliveryTimes.length > 0 && sqlAvg > 0) {
    // Both have data - weighted average would be ideal but we approximate
    mergedAvgDelivery = Math.round((staticStats.avgDeliveryTime + sqlAvg) / 2);
    mergedMinDelivery = Math.min(staticStats.minDeliveryTime, sqlMin);
    mergedMaxDelivery = Math.max(staticStats.maxDeliveryTime, sqlMax);
  } else if (staticStats.deliveryTimes.length > 0) {
    mergedAvgDelivery = staticStats.avgDeliveryTime;
    mergedMinDelivery = staticStats.minDeliveryTime;
    mergedMaxDelivery = staticStats.maxDeliveryTime;
  } else {
    mergedAvgDelivery = sqlAvg;
    mergedMinDelivery = sqlMin;
    mergedMaxDelivery = sqlMax;
  }
  
  const mergedTeslimatSuresi = {
    ortalamaTeslimatSuresi: mergedAvgDelivery,
    minTeslimatSuresi: mergedMinDelivery,
    maxTeslimatSuresi: mergedMaxDelivery
  };

  // Return all tedarikci (not just top 10) for TedarikciAnaliz page totals
  // Ensure mergedSummary.totalTedarikci reflects unique suppliers across static + SQL
  try {
    mergedSummary.totalTedarikci = Array.isArray(tedarikci) ? tedarikci.length : mergedSummary.totalTedarikci;
  } catch (e) {
    // fallback to previously computed value if anything goes wrong
    mergedSummary.totalTedarikci = mergedSummary.totalTedarikci || (sqlSummary.totalTedarikci || 0) + (staticStats.totalTedarikci || 0);
  }
  return {
    summary: mergedSummary,
    monthlyTrend: monthlyTrendConverted,
    talepEden: talepEden.slice(0, 10),
    masrafMerkezi: masrafMerkezi.slice(0, 10),
    tedarikci: tedarikci,
    paraBirimi: paraBirimiCombined,
    paraBirimiConverted,
    tur: turRaw.recordset,
    durum: teslimDurumMerged,
    ambar: ambarData,
    onaylayan: onaylayan.slice(0, 10),
    odemeVadesi,
    teslimatSuresi: mergedTeslimatSuresi,
    columns: C
   };
 }

// Fabrika karşılaştırma verileri - her ambar için ayrı istatistik döndürür
async function getFactoryComparisonData() {
  const C = await getColumnNames();
  const conn = await getConnection();
  const rates = await fetchLatestRates();

  const dateClause = `${q(C.SIPARIS_TARIHI)} >= '${DATE_FILTER}'`;
  const turClause = `(${q(C.TUR)} IS NOT NULL AND ${q(C.TUR)} <> '')`;
  const whereClause = ` WHERE ${dateClause} AND ${turClause}`;

  // SQL: siparis/talep sayısı per ambar
  const sipTalepQuery = `
    SELECT
      ISNULL(${q(C.AMBAR)}, 'Belirsiz') as ambar,
      COUNT(DISTINCT ${q(C.SIPARIS_NO)}) as siparisAdedi,
      COUNT(DISTINCT ${q(C.TALEP_NO)}) as talepAdedi
    FROM YLZ_TALEP_SIPARIS${whereClause}
    GROUP BY ${q(C.AMBAR)}
  `;

  // SQL: teslim durumu per ambar
  const deliveryQuery = `
    SELECT
      x.ambar,
      SUM(CASE WHEN x.hasE = 1 THEN 1 ELSE 0 END) as teslimEdilen,
      SUM(CASE WHEN x.hasE = 0 THEN 1 ELSE 0 END) as bekleyen
    FROM (
      SELECT
        ISNULL(${q(C.AMBAR)}, 'Belirsiz') as ambar,
        ${q(C.SIPARIS_NO)},
        MAX(CASE WHEN ${q(C.FATURAYI_KAYDEDEN)} IS NOT NULL AND ${q(C.FATURAYI_KAYDEDEN)} <> '' THEN 1 ELSE 0 END) as hasE
      FROM YLZ_TALEP_SIPARIS${whereClause} AND ${q(C.SIPARIS_NO)} IS NOT NULL
      GROUP BY ISNULL(${q(C.AMBAR)}, 'Belirsiz'), ${q(C.SIPARIS_NO)}
    ) x
    GROUP BY x.ambar
  `;

  // SQL: toplam tutar per ambar+paraBirimi (kur dönüşümü için)
  const tutarQuery = `
    SELECT
      ISNULL(${q(C.AMBAR)}, 'Belirsiz') as ambar,
      ISNULL(${q(C.PARA_BIRIMI)}, 'TRY') as paraBirimi,
      ISNULL(SUM(${q(C.TOPLAM)}), 0) as toplam
    FROM YLZ_TALEP_SIPARIS${whereClause}
    GROUP BY ${q(C.AMBAR)}, ${q(C.PARA_BIRIMI)}
  `;

  const [sipTalepResult, deliveryResult, tutarResult] = await Promise.all([
    conn.request().query(withDedup(sipTalepQuery, C)),
    conn.request().query(withDedup(deliveryQuery, C)),
    conn.request().query(withDedup(tutarQuery, C)),
  ]);

  const comparisonData = {};

  // siparis/talep counts
  for (const row of sipTalepResult.recordset) {
    const ambar = row.ambar;
    comparisonData[ambar] = {
      siparisAdedi: Number(row.siparisAdedi) || 0,
      talepAdedi: Number(row.talepAdedi) || 0,
      toplamTutar: 0,
      teslimEdilen: 0,
      bekleyen: 0,
    };
  }

  // delivery counts
  for (const row of deliveryResult.recordset) {
    const ambar = row.ambar;
    if (!comparisonData[ambar]) comparisonData[ambar] = { siparisAdedi: 0, talepAdedi: 0, toplamTutar: 0, teslimEdilen: 0, bekleyen: 0 };
    comparisonData[ambar].teslimEdilen = Number(row.teslimEdilen) || 0;
    comparisonData[ambar].bekleyen = Number(row.bekleyen) || 0;
  }

  // toplam TRY
  for (const row of tutarResult.recordset) {
    const ambar = row.ambar;
    if (!comparisonData[ambar]) comparisonData[ambar] = { siparisAdedi: 0, talepAdedi: 0, toplamTutar: 0, teslimEdilen: 0, bekleyen: 0 };
    const para = normalizeCurrencyKey(row.paraBirimi);
    const amount = Number(row.toplam) || 0;
    let tryAmount = amount;
    if (para !== 'TRY') {
      const ratePerTRY = rates[para];
      if (ratePerTRY && ratePerTRY !== 0) tryAmount = amount * (1 / ratePerTRY);
      else tryAmount = 0;
    }
    comparisonData[ambar].toplamTutar += tryAmount;
  }

  // Statik Ocak 2026 verisini ekle (per ambar)
  const staticByAmbar = {};
  for (const r of staticOcakData) {
    if (!r.AMBAR || !r.TUR || r.TUR === '') continue;
    const ambar = r.AMBAR;
    if (!staticByAmbar[ambar]) {
      staticByAmbar[ambar] = { siparisSet: new Set(), talepSet: new Set(), toplamTutar: 0, siparisDelivery: new Map() };
    }
    const d = staticByAmbar[ambar];
    if (r.SIPARIS_NO) d.siparisSet.add(r.SIPARIS_NO);
    if (r.TALEP_NO) d.talepSet.add(r.TALEP_NO);
    const para = normalizeCurrencyKeySync(r.PARA_BIRIMI || 'TL');
    const amount = Number(r.TOPLAM) || 0;
    let tryAmount = amount;
    if (para !== 'TRY') {
      const ratePerTRY = rates[para];
      if (ratePerTRY && ratePerTRY !== 0) tryAmount = amount * (1 / ratePerTRY);
      else tryAmount = 0;
    }
    d.toplamTutar += tryAmount;
    if (r.SIPARIS_NO) {
      const hasDelivery = !!(r.FATURAYI_KAYDEDEN && r.FATURAYI_KAYDEDEN !== '');
      d.siparisDelivery.set(r.SIPARIS_NO, hasDelivery || d.siparisDelivery.get(r.SIPARIS_NO) || false);
    }
  }

  for (const [ambar, data] of Object.entries(staticByAmbar)) {
    if (!comparisonData[ambar]) comparisonData[ambar] = { siparisAdedi: 0, talepAdedi: 0, toplamTutar: 0, teslimEdilen: 0, bekleyen: 0 };
    comparisonData[ambar].siparisAdedi += data.siparisSet.size;
    comparisonData[ambar].talepAdedi += data.talepSet.size;
    comparisonData[ambar].toplamTutar += data.toplamTutar;
    for (const hasDelivery of data.siparisDelivery.values()) {
      if (hasDelivery) comparisonData[ambar].teslimEdilen++;
      else comparisonData[ambar].bekleyen++;
    }
  }

  // teslimOrani hesapla, Belirsiz/TİRE çıkar
  for (const ambar of Object.keys(comparisonData)) {
    const { siparisAdedi, teslimEdilen } = comparisonData[ambar];
    comparisonData[ambar].teslimOrani = siparisAdedi > 0 ? Math.round((teslimEdilen / siparisAdedi) * 100) : 0;
  }
  delete comparisonData['Belirsiz'];
  delete comparisonData['TİRE'];

  return comparisonData;
}

module.exports = { executeQuery, getAllData, getDashboardStats, getIsyeriList, getAmbarList, getColumnMapping, getFactoryComparisonData };
