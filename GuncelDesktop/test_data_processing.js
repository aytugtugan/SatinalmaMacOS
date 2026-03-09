// GuncelDesktop veri işleme simülasyonu
// database.js'deki mantığı taklit eder

const fs = require('fs');
const path = require('path');

// Statik veri yükle
const staticDataPath = '/Users/aytugtugan/PROJELER/SatinAlma/GuncelDesktop/ocak_2026_data.json';
const staticJson = JSON.parse(fs.readFileSync(staticDataPath, 'utf8'));
const staticOcakData = staticJson.records || [];

console.log('=== GUNCEL DESKTOP VERİ İŞLEME ANALİZİ ===\n');
console.log('Toplam kayıt:', staticOcakData.length);

// TUR filtresi uygula (database.js'deki gibi)
const filteredData = staticOcakData.filter(r => r.TUR && r.TUR !== '');
console.log('TUR filtreli kayıt:', filteredData.length);

// getStaticStats fonksiyonu simülasyonu
function getStaticStats(ambarFilter) {
  let data = filteredData;
  
  if (ambarFilter && ambarFilter !== 'all') {
    data = data.filter(r => r.AMBAR && r.AMBAR.toUpperCase() === ambarFilter.toUpperCase());
  }

  // Benzersiz değerler
  const uniqueTalep = new Set(data.map(r => r.TALEP_NO).filter(Boolean));
  const uniqueSiparis = new Set(data.map(r => r.SIPARIS_NO).filter(Boolean));
  const uniqueTedarikci = new Set(data.map(r => r.CARI_UNVANI).filter(Boolean));
  const uniqueTalepEden = new Set(data.map(r => r.TALEP_EDEN).filter(Boolean));

  // Teslimat durumu - FATURAYI_KAYDEDEN dolu ise teslim edilmiş
  const siparisDeliveryStatus = new Map();
  for (const r of data) {
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

  // Para birimi toplamları
  const currencyTotals = new Map();
  for (const r of data) {
    const cur = r.PARA_BIRIMI || 'TL';
    const amount = Number(r.TOPLAM) || 0;
    currencyTotals.set(cur, (currencyTotals.get(cur) || 0) + amount);
  }

  // Gruplama fonksiyonu
  const groupBy = (field) => {
    const groups = new Map();
    for (const r of data) {
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

  return {
    totalTalep: uniqueTalep.size,
    totalSiparis: uniqueSiparis.size,
    totalTeslimat: teslimEdilen,
    bekleyenTeslimat: bekleyen,
    totalTedarikci: uniqueTedarikci.size,
    totalTalepEden: uniqueTalepEden.size,
    currencyTotals,
    tedarikciGroups: groupBy('CARI_UNVANI'),
    masrafMerkeziGroups: groupBy('MASRAF_MERKEZI'),
    talepEdenGroups: groupBy('TALEP_EDEN'),
    records: data
  };
}

// Test: Tüm veriyi al
const stats = getStaticStats('all');

console.log('\n=== ÖZET İSTATİSTİKLER ===');
console.log('Toplam Talep:', stats.totalTalep);
console.log('Toplam Sipariş:', stats.totalSiparis);
console.log('Teslim Edilen:', stats.totalTeslimat);
console.log('Teslim Bekleyen:', stats.bekleyenTeslimat);
console.log('Toplam Tedarikçi:', stats.totalTedarikci);
console.log('Toplam Talep Eden:', stats.totalTalepEden);

console.log('\n=== PARA BİRİMİ TOPLAMLARI ===');
let grandTotal = 0;
for (const [cur, amount] of stats.currencyTotals) {
  console.log(`${cur}: ${amount.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL`);
  grandTotal += amount;
}
console.log(`GENEL TOPLAM: ${grandTotal.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL`);

// mergeGroupStats simülasyonu - database.js'deki gibi
function mergeGroupStats(staticGroups, keyField) {
  const merged = new Map();
  
  for (const [key, data] of staticGroups) {
    let totalTRY = 0;
    for (const [cur, amount] of data.paraBirimi) {
      // NOT: Döviz çevirisi YAPILMIYOR - değerler zaten TL cinsinden
      totalTRY += amount;
    }
    merged.set(key, {
      siparisAdedi: data.siparisSet.size,
      talepAdedi: data.talepSet.size,
      kayitAdedi: data.count || 0,
      toplamTutar: totalTRY
    });
  }

  return Array.from(merged.entries())
    .map(([key, data]) => ({ [keyField]: key, ...data }))
    .sort((a, b) => b.toplamTutar - a.toplamTutar);
}

// Tedarikçi analizi
const tedarikci = mergeGroupStats(stats.tedarikciGroups, 'tedarikci');
console.log('\n=== TOP 10 TEDARİKÇİ ===');
tedarikci.slice(0, 10).forEach((t, i) => {
  console.log(`${i+1}. ${t.tedarikci.substring(0, 35).padEnd(35)} : ${t.toplamTutar.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL (${t.siparisAdedi} sipariş)`);
});

// Tedarikçi toplamı kontrolü
const tedTotal = tedarikci.reduce((s, t) => s + t.toplamTutar, 0);
console.log(`\nTedarikçi Toplamı: ${tedTotal.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL`);
console.log(`Genel Toplam: ${grandTotal.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL`);
console.log(`Fark: ${Math.abs(tedTotal - grandTotal).toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL`);

// Masraf merkezi analizi
const masrafMerkezi = mergeGroupStats(stats.masrafMerkeziGroups, 'masrafMerkezi');
console.log('\n=== TOP 10 MASRAF MERKEZİ ===');
masrafMerkezi.slice(0, 10).forEach((m, i) => {
  console.log(`${i+1}. ${m.masrafMerkezi.substring(0, 35).padEnd(35)} : ${m.toplamTutar.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL`);
});

const masrafTotal = masrafMerkezi.reduce((s, m) => s + m.toplamTutar, 0);
console.log(`\nMasraf Merkezi Toplamı: ${masrafTotal.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL`);

// Talep eden analizi
const talepEden = mergeGroupStats(stats.talepEdenGroups, 'talepEden');
console.log('\n=== TOP 10 TALEP EDEN ===');
talepEden.slice(0, 10).forEach((t, i) => {
  console.log(`${i+1}. ${t.talepEden.substring(0, 25).padEnd(25)} : ${t.toplamTutar.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL`);
});

const talepTotal = talepEden.reduce((s, t) => s + t.toplamTutar, 0);
console.log(`\nTalep Eden Toplamı: ${talepTotal.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL`);

// Dashboard'a gönderilecek summary simülasyonu
console.log('\n=== DASHBOARD SUMMARY (simülasyon) ===');
const summary = {
  totalTalep: stats.totalTalep,
  totalSiparis: stats.totalSiparis,
  totalTeslimat: stats.totalTeslimat,
  bekleyenTeslimat: stats.bekleyenTeslimat,
  totalTedarikci: tedarikci.length,
  totalTalepEden: stats.totalTalepEden,
  toplamTutar: grandTotal,
  toplamTutarTRY: grandTotal, // Zaten TL cinsinden
  ortalamaTutar: stats.totalSiparis > 0 ? grandTotal / stats.totalSiparis : 0
};

console.log('summary.totalSiparis:', summary.totalSiparis);
console.log('summary.toplamTutarTRY:', summary.toplamTutarTRY.toLocaleString('tr-TR', {minimumFractionDigits: 2}), 'TL');
console.log('summary.totalTedarikci:', summary.totalTedarikci);
console.log('summary.ortalamaTutar:', summary.ortalamaTutar.toLocaleString('tr-TR', {minimumFractionDigits: 2}), 'TL');

// DOĞRULAMA
console.log('\n=== DOĞRULAMA ===');
console.log('Tüm grupların toplamı eşit mi?');
console.log(`Tedarikçi: ${tedTotal === grandTotal ? '✅' : '❌'} (${tedTotal.toLocaleString('tr-TR')})`);
console.log(`Masraf M.: ${masrafTotal === grandTotal ? '✅' : '❌'} (${masrafTotal.toLocaleString('tr-TR')})`);
console.log(`Talep Eden: ${talepTotal === grandTotal ? '✅' : '❌'} (${talepTotal.toLocaleString('tr-TR')})`);
