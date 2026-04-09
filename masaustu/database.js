/**
 * database.js - Masaustu veri katmani
 * Mobil (dataProcessor.js) ile birebir ayni mantik:
 *   - Ocak 2026 verileri: statik JSON dosyasindan
 *   - Subat+ verileri: SatinAlmaApi /api/Satinalma/veriler endpointinden
 *   - Duplikasyon engelleme: SIPARIS_NO|SIPARIS_MALZEME|MIKTAR|BIRIM_FIYAT
 *   - TIRE fabrikasi haric
 *   - Toplam tutar: ham toplamlar (kur donusumu yok - mobil ile ayni)
 */

const fs = require('fs');
const path = require('path');

// Satin Alma API
const SATINALMA_API_URL = 'http://10.35.20.17:5055';

// Statik Ocak 2026 verileri
let staticRecords = [];
try {
  // extraResources yolu (kurulu uygulama): resources/ocak_2026_data.json
  let staticDataPath = path.join(process.resourcesPath || '', 'ocak_2026_data.json');
  if (!fs.existsSync(staticDataPath)) staticDataPath = path.join(__dirname, 'ocak_2026_data.json');
  if (!fs.existsSync(staticDataPath)) staticDataPath = path.join(process.cwd(), 'ocak_2026_data.json');
  if (fs.existsSync(staticDataPath)) {
    const raw = JSON.parse(fs.readFileSync(staticDataPath, 'utf8'));
    staticRecords = Array.isArray(raw) ? raw : (raw.records || []);
    // Ocak-Subat-Mart siparislerini teslim edildi olarak isaretle
    staticRecords = staticRecords.map(function(r) {
      return Object.assign({}, applyQ1DeliveredOverride(r), {
        FATURAYI_KAYDEDEN: r.FATURAYI_KAYDEDEN || 'SISTEM'
      });
    });
    console.log('Loaded ' + staticRecords.length + ' static records (Q1 orders marked delivered)');
  } else {
    console.warn('Static data file not found');
  }
} catch (e) {
  console.error('Error loading static January data:', e.message);
}

// API verileri cache
let apiRecords = [];
let lastApiFetch = 0;
const API_CACHE_TTL = 5 * 60 * 1000; // 5 dakika
let useNoFilterEndpoint = false;

function resetApiCache() {
  apiRecords = [];
  lastApiFetch = 0;
}

function setUseNoFilterEndpoint(enabled) {
  useNoFilterEndpoint = !!enabled;
  resetApiCache();
  return useNoFilterEndpoint;
}

function toggleUseNoFilterEndpoint() {
  useNoFilterEndpoint = !useNoFilterEndpoint;
  resetApiCache();
  return useNoFilterEndpoint;
}

function getUseNoFilterEndpoint() {
  return useNoFilterEndpoint;
}

// Sabitler
const EXCLUDED_FACTORIES = ['T\u0130RE'];

function isNonEmpty(v) {
  return v !== null && v !== undefined && String(v).trim() !== '';
}

function isLegacyFilteredMode() {
  return !useNoFilterEndpoint;
}
/**
 * Türkçe veya standart sayı string'lerini güvenli parse eder.
 * "2.598.784,7028" → 2598784.7028
 * "583.440"        → 583440   (3 basamaklı ondalık → Türkçe binlik)
 * "4,4526"         → 4.4526
 * "81.68"          → 81.68    (2 basamaklı ondalık → ondalık nokta)
 * 8168 (number)    → 8168
 */
function parseNum(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const s = String(val).trim();
  let normalized;
  if (s.includes(',')) {
    // Türkçe format: nokta = binlik ayırıcı, virgül = ondalık ayırıcı
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes('.')) {
    // Yalnızca nokta var: kaç basamak sonra geldiğine bakarak ayır
    // Birden fazla nokta VEYA noktadan sonra tam 3 basamak → Türkçe binlik
    // Aksi halde → standart ondalık nokta (ör: 81.68, 4.45)
    const parts = s.split('.');
    const afterLast = parts[parts.length - 1];
    if (parts.length > 2 || afterLast.length === 3) {
      // Türkçe binlik format: noktaları sil
      normalized = s.replace(/\./g, '');
    } else {
      // Ondalık nokta
      normalized = s;
    }
  } else {
    normalized = s;
  }
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}
// Yardimci fonksiyonlar (mobil ile birebir ayni)
function normalizeAmbarName(ambar) {
  if (!ambar) return '';
  return ambar.toLocaleUpperCase('tr-TR');
}

function normalizeTedarikciName(tedarikci) {
  if (!tedarikci) return '';
  if (tedarikci === 'MUHTELİF SATICILAR') return 'MUHTELİF SATICILAR (E-TİCARET)';
  return tedarikci;
}

function firstNonEmpty(obj, keys) {
  for (var i = 0; i < keys.length; i++) {
    var val = obj[keys[i]];
    if (isNonEmpty(val)) return val;
  }
  return null;
}

function toIsoDateString(value) {
  if (!isNonEmpty(value)) return null;
  var d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toISOString();
}

function isQ1OrderDate(value) {
  if (!isNonEmpty(value)) return false;
  var d = new Date(value);
  if (isNaN(d.getTime())) return false;
  var month = d.getMonth() + 1;
  return month >= 1 && month <= 3;
}

function applyQ1DeliveredOverride(record) {
  if (!record) return record;
  var siparisTarihi = firstNonEmpty(record, ['SIPARIS_TARIHI', 'TALEP_TARIHI']);
  if (!isQ1OrderDate(siparisTarihi)) return record;
  return Object.assign({}, record, {
    TESLIM_EVRAK_NO: record.TESLIM_EVRAK_NO || 'Q1-TESLIM'
  });
}

function toTitleCase(str) {
  if (!str) return '';
  return str.split(' ').map(function(w) {
    if (!w) return '';
    return w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1).toLocaleLowerCase('tr-TR');
  }).join(' ');
}

const AMBAR_DISPLAY_NAMES = {
  'AKHİSAR': 'Akhisar (Zeytin)',
  'KOZLU YAĞ': 'Akhisar Kozlu Yağ',
};

function getAmbarDisplayName(ambar) {
  if (!ambar) return '';
  var upper = normalizeAmbarName(ambar);
  if (AMBAR_DISPLAY_NAMES[upper]) return AMBAR_DISPLAY_NAMES[upper];
  return toTitleCase(ambar);
}

// Kozlu Yağ sanal ambar sabitleri
const KOZLU_YAG_FIRMA_NO = '400';
const KOZLU_YAG_AMBAR_ADI = 'KOZLU YAĞ';
const KOZLU_YAG_GERCEK_AMBAR = 'AKHİSAR';

function isKozluYag(r) {
  return String(r.FIRMA_NUMARASI) === KOZLU_YAG_FIRMA_NO;
}

/** Ambar filtresi uygular: KOZLU YAĞ/AKHİSAR ayrışması dahil */
function filterByAmbar(data, ambarFilter) {
  if (!ambarFilter || ambarFilter === 'all') return data;
  if (!isLegacyFilteredMode()) {
    var target = normalizeAmbarName(ambarFilter);
    return data.filter(function(r) {
      var isyeriVal = firstNonEmpty(r, ['ISYERI', 'ISYERI_NO']);
      return normalizeAmbarName(isyeriVal) === target;
    });
  }
  var normFilter = normalizeAmbarName(ambarFilter);
  if (normFilter === normalizeAmbarName(KOZLU_YAG_AMBAR_ADI)) {
    // Kozlu Yağ: AKHİSAR ambarı + firma 400
    return data.filter(function(r) {
      return normalizeAmbarName(r.AMBAR) === normalizeAmbarName(KOZLU_YAG_GERCEK_AMBAR) && isKozluYag(r);
    });
  } else if (normFilter === normalizeAmbarName(KOZLU_YAG_GERCEK_AMBAR)) {
    // AKHİSAR: AKHİSAR ambarı ama firma 400 HARİÇ
    return data.filter(function(r) {
      return normalizeAmbarName(r.AMBAR) === normFilter && !isKozluYag(r);
    });
  } else {
    return data.filter(function(r) { return normalizeAmbarName(r.AMBAR) === normFilter; });
  }
}

// API'den gelen Turkce alan adlarini normalize et (mobil normalizeApiRecord ile ayni)
function normalizeApiRecord(r) {
  var firmaNo = firstNonEmpty(r, ['F\u0130RMA NUMARASI', 'F\u0130RMA NO']);
  var siparisNo = firstNonEmpty(r, ['S\u0130PAR\u0130\u015e NUMARASI', 'BELGE NO', '\u0130RSAL\u0130YE NO', 'FATURA NO']);
  var siparisMalzeme = firstNonEmpty(r, ['S\u0130PAR\u0130\u015e MALZEME', 'SATIR A\u00c7IKLAMASI', 'KOD', '\u00dcR\u00dcN \u00d6ZEL KOD', '\u00dcR\u00dcN \u00d6ZEL KOD2']);
  var miktar = parseNum(firstNonEmpty(r, ['M\u0130KTAR']));
  var satirTutari = parseNum(firstNonEmpty(r, ['SATIR TUTARI']));
  var birimFiyat = parseNum(firstNonEmpty(r, ['B\u0130R\u0130M F\u0130YAT']));
  if (!birimFiyat && miktar > 0 && satirTutari > 0) birimFiyat = satirTutari / miktar;
  var toplam = parseNum(firstNonEmpty(r, ['TOPLAM', 'SATIR TUTARI', 'KDV MATRAH']));
  var siparisTarihi = firstNonEmpty(r, ['S\u0130PAR\u0130\u015e TAR\u0130H\u0130', 'OLU\u015eTURMA TAR\u0130H\u0130', '\u0130RSAL\u0130YE TAR\u0130H\u0130', 'FATURA TAR\u0130H\u0130']);
  var teslimTarihi = firstNonEmpty(r, ['TESL\u0130M TAR\u0130H\u0130', '\u0130RSAL\u0130YE TAR\u0130H\u0130', 'FATURA TAR\u0130H\u0130']);
  var teslimEvrakNo = firstNonEmpty(r, ['TESL\u0130M EVRAK NO', '\u0130RSAL\u0130YE NO']);

  return applyQ1DeliveredOverride({
    FIRMA_NUMARASI: firmaNo,
    FIRMA_ADI: r['F\u0130RMA ADI'],
    ISYERI: firstNonEmpty(r, ['\u0130\u015e YER\u0130', '\u0130\u015eYER\u0130 NO']),
    AMBAR: firstNonEmpty(r, ['AMBAR', 'AMBAR NO']),
    TUR: firstNonEmpty(r, ['T\u00dcR', 'SATIR T\u00dcR\u00dc', '\u0130RSAL\u0130YE T\u00dcR\u00dc']),
    MALZEME_HIZMET_KODU: firstNonEmpty(r, ['MALZEME/H\u0130ZMET KODU', 'KOD']),
    MASRAF_MERKEZI: firstNonEmpty(r, ['MASRAF MERKEZ\u0130', 'MASRAF MERKEZI', '\u00d6ZEL KOD', '\u00d6ZEL KODU']),
    TALEP_NO: firstNonEmpty(r, ['TALEP NUMARASI', 'BELGE NO']),
    TALEP_EDEN: firstNonEmpty(r, ['TALEP EDEN', 'OLU\u015eTURAN']),
    TALEP_TARIHI: firstNonEmpty(r, ['TALEP TAR\u0130H\u0130', 'OLU\u015eTURMA TAR\u0130H\u0130']),
    TALEP_ONAYLAYAN: firstNonEmpty(r, ['TALEP ONAYLAYAN', 'G\u00dcNCELLEYEN']),
    TALEP_ONAY_TARIHI: firstNonEmpty(r, ['TALEP ONAY TAR\u0130H\u0130', 'G\u00dcNCELLEME TAR\u0130H\u0130']),
    TALEP_ACIKLAMA: firstNonEmpty(r, ['TALEP A\u00c7IKLAMA', 'SATIR A\u00c7IKLAMASI']),
    SIPARIS_NO: siparisNo,
    SIPARISI_ACAN: firstNonEmpty(r, ['S\u0130PAR\u0130\u015e\u0130 A\u00c7AN', 'OLU\u015eTURAN']),
    SIPARIS_TARIHI: siparisTarihi,
    SIPARIS_ONAYLAYAN: firstNonEmpty(r, ['S\u0130PAR\u0130\u015e ONAYLAYAN', 'G\u00dcNCELLEYEN']),
    SIPARIS_ONAY_TARIHI: firstNonEmpty(r, ['S\u0130PAR\u0130\u015e ONAY TAR\u0130H\u0130', 'G\u00dcNCELLEME TAR\u0130H\u0130']),
    SIPARIS_MALZEME: siparisMalzeme,
    TESLIM_EVRAK_NO: teslimEvrakNo,
    TESLIM_TARIHI: teslimTarihi,
    CARI_UNVANI: r['CAR\u0130 \u00dcNVANI'],
    TESLIM_ALAN: firstNonEmpty(r, ['TESL\u0130M ALAN', 'G\u00dcNCELLEYEN']),
    ACIKLAMA: firstNonEmpty(r, ['A\u00c7IKLAMA', 'SATIR A\u00c7IKLAMASI']),
    MIKTAR: miktar,
    BIRIM: r['B\u0130R\u0130M'] || r['SATIR T\u00dcR\u00dc'],
    ODEME_VADESI: firstNonEmpty(r, ['\u00d6DEME VADES\u0130']),
    PARA_BIRIMI: r['PARA B\u0130R\u0130M\u0130'],
    BIRIM_FIYAT: birimFiyat,
    TOPLAM: toplam,
    FATURAYI_KAYDEDEN: firstNonEmpty(r, ['FATURAYI KAYDEDEN', 'G\u00dcNCELLEYEN']),
    FATURA_KAYDETME_TARIHI: firstNonEmpty(r, ['FATURA KAYDETME TAR\u0130H\u0130', 'G\u00dcNCELLEME TAR\u0130H\u0130']),
    FATURA_TARIHI: r['FATURA TAR\u0130H\u0130'],
    FATURA_NO: r['FATURA NO'],
    // no-filter endpointten gelen ek alanlar
    IRSALIYE_NO: r['\u0130RSAL\u0130YE NO'],
    IRSALIYE_TARIHI: r['\u0130RSAL\u0130YE TAR\u0130H\u0130'],
    BELGE_NO: r['BELGE NO'],
    OZEL_KOD: r['\u00d6ZEL KOD'],
    YETKI_KODU: r['YETK\u0130 KODU'],
    IRSALIYE_TURU: r['\u0130RSAL\u0130YE T\u00dcR\u00dc'],
    CARI_KODU: r['CAR\u0130 KODU'],
    SEHIR: r['\u015eEH\u0130R'],
    ILCE: r['\u0130L\u00c7E'],
    SATIR_TURU: r['SATIR T\u00dcR\u00dc'],
    KOD: r['KOD'],
    URUN_OZEL_KODU: r['\u00dcR\u00dcN \u00d6ZEL KODU'],
    URUN_OZEL_KOD2: r['\u00dcR\u00dcN \u00d6ZEL KOD2'],
    SATIR_TUTARI: satirTutari,
    KDV_MATRAH: parseNum(r['KDV MATRAH']),
    KDV_TUTARI: parseNum(r['KDV TUTARI']),
    KUR: parseNum(r['KUR']),
    GENEL_ISKONTO: parseNum(r['GENEL \u0130SKONTO']),
    SATIR_ACIKLAMASI: r['SATIR A\u00c7IKLAMASI'],
    SEVK_ADRES_REF: r['SEVK ADRES REF'],
    AMBAR_NO: r['AMBAR NO'],
    ISYERI_NO: r['\u0130\u015eYER\u0130 NO'],
    OLUSTURAN: r['OLU\u015eTURAN'],
    OLUSTURMA_TARIHI: r['OLU\u015eTURMA TAR\u0130H\u0130'],
    GUNCELLEYEN: r['G\u00dcNCELLEYEN'],
    GUNCELLEME_TARIHI: r['G\u00dcNCELLEME TAR\u0130H\u0130'],
  });
}

function getDedupKey(r) {
  var baseKey = (r.SIPARIS_NO || '') + '|' + (r.SIPARIS_MALZEME || '') + '|' + (r.MIKTAR || '') + '|' + (r.BIRIM_FIYAT || '');
  if (baseKey !== '|||') return baseKey;

  return [
    r.FATURA_NO || '',
    r.BELGE_NO || '',
    r.IRSALIYE_NO || '',
    r.CARI_UNVANI || '',
    r.KOD || r.MALZEME_HIZMET_KODU || '',
    r.SATIR_TUTARI || r.TOPLAM || '',
    r.MIKTAR || '',
    toIsoDateString(r.FATURA_TARIHI) || toIsoDateString(r.IRSALIYE_TARIHI) || toIsoDateString(r.SIPARIS_TARIHI) || '',
  ].join('|');
}

// API'den veri cek (cacheli)
async function fetchApiRecords() {
  const now = Date.now();
  if (apiRecords.length > 0 && (now - lastApiFetch) < API_CACHE_TTL) {
    return apiRecords;
  }
  try {
    const endpoint = useNoFilterEndpoint ? '/api/Satinalma/veriler-no-filter' : '/api/Satinalma/veriler';
    const response = await fetch(SATINALMA_API_URL + endpoint, {
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) throw new Error('API error: ' + response.status);
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      apiRecords = data;
      lastApiFetch = now;
      console.log('Fetched ' + apiRecords.length + ' records from API (' + endpoint + ')');
    }
  } catch (e) {
    console.error('API fetch error:', e.message);
  }
  return apiRecords;
}

// Birlesmis verileri dondur (mobil getMergedRecords ile birebir ayni)
async function getMergedRecords() {
  const api = await fetchApiRecords();
  const normalizedApi = api.map(normalizeApiRecord);
  const combined = useNoFilterEndpoint ? normalizedApi : [...staticRecords, ...normalizedApi];
  const seen = new Set();
  return combined
    .map(function(r) {
      return Object.assign({}, r, {
        MASRAF_MERKEZI: firstNonEmpty(r, ['MASRAF_MERKEZI', 'MASRAF MERKEZI', 'MASRAF MERKEZ\u0130', 'OZEL_KOD', '\u00d6ZEL KOD', '\u00d6ZEL KODU']),
      });
    })
    .filter(function(r) {
    if (isLegacyFilteredMode() && r.AMBAR && EXCLUDED_FACTORIES.includes(normalizeAmbarName(r.AMBAR))) return false;
    var key = getDedupKey(r);
    if (!key || key === '|||') return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// groupBy - mobil ile ayni
function groupBy(data, field) {
  const groups = new Map();
  for (const r of data) {
    let key = r[field] || 'Belirsiz';
    // Tedarikçi adlarını normalize et
    if (field === 'CARI_UNVANI') {
      key = normalizeTedarikciName(key);
    }
    if (!groups.has(key)) {
      groups.set(key, { count: 0, siparisSet: new Set(), talepSet: new Set(), toplam: 0 });
    }
    const g = groups.get(key);
    g.count++;
    if (r.SIPARIS_NO) g.siparisSet.add(r.SIPARIS_NO);
    if (r.TALEP_NO) g.talepSet.add(r.TALEP_NO);
    g.toplam += parseNum(r.TOPLAM);
  }
  return groups;
}

// getAllData - DetayliRapor sayfasi icin tum kayitlari dondur
async function getAllData() {
  const records = await getMergedRecords();
  let filteredData = isLegacyFilteredMode()
    ? records.filter(function(r) { return isNonEmpty(r.TUR); })
    : [...records];
  // Tedarikçi adlarını normalize et
  filteredData = filteredData.map(function(r) {
    return Object.assign({}, r, {
      CARI_UNVANI: normalizeTedarikciName(r.CARI_UNVANI)
    });
  });
  var baseColumns = [
    'TALEP_NO','SIPARIS_NO','TESLIM_TARIHI','TESLIM_EVRAK_NO','CARI_UNVANI',
    'TOPLAM','SIPARIS_TARIHI','TALEP_EDEN','MASRAF_MERKEZI','PARA_BIRIMI',
    'TUR','TALEP_TARIHI','ISYERI','SIPARIS_ONAYLAYAN','ODEME_VADESI',
    'BIRIM_FIYAT','MIKTAR','SIPARIS_MALZEME','AMBAR','BIRIM','FATURA_NO',
    'FATURAYI_KAYDEDEN'
  ];
  var noFilterExtraColumns = [
    'FIRMA_NUMARASI','BELGE_NO','IRSALIYE_NO','IRSALIYE_TARIHI','IRSALIYE_TURU',
    'CARI_KODU','SEHIR','ILCE','SATIR_TURU','KOD','URUN_OZEL_KODU','URUN_OZEL_KOD2',
    'SATIR_TUTARI','KDV_MATRAH','KDV_TUTARI','KUR','GENEL_ISKONTO','SATIR_ACIKLAMASI',
    'SEVK_ADRES_REF','AMBAR_NO','ISYERI_NO','OLUSTURAN','OLUSTURMA_TARIHI',
    'GUNCELLEYEN','GUNCELLEME_TARIHI'
  ];
  var columns = useNoFilterEndpoint ? [...baseColumns, ...noFilterExtraColumns] : baseColumns;
  return { data: filteredData, columns: columns };
}

// getDashboardStats - mobil getDashboardData ile birebir ayni mantik
async function getDashboardStats(ambarFilter) {
  const records = await getMergedRecords();
  var filteredData = isLegacyFilteredMode()
    ? records.filter(function(r) { return isNonEmpty(r.TUR); })
    : [...records];

  filteredData = filterByAmbar(filteredData, ambarFilter);

  // Unique degerler
  var uniqueTalep = new Set(filteredData.map(function(r) { return r.TALEP_NO; }).filter(Boolean));
  var uniqueSiparis = new Set(filteredData.map(function(r) { return r.SIPARIS_NO; }).filter(Boolean));
  var uniqueTedarikci = new Set(filteredData.map(function(r) { return r.CARI_UNVANI; }).filter(Boolean));
  var uniqueTalepEden = new Set(filteredData.map(function(r) { return r.TALEP_EDEN; }).filter(Boolean));

  // Teslimat durumu
  var siparisDeliveryStatus = new Map();
  for (var i = 0; i < filteredData.length; i++) {
    var r = filteredData[i];
    if (!r.SIPARIS_NO) continue;
    var hasDelivery = r.TESLIM_EVRAK_NO && String(r.TESLIM_EVRAK_NO).trim() !== '';
    if (!siparisDeliveryStatus.has(r.SIPARIS_NO) || hasDelivery) {
      siparisDeliveryStatus.set(r.SIPARIS_NO, hasDelivery || siparisDeliveryStatus.get(r.SIPARIS_NO) || false);
    }
  }
  var teslimEdilen = 0;
  var bekleyen = 0;
  for (var val of siparisDeliveryStatus.values()) {
    if (val) teslimEdilen++;
    else bekleyen++;
  }

  // Toplam tutar (kur donusumu yok - mobil ile ayni)
  var toplamTutar = filteredData.reduce(function(sum, r) { return sum + parseNum(r.TOPLAM); }, 0);

  // Aylik trend
  var monthlyGroups = new Map();
  for (var j = 0; j < filteredData.length; j++) {
    var rec = filteredData[j];
    if (!rec.SIPARIS_TARIHI) continue;
    var date = new Date(rec.SIPARIS_TARIHI);
    var ay = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
    if (!monthlyGroups.has(ay)) { monthlyGroups.set(ay, { siparisSet: new Set(), toplam: 0 }); }
    var mg = monthlyGroups.get(ay);
    if (rec.SIPARIS_NO) mg.siparisSet.add(rec.SIPARIS_NO);
    mg.toplam += parseNum(rec.TOPLAM);
  }
  var monthlyTrend = Array.from(monthlyGroups.entries())
    .sort(function(a, b) { return b[0].localeCompare(a[0]); })
    .slice(0, 12)
    .map(function(e) { return { ay: e[0], siparisAdedi: e[1].siparisSet.size, toplamTutar: e[1].toplam }; });

  // Tedarikci dagilimi
  var tedarikciGroups = groupBy(filteredData, 'CARI_UNVANI');
  var tedarikci = Array.from(tedarikciGroups.entries())
    .map(function(e) { return { tedarikci: e[0], siparisAdedi: e[1].siparisSet.size, toplamTutar: e[1].toplam }; })
    .sort(function(a, b) { return b.toplamTutar - a.toplamTutar; });

  // Masraf merkezi
  var masrafMerkeziGroups = groupBy(filteredData, 'MASRAF_MERKEZI');
  var masrafMerkezi = Array.from(masrafMerkeziGroups.entries())
    .map(function(e) { return { masrafMerkezi: e[0], siparisAdedi: e[1].siparisSet.size, toplamTutar: e[1].toplam }; })
    .sort(function(a, b) { return b.toplamTutar - a.toplamTutar; });

  // Durum
  var durum = [
    { durum: 'Teslim Edildi', siparisAdedi: teslimEdilen },
    { durum: 'Teslim Bekliyor', siparisAdedi: bekleyen }
  ];

  // Para birimi
  var paraBirimiGroups = groupBy(filteredData, 'PARA_BIRIMI');
  var paraBirimi = Array.from(paraBirimiGroups.entries())
    .map(function(e) { return { paraBirimi: e[0] === 'TL' ? 'TRY' : e[0], kayitAdedi: e[1].count, toplamTutar: e[1].toplam }; })
    .sort(function(a, b) { return b.toplamTutar - a.toplamTutar; });

  // Odeme vadesi
  var odemeVadesiGroups = groupBy(filteredData, 'ODEME_VADESI');
  var normalizedVadesiGroups = new Map();
  for (var entry of odemeVadesiGroups.entries()) {
    var vName = entry[0]; var vData = entry[1];
    if (!vName || vName === 'Belirsiz' || vName === 'null') continue;
    var normalizedName = String(parseInt(vName, 10));
    if (isNaN(parseInt(vName, 10))) continue;
    if (normalizedVadesiGroups.has(normalizedName)) {
      var existing = normalizedVadesiGroups.get(normalizedName);
      existing.count += vData.count;
      existing.toplam += vData.toplam;
      vData.siparisSet.forEach(function(s) { existing.siparisSet.add(s); });
    } else {
      normalizedVadesiGroups.set(normalizedName, { count: vData.count, toplam: vData.toplam, siparisSet: new Set(vData.siparisSet) });
    }
  }
  var odemeVadesi = Array.from(normalizedVadesiGroups.entries())
    .map(function(e) { return { odemeVadesi: e[0] + ' G\u00fcn', siparisAdedi: e[1].siparisSet.size, toplamTutar: e[1].toplam }; })
    .sort(function(a, b) { return b.toplamTutar - a.toplamTutar; });

  // Talep eden
  var talepEdenRecords = filteredData.map(function(r) {
    return Object.assign({}, r, { TALEP_EDEN: r.TALEP_EDEN || r.SIPARISI_ACAN || null });
  });
  var talepEdenGroups = groupBy(talepEdenRecords, 'TALEP_EDEN');
  var talepEden = Array.from(talepEdenGroups.entries())
    .map(function(e) { return { talepEden: e[0], talepAdedi: e[1].talepSet.size, toplamTutar: e[1].toplam }; })
    .sort(function(a, b) { return b.toplamTutar - a.toplamTutar; });

  // Onaylayan
  var onaylayanGroups = groupBy(filteredData, 'SIPARIS_ONAYLAYAN');
  var onaylayan = Array.from(onaylayanGroups.entries())
    .map(function(e) { return { onaylayan: e[0], siparisAdedi: e[1].siparisSet.size, toplamTutar: e[1].toplam }; })
    .sort(function(a, b) { return b.toplamTutar - a.toplamTutar; });

  // Ambar dagilimi
  var ambarGroups = groupBy(filteredData, 'AMBAR');
  var ambar = Array.from(ambarGroups.entries())
    .map(function(e) { return { ambar: e[0], siparisAdedi: e[1].siparisSet.size, kayitAdedi: e[1].count, toplamTutar: e[1].toplam }; })
    .sort(function(a, b) { return b.toplamTutar - a.toplamTutar; });

  // Isyeri dagilimi
  var isyeriGroups = groupBy(filteredData, 'ISYERI');
  var isyeriArr = Array.from(isyeriGroups.entries())
    .map(function(e) { return { isyeri: e[0], siparisAdedi: e[1].siparisSet.size, kayitAdedi: e[1].count, toplamTutar: e[1].toplam }; })
    .sort(function(a, b) { return b.toplamTutar - a.toplamTutar; });

  // Tur dagilimi
  var turGroups = groupBy(filteredData, 'TUR');
  var tur = Array.from(turGroups.entries())
    .map(function(e) { return { tur: e[0], siparisAdedi: e[1].siparisSet.size, kayitAdedi: e[1].count, toplamTutar: e[1].toplam }; })
    .sort(function(a, b) { return b.toplamTutar - a.toplamTutar; });

  // Teslimat suresi
  var deliveryTimes = [];
  for (var k = 0; k < filteredData.length; k++) {
    var dr = filteredData[k];
    if (dr.SIPARIS_TARIHI && dr.TESLIM_TARIHI) {
      var siparisTarihi = new Date(dr.SIPARIS_TARIHI);
      var teslimTarihi = new Date(dr.TESLIM_TARIHI);
      if (!isNaN(siparisTarihi) && !isNaN(teslimTarihi)) {
        var diffDays = Math.round((teslimTarihi - siparisTarihi) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays < 365) deliveryTimes.push(diffDays);
      }
    }
  }
  var avgDeliveryTime = deliveryTimes.length > 0
    ? Math.round(deliveryTimes.reduce(function(a, b) { return a + b; }, 0) / deliveryTimes.length) : 0;

  var summary = {
    totalTalep: uniqueTalep.size,
    totalSiparis: uniqueSiparis.size,
    totalTeslimat: teslimEdilen,
    bekleyenTeslimat: bekleyen,
    totalTedarikci: uniqueTedarikci.size,
    totalTalepEden: uniqueTalepEden.size,
    toplamTutar: toplamTutar,
    toplamTutarTRY: toplamTutar,
    ortalamaTutar: uniqueSiparis.size > 0 ? Math.round(toplamTutar / uniqueSiparis.size) : 0
  };

  return {
    summary: summary,
    monthlyTrend: monthlyTrend,
    talepEden: talepEden,
    masrafMerkezi: masrafMerkezi,
    tedarikci: tedarikci,
    paraBirimi: paraBirimi,
    paraBirimiConverted: null,
    tur: tur,
    durum: durum,
    ambar: ambar,
    isyeri: isyeriArr,
    onaylayan: onaylayan,
    odemeVadesi: odemeVadesi,
    teslimatSuresi: { ortalamaTeslimatSuresi: avgDeliveryTime },
  };
}

// Ambar listesi
async function getAmbarList() {
  const records = await getMergedRecords();
  if (!isLegacyFilteredMode()) {
    var noFilterMap = new Map();
    for (var ni = 0; ni < records.length; ni++) {
      var nr = records[ni];
      var isyeriVal = firstNonEmpty(nr, ['ISYERI', 'ISYERI_NO']);
      if (!isNonEmpty(isyeriVal)) continue;
      var normalizedIsyeri = normalizeAmbarName(isyeriVal);
      if (!noFilterMap.has(normalizedIsyeri)) {
        var rawVal = String(isyeriVal).trim();
        noFilterMap.set(normalizedIsyeri, { ambar: rawVal, displayName: toTitleCase(rawVal) || rawVal });
      }
    }
    return Array.from(noFilterMap.values()).sort(function(a, b) {
      return (a.ambar || '').localeCompare(b.ambar || '', 'tr-TR');
    });
  }

  var normalizedMap = new Map();
  var hasKozluYag = false;
  var hasAkhisar = false;
  for (var i = 0; i < records.length; i++) {
    var r = records[i];
    if (!r.AMBAR) continue;
    if (isLegacyFilteredMode() && !isNonEmpty(r.TUR)) continue;
    if (normalizeAmbarName(r.AMBAR) === normalizeAmbarName(KOZLU_YAG_GERCEK_AMBAR) && isKozluYag(r)) {
      hasKozluYag = true;
      // AKHİSAR ambarını 400 hariç bırakmak için
      if (!normalizedMap.has(normalizeAmbarName(KOZLU_YAG_GERCEK_AMBAR))) {
        hasAkhisar = true;
        normalizedMap.set(normalizeAmbarName(KOZLU_YAG_GERCEK_AMBAR), { ambar: KOZLU_YAG_GERCEK_AMBAR, displayName: getAmbarDisplayName(KOZLU_YAG_GERCEK_AMBAR) });
      }
    } else {
      var normalized = normalizeAmbarName(r.AMBAR);
      if (normalized && !normalizedMap.has(normalized)) {
        normalizedMap.set(normalized, { ambar: r.AMBAR.trim(), displayName: getAmbarDisplayName(r.AMBAR.trim()) });
      }
    }
  }
  var list = Array.from(normalizedMap.values());
  // KOZLU YAĞ sanal ambarını ekle
  if (hasKozluYag) {
    list.push({ ambar: KOZLU_YAG_AMBAR_ADI, displayName: getAmbarDisplayName(KOZLU_YAG_AMBAR_ADI) });
  }
  return list.sort(function(a, b) { return (a.ambar || '').localeCompare(b.ambar || '', 'tr-TR'); });
}

// Fabrika karsilastirma verileri - mobil getFactoryComparisonData ile birebir ayni
async function getFactoryComparisonData() {
  var records = await getMergedRecords();
  var ambarListData = await getAmbarList();
  var comparisonData = {};

  for (var ai = 0; ai < ambarListData.length; ai++) {
    var ambarItem = ambarListData[ai];
    var normalizedAmbar = normalizeAmbarName(ambarItem.ambar);
    var preTur = isLegacyFilteredMode()
      ? records.filter(function(r) { return isNonEmpty(r.TUR); })
      : [...records];
    var filteredData = filterByAmbar(preTur, ambarItem.ambar);

    var uniqueSiparis = new Set(filteredData.map(function(r) { return r.SIPARIS_NO; }).filter(Boolean));
    var uniqueTalep = new Set(filteredData.map(function(r) { return r.TALEP_NO; }).filter(Boolean));
    var toplamTutar = filteredData.reduce(function(sum, r) { return sum + parseNum(r.TOPLAM); }, 0);

    var siparisDeliveryStatus = new Map();
    for (var fi = 0; fi < filteredData.length; fi++) {
      var fr = filteredData[fi];
      if (!fr.SIPARIS_NO) continue;
      var hasDelivery = fr.TESLIM_EVRAK_NO && String(fr.TESLIM_EVRAK_NO).trim() !== '';
      if (!siparisDeliveryStatus.has(fr.SIPARIS_NO) || hasDelivery) {
        siparisDeliveryStatus.set(fr.SIPARIS_NO, hasDelivery || siparisDeliveryStatus.get(fr.SIPARIS_NO) || false);
      }
    }
    var teslimEdilen = 0;
    var bekleyen = 0;
    for (var dv of siparisDeliveryStatus.values()) {
      if (dv) teslimEdilen++;
      else bekleyen++;
    }

    comparisonData[ambarItem.displayName || ambarItem.ambar] = {
      siparisAdedi: uniqueSiparis.size,
      talepAdedi: uniqueTalep.size,
      toplamTutar: toplamTutar,
      teslimEdilen: teslimEdilen,
      bekleyen: bekleyen,
      teslimOrani: uniqueSiparis.size > 0 ? Math.round((teslimEdilen / uniqueSiparis.size) * 100) : 0
    };
  }

  return comparisonData;
}

// Eski arayuz uyumlulugu
async function executeQuery() { return []; }
async function getColumnMapping() { return {}; }
async function getIsyeriList() {
  var records = await getMergedRecords();
  var set = new Set();
  for (var i = 0; i < records.length; i++) {
    var r = records[i];
    if (r.ISYERI && (!isLegacyFilteredMode() || isNonEmpty(r.TUR))) set.add(r.ISYERI);
  }
  return Array.from(set).map(function(isyeri) { return { isyeri: isyeri }; }).sort(function(a, b) { return (a.isyeri || '').localeCompare(b.isyeri || ''); });
}

module.exports = {
  executeQuery: executeQuery,
  getAllData: getAllData,
  getDashboardStats: getDashboardStats,
  getIsyeriList: getIsyeriList,
  getAmbarList: getAmbarList,
  getColumnMapping: getColumnMapping,
  getFactoryComparisonData: getFactoryComparisonData,
  setUseNoFilterEndpoint: setUseNoFilterEndpoint,
  toggleUseNoFilterEndpoint: toggleUseNoFilterEndpoint,
  getUseNoFilterEndpoint: getUseNoFilterEndpoint,
};
