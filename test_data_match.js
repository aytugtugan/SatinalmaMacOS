/**
 * Mobil ve Desktop analiz verilerini karşılaştır
 * Sadece statik JSON üzerinde çalışır (SQL'e gerek yok)
 */

const fs = require('fs');
const path = require('path');

// ─── VERİ YÜKLE ───────────────────────────────────────────────────────────────
const desktopJsonPath = path.join(__dirname, 'masaustu', 'ocak_2026_data.json');
const mobileJsonPath  = path.join(__dirname, 'masaustu', 'mobile', 'src', 'data', 'ocak_2026_data.json');

const desktopRaw = JSON.parse(fs.readFileSync(desktopJsonPath, 'utf8'));
const mobileRaw  = JSON.parse(fs.readFileSync(mobileJsonPath,  'utf8'));

const desktopRecords = Array.isArray(desktopRaw) ? desktopRaw : (desktopRaw.records || []);
const mobileRecords  = Array.isArray(mobileRaw)  ? mobileRaw  : (mobileRaw.records  || []);

console.log('='.repeat(60));
console.log('JSON DOSYASI KONTROLÜ');
console.log('='.repeat(60));
console.log(`Desktop JSON kayıt: ${desktopRecords.length}`);
console.log(`Mobil   JSON kayıt: ${mobileRecords.length}`);
console.log(desktopRecords.length === mobileRecords.length ? '✅ JSON kayıt sayısı EŞİT' : '⚠️  JSON kayıt sayısı FARKLI');

// ─── ORTAK HESAPLAMA FONKSİYONLARI ────────────────────────────────────────────

const EXCLUDED_FACTORIES = ['TİRE'];

function normalizeAmbar(ambar) {
  if (!ambar) return '';
  return ambar.toLocaleUpperCase('tr-TR');
}

/** Mobil dataProcessor.js mantığını taklit et */
function mobileCalc(records, ambarFilter = null) {
  // Dedup (mobil mantığı)
  const seen = new Set();
  let data = records.filter(r => {
    if (!r.TUR || r.TUR === '') return false;
    if (r.AMBAR && EXCLUDED_FACTORIES.includes(normalizeAmbar(r.AMBAR))) return false;
    const key = `${r.SIPARIS_NO || ''}|${r.SIPARIS_MALZEME || ''}|${r.MIKTAR || ''}|${r.BIRIM_FIYAT || ''}`;
    if (!key || key === '|||') return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (ambarFilter && ambarFilter !== 'all') {
    const nf = normalizeAmbar(ambarFilter);
    data = data.filter(r => normalizeAmbar(r.AMBAR) === nf);
  }

  const uniqueSiparis   = new Set(data.map(r => r.SIPARIS_NO).filter(Boolean));
  const uniqueTalep     = new Set(data.map(r => r.TALEP_NO).filter(Boolean));
  const uniqueTedarikci = new Set(data.map(r => r.CARI_UNVANI).filter(Boolean));

  const siparisDelivery = new Map();
  for (const r of data) {
    if (!r.SIPARIS_NO) continue;
    const has = !!(r.FATURAYI_KAYDEDEN && r.FATURAYI_KAYDEDEN !== '');
    siparisDelivery.set(r.SIPARIS_NO, has || siparisDelivery.get(r.SIPARIS_NO) || false);
  }
  let teslim = 0, bekle = 0;
  for (const h of siparisDelivery.values()) { if (h) teslim++; else bekle++; }

  const toplamTutar = data.reduce((s, r) => s + (Number(r.TOPLAM) || 0), 0);

  return {
    totalSiparis: uniqueSiparis.size,
    totalTalep: uniqueTalep.size,
    totalTedarikci: uniqueTedarikci.size,
    teslimEdilen: teslim,
    bekleyen: bekle,
    toplamTutar,
    records: data.length,
  };
}

/** Desktop database.js / getStaticStats mantığını taklit et (sadece statik veri) */
function desktopCalc(records, ambarFilter = null) {
  // Desktop: dedup YOK (SQL veri için dedup SQL kendisi yapıyor, statik için ayrıca yok)
  // TİRE hariç tut
  let data = records.filter(r => {
    if (!r.TUR || r.TUR === '') return false;
    if (r.AMBAR && EXCLUDED_FACTORIES.includes(normalizeAmbar(r.AMBAR))) return false;
    return true;
  });

  if (ambarFilter && ambarFilter !== 'all') {
    const nf = normalizeAmbar(ambarFilter);
    data = data.filter(r => normalizeAmbar(r.AMBAR) === nf);
  }

  const uniqueSiparis   = new Set(data.map(r => r.SIPARIS_NO).filter(Boolean));
  const uniqueTalep     = new Set(data.map(r => r.TALEP_NO).filter(Boolean));
  const uniqueTedarikci = new Set(data.map(r => r.CARI_UNVANI).filter(Boolean));

  const siparisDelivery = new Map();
  for (const r of data) {
    if (!r.SIPARIS_NO) continue;
    const has = !!(r.FATURAYI_KAYDEDEN && r.FATURAYI_KAYDEDEN !== '');
    if (!siparisDelivery.has(r.SIPARIS_NO) || has) {
      siparisDelivery.set(r.SIPARIS_NO, has || siparisDelivery.get(r.SIPARIS_NO) || false);
    }
  }
  let teslim = 0, bekle = 0;
  for (const h of siparisDelivery.values()) { if (h) teslim++; else bekle++; }

  const toplamTutar = data.reduce((s, r) => s + (Number(r.TOPLAM) || 0), 0);

  return {
    totalSiparis: uniqueSiparis.size,
    totalTalep: uniqueTalep.size,
    totalTedarikci: uniqueTedarikci.size,
    teslimEdilen: teslim,
    bekleyen: bekle,
    toplamTutar,
    records: data.length,
  };
}

// ─── AMBAR LİSTESİ ────────────────────────────────────────────────────────────
function getAmbarList(records) {
  const map = new Map();
  for (const r of records) {
    if (r.AMBAR && r.TUR && r.TUR !== '' && !EXCLUDED_FACTORIES.includes(normalizeAmbar(r.AMBAR))) {
      const norm = normalizeAmbar(r.AMBAR);
      if (!map.has(norm)) map.set(norm, r.AMBAR);
    }
  }
  return [...map.values()].sort((a, b) => a.localeCompare(b, 'tr-TR'));
}

// ─── KARŞILAŞTIR ──────────────────────────────────────────────────────────────
function compare(label, mob, dsk) {
  const match = (a, b) => a === b;
  const icon  = (a, b) => match(a, b) ? '✅' : '❌';
  const fmt   = v => typeof v === 'number' && v > 1000 ? v.toFixed(2) : String(v);

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📊 ${label}`);
  console.log('─'.repeat(60));
  console.log(`  Kayıt Sayısı   : Mobil=${mob.records}  Desktop=${dsk.records}  ${icon(mob.records, dsk.records)}`);
  console.log(`  Sipariş Adedi  : Mobil=${mob.totalSiparis}  Desktop=${dsk.totalSiparis}  ${icon(mob.totalSiparis, dsk.totalSiparis)}`);
  console.log(`  Talep Adedi    : Mobil=${mob.totalTalep}  Desktop=${dsk.totalTalep}  ${icon(mob.totalTalep, dsk.totalTalep)}`);
  console.log(`  Tedarikçi      : Mobil=${mob.totalTedarikci}  Desktop=${dsk.totalTedarikci}  ${icon(mob.totalTedarikci, dsk.totalTedarikci)}`);
  console.log(`  Teslim Edildi  : Mobil=${mob.teslimEdilen}  Desktop=${dsk.teslimEdilen}  ${icon(mob.teslimEdilen, dsk.teslimEdilen)}`);
  console.log(`  Bekleyen       : Mobil=${mob.bekleyen}  Desktop=${dsk.bekleyen}  ${icon(mob.bekleyen, dsk.bekleyen)}`);
  console.log(`  Toplam Tutar   : Mobil=${fmt(mob.toplamTutar)}  Desktop=${fmt(dsk.toplamTutar)}  ${icon(Math.round(mob.toplamTutar), Math.round(dsk.toplamTutar))}`);

  const allOk = mob.totalSiparis === dsk.totalSiparis &&
                mob.totalTalep   === dsk.totalTalep   &&
                mob.totalTedarikci === dsk.totalTedarikci &&
                mob.teslimEdilen === dsk.teslimEdilen &&
                mob.bekleyen === dsk.bekleyen &&
                Math.round(mob.toplamTutar) === Math.round(dsk.toplamTutar);

  console.log(allOk ? '\n  ✅ TÜM VERİLER UYUŞUYOR' : '\n  ❌ FARKLILIKLAR VAR');
  return allOk;
}

// ─── TESTLER ──────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(60));
console.log('STATIK VERİ ANALİZ KARŞILAŞTIRMASI (Ocak 2026)');
console.log('='.repeat(60));

let allPass = true;

// 1. Genel (tüm ambarlar)
const mobAll = mobileCalc(mobileRecords);
const dskAll = desktopCalc(desktopRecords);
if (!compare('TÜM AMBARLAR', mobAll, dskAll)) allPass = false;

// 2. Ambar bazında
const ambarList = getAmbarList(desktopRecords);
console.log(`\nAmbar listesi (${ambarList.length}): ${ambarList.join(', ')}`);

for (const ambar of ambarList) {
  const mob = mobileCalc(mobileRecords, ambar);
  const dsk = desktopCalc(desktopRecords, ambar);
  if (!compare(`AMBAR: ${ambar}`, mob, dsk)) allPass = false;
}

// ─── SONUÇ ────────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(60));
console.log(allPass
  ? '✅ SONUÇ: Mobil ve Desktop statik veriler BİREBİR AYNI'
  : '❌ SONUÇ: Farklılıklar bulundu - yukarıyı inceleyin');
console.log('='.repeat(60));

// Dedup farkı analizi
const mobileRecordsFiltered = mobileRecords.filter(r => r.TUR && r.TUR !== '' && !(r.AMBAR && EXCLUDED_FACTORIES.includes(normalizeAmbar(r.AMBAR))));
const desktopRecordsFiltered = desktopRecords.filter(r => r.TUR && r.TUR !== '' && !(r.AMBAR && EXCLUDED_FACTORIES.includes(normalizeAmbar(r.AMBAR))));

const seen = new Set();
let dedupCount = 0;
for (const r of mobileRecordsFiltered) {
  const key = `${r.SIPARIS_NO || ''}|${r.SIPARIS_MALZEME || ''}|${r.MIKTAR || ''}|${r.BIRIM_FIYAT || ''}`;
  if (key !== '|||' && seen.has(key)) dedupCount++;
  else if (key !== '|||') seen.add(key);
}

console.log(`\nℹ️  Mobil dedup kaldırılan kayıt: ${dedupCount}`);
console.log(`ℹ️  Mobil net kayıt (TİRE ve dedup sonrası): ${mobileRecordsFiltered.length - dedupCount}`);
console.log(`ℹ️  Desktop net kayıt (TİRE sonrası, dedup yok): ${desktopRecordsFiltered.length}`);
if (dedupCount > 0) {
  console.log(`\n⚠️  Desktop'ta statik veri için dedup uygulanmıyor.`);
  console.log(`   Bu ${dedupCount} kayıt farkı sipariş/talep sayılarında DEĞİL,`);
  console.log(`   toplam tutar ve kayıt sayısı metriklerinde fark yaratabilir.`);
}
