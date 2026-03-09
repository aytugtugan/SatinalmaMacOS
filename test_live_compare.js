/**
 * Mobil tam davranışını simüle et:
 *  1) Statik Ocak JSON + API'den Şubat+ veri çek
 *  2) Mobil dataProcessor.js ile birebir aynı hesapla
 *  3) Desktop database.js'in SQL sorgu mantığıyla kıyasla
 *    (SQL'e bağlanmak yerine API'deki veriyi normalize ediyoruz)
 * 
 * Kullanım: node test_live_compare.js
 */

const fs   = require('fs');
const path = require('path');
const http = require('http');

const API_URL     = 'http://10.35.20.17:5055/api/Satinalma/veriler';
const STATIC_PATH = path.join(__dirname, 'masaustu', 'ocak_2026_data.json');

// ─── YARDIMCI ────────────────────────────────────────────────────────────────
const EXCLUDED = ['TİRE'];
const norm = s => s ? s.toLocaleUpperCase('tr-TR') : '';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(new Error('JSON parse hatası: ' + raw.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(new Error('Timeout')); });
  });
}

// Tam mobil normalizeApiRecord mantığı
function normalizeApiRecord(r) {
  return {
    FIRMA_NUMARASI:       r['FİRMA NUMARASI'],
    FIRMA_ADI:            r['FİRMA ADI'],
    ISYERI:               r['İŞ YERİ'],
    AMBAR:                r['AMBAR'],
    TUR:                  r['TÜR'],
    MALZEME_HIZMET_KODU: r['MALZEME/HİZMET KODU'],
    MASRAF_MERKEZI:       r['MASRAF MERKEZİ'],
    TALEP_NO:             r['TALEP NUMARASI'],
    TALEP_EDEN:           r['TALEP EDEN'],
    TALEP_TARIHI:         r['TALEP TARİHİ'],
    TALEP_ONAYLAYAN:      r['TALEP ONAYLAYAN'],
    TALEP_ONAY_TARIHI:    r['TALEP ONAY TARİHİ'],
    TALEP_ACIKLAMA:       r['TALEP AÇIKLAMA'],
    SIPARIS_NO:           r['SİPARİŞ NUMARASI'],
    SIPARISI_ACAN:        r['SİPARİŞİ AÇAN'],
    SIPARIS_TARIHI:       r['SİPARİŞ TARİHİ'],
    SIPARIS_ONAYLAYAN:    r['SİPARİŞ ONAYLAYAN'],
    SIPARIS_ONAY_TARIHI:  r['SİPARİŞ ONAY TARİHİ'],
    SIPARIS_MALZEME:      r['SİPARİŞ MALZEME'],
    TESLIM_EVRAK_NO:      r['TESLİM EVRAK NO'],
    TESLIM_TARIHI:        r['TESLİM TARİHİ'],
    CARI_UNVANI:          r['CARİ ÜNVANI'],
    TESLIM_ALAN:          r['TESLİM ALAN'],
    ACIKLAMA:             r['AÇIKLAMA'],
    MIKTAR:               r['MİKTAR'],
    BIRIM:                r['BİRİM'],
    ODEME_VADESI:         r['ÖDEME VADESİ'],
    PARA_BIRIMI:          r['PARA BİRİMİ'],
    BIRIM_FIYAT:          r['BİRİM FİYAT'],
    TOPLAM:               r['TOPLAM'],
    FATURAYI_KAYDEDEN:    r['FATURAYI KAYDEDEN'],
    FATURA_KAYDETME_TARIHI: r['FATURA KAYDETME TARİHİ'],
    FATURA_TARIHI:        r['FATURA TARİHİ'],
    FATURA_NO:            r['FATURA NO'],
  };
}

// Tam mobil getMergedRecords mantığı
function getMergedRecords(staticRecords, apiRecords) {
  const normalizedApi = apiRecords.map(normalizeApiRecord);
  const combined = [...staticRecords, ...normalizedApi];
  const seen = new Set();
  return combined.filter(r => {
    if (!r.TUR || r.TUR === '') return false;
    if (r.AMBAR && EXCLUDED.includes(norm(r.AMBAR))) return false;
    const key = `${r.SIPARIS_NO||''}|${r.SIPARIS_MALZEME||''}|${r.MIKTAR||''}|${r.BIRIM_FIYAT||''}`;
    if (key === '|||') return true;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

// Metrik hesapla
function calcStats(records, ambarFilter = null) {
  let data = records;
  if (ambarFilter && ambarFilter !== 'all') {
    const nf = norm(ambarFilter);
    data = records.filter(r => norm(r.AMBAR) === nf);
  }

  const uniqS   = new Set(data.map(r => r.SIPARIS_NO).filter(Boolean));
  const uniqT   = new Set(data.map(r => r.TALEP_NO).filter(Boolean));
  const uniqTed = new Set(data.map(r => r.CARI_UNVANI).filter(Boolean));

  const sipDel = new Map();
  for (const r of data) {
    if (!r.SIPARIS_NO) continue;
    const has = !!(r.FATURAYI_KAYDEDEN && r.FATURAYI_KAYDEDEN !== '');
    sipDel.set(r.SIPARIS_NO, has || sipDel.get(r.SIPARIS_NO) || false);
  }
  let teslim = 0, bekle = 0;
  for (const h of sipDel.values()) { if (h) teslim++; else bekle++; }

  const toplamTutar = data.reduce((s, r) => s + (Number(r.TOPLAM) || 0), 0);
  const teslimOrani = uniqS.size > 0 ? Math.round((teslim / uniqS.size) * 100) : 0;

  // Para birimi dağılımı
  const paraMap = new Map();
  for (const r of data) {
    const p = r.PARA_BIRIMI || 'TL';
    paraMap.set(p, (paraMap.get(p) || 0) + (Number(r.TOPLAM) || 0));
  }

  return {
    kayitSayisi: data.length,
    siparis:    uniqS.size,
    talep:      uniqT.size,
    tedarikci:  uniqTed.size,
    teslim,
    bekle,
    toplamTutar,
    teslimOrani,
    paraBirimi: [...paraMap.entries()].map(([p,t]) => `${p}:${Math.round(t)}`).join('  '),
  };
}

// Ambar listesi
function getAmbarList(records) {
  const m = new Map();
  for (const r of records) {
    if (r.AMBAR && !EXCLUDED.includes(norm(r.AMBAR))) m.set(norm(r.AMBAR), r.AMBAR);
  }
  return [...m.values()].sort((a, b) => a.localeCompare(b, 'tr-TR'));
}

// ─── YAZDIRMA ─────────────────────────────────────────────────────────────────
function print(label, s) {
  console.log(`\n${'─'.repeat(55)}`);
  console.log(`📊 ${label}`);
  console.log(`${'─'.repeat(55)}`);
  console.log(`  Kayıt Sayısı  : ${s.kayitSayisi}`);
  console.log(`  Sipariş       : ${s.siparis}`);
  console.log(`  Talep         : ${s.talep}`);
  console.log(`  Tedarikçi     : ${s.tedarikci}`);
  console.log(`  Teslim Edildi : ${s.teslim}  (${s.teslimOrani}%)`);
  console.log(`  Bekleyen      : ${s.bekle}`);
  console.log(`  Toplam Tutar  : ${Math.round(s.toplamTutar).toLocaleString('tr-TR')} (ham, kur dönüşümsüz)`);
  console.log(`  Para Birimi   : ${s.paraBirimi}`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Statik Ocak verisi
  const staticRaw = JSON.parse(fs.readFileSync(STATIC_PATH, 'utf8'));
  const staticRecords = Array.isArray(staticRaw) ? staticRaw : (staticRaw.records || []);
  console.log(`\n✅ Statik JSON: ${staticRecords.length} kayıt`);

  // 2. API'den Şubat+ verisi
  let apiRecords = [];
  console.log(`\n⏳ API'den veri çekiliyor: ${API_URL}`);
  try {
    const apiData = await fetchJson(API_URL);
    apiRecords = apiData?.records || (Array.isArray(apiData) ? apiData : []);
    console.log(`✅ API verisi: ${apiRecords.length} kayıt`);
  } catch (e) {
    console.error(`❌ API hatası: ${e.message}`);
    console.log('⚠️  Sadece statik JSON ile devam ediliyor...');
  }

  // 3. Mobil mantığıyla birleştir
  const merged = getMergedRecords(staticRecords, apiRecords);
  const ambars = getAmbarList(merged);

  console.log(`\n${'═'.repeat(55)}`);
  console.log(`MOBİL - API + STATİK VERİ (Gerçek Rakamlar)`);
  console.log(`Ocak statik: ${staticRecords.length}  |  API Şubat+: ${apiRecords.length}  |  Birleşik (dedup+TİRE hariç): ${merged.length}`);
  console.log(`Ambarlar: ${ambars.join(', ')}`);
  console.log(`═`.repeat(55));
  console.log(`\n👉 Bunlar uygulamada gördüğünüz rakamlar olmalı.`);
  console.log(`   Desktop (SQL) ile karşılaştırmak için uygulamayı başlatın:`);
  console.log(`   cd masaustu && npm start`);

  // Tüm ambarlar + ambar bazında
  print('TÜM AMBARLAR', calcStats(merged));
  for (const ambar of ambars) {
    print(`AMBAR: ${ambar}`, calcStats(merged, ambar));
  }

  // Aylık dağılım
  const monthMap = new Map();
  for (const r of merged) {
    if (!r.SIPARIS_TARIHI) continue;
    const d = new Date(r.SIPARIS_TARIHI);
    if (isNaN(d)) continue;
    const ay = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if (!monthMap.has(ay)) monthMap.set(ay, { kayit: 0, sipSet: new Set(), tutar: 0 });
    const g = monthMap.get(ay);
    g.kayit++;
    if (r.SIPARIS_NO) g.sipSet.add(r.SIPARIS_NO);
    g.tutar += Number(r.TOPLAM) || 0;
  }
  const months = [...monthMap.entries()].sort((a,b) => a[0].localeCompare(b[0]));
  console.log(`\n${'─'.repeat(55)}`);
  console.log(`📅 AYLIK DAĞILIM`);
  console.log(`${'─'.repeat(55)}`);
  for (const [ay, g] of months) {
    console.log(`  ${ay}  →  Sipariş: ${g.sipSet.size}  Kayıt: ${g.kayit}  Tutar: ${Math.round(g.tutar).toLocaleString('tr-TR')}`);
  }
}

main().catch(e => { console.error('HATA:', e.message); process.exit(1); });
