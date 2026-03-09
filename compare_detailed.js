/**
 * GuncelDesktop vs Mobile Detaylı Karşılaştırma
 * 
 * Bu script API'den gelen verilerle birleştirme mantığını detaylı karşılaştırır
 */

const fs = require('fs');
const path = require('path');

// JSON dosyalarını yükle
const guncelData = JSON.parse(fs.readFileSync(path.join(__dirname, 'GuncelDesktop/ocak_2026_data.json'), 'utf8'));
const mobileData = JSON.parse(fs.readFileSync(path.join(__dirname, 'masaustu/mobile/src/data/ocak_2026_data.json'), 'utf8'));

const guncelRecords = guncelData.records || [];
const mobileRecords = mobileData.records || [];

console.log('=' .repeat(80));
console.log('📊 DETAYLI KARŞILAŞTIRMA RAPORU');
console.log('=' .repeat(80));

// 1. KAYIT SAYISI KARŞILAŞTIRMASI
console.log('\n📋 1. KAYIT SAYISI KARŞILAŞTIRMASI');
console.log('-'.repeat(40));
console.log(`GuncelDesktop: ${guncelRecords.length} kayıt`);
console.log(`Mobile: ${mobileRecords.length} kayıt`);
console.log(`Fark: ${Math.abs(guncelRecords.length - mobileRecords.length)}`);

// 2. TÜR FİLTRESİ
function getFilteredRecords(records) {
  return records.filter(r => r.TUR && r.TUR !== '');
}

const guncelFiltered = getFilteredRecords(guncelRecords);
const mobileFiltered = getFilteredRecords(mobileRecords);

console.log('\n📋 2. TÜR FİLTRESİ SONRASI');
console.log('-'.repeat(40));
console.log(`GuncelDesktop (TUR dolu): ${guncelFiltered.length} kayıt`);
console.log(`Mobile (TUR dolu): ${mobileFiltered.length} kayıt`);

// 3. TEK BİR KAYIT İÇİN KARŞILAŞTIRMA
function getRecordKey(r) {
  return `${r.TALEP_NO || ''}_${r.SIPARIS_NO || ''}_${r.MALZEME_HIZMET_KODU || ''}_${r.MIKTAR || ''}`;
}

// Unique key sayısı
const guncelKeys = new Set(guncelFiltered.map(getRecordKey));
const mobileKeys = new Set(mobileFiltered.map(getRecordKey));

console.log('\n📋 3. UNIQUE KEY KARŞILAŞTIRMASI');
console.log('-'.repeat(40));
console.log(`GuncelDesktop unique key: ${guncelKeys.size}`);
console.log(`Mobile unique key: ${mobileKeys.size}`);

// Farklı keyler
const onlyInGuncel = [...guncelKeys].filter(k => !mobileKeys.has(k));
const onlyInMobile = [...mobileKeys].filter(k => !guncelKeys.has(k));

console.log(`Sadece GuncelDesktop'ta: ${onlyInGuncel.length}`);
console.log(`Sadece Mobile'da: ${onlyInMobile.length}`);

// 4. TOPLAM TUTAR KARŞILAŞTIRMASI
function calculateTotals(records) {
  const totals = {
    all: 0,
    byCurrency: new Map(),
    uniqueSiparis: new Set(),
    uniqueTalep: new Set(),
    uniqueTedarikci: new Set(),
    teslimEdilen: 0,
    bekleyen: 0
  };
  
  const siparisDeliveryStatus = new Map();
  
  for (const r of records) {
    // Toplam
    totals.all += Number(r.TOPLAM) || 0;
    
    // Para birimi
    const currency = r.PARA_BIRIMI || 'TL';
    const current = totals.byCurrency.get(currency) || 0;
    totals.byCurrency.set(currency, current + (Number(r.TOPLAM) || 0));
    
    // Unique değerler
    if (r.SIPARIS_NO) totals.uniqueSiparis.add(r.SIPARIS_NO);
    if (r.TALEP_NO) totals.uniqueTalep.add(r.TALEP_NO);
    if (r.CARI_UNVANI) totals.uniqueTedarikci.add(r.CARI_UNVANI);
    
    // Teslimat durumu
    if (r.SIPARIS_NO) {
      const hasDelivery = r.FATURAYI_KAYDEDEN && r.FATURAYI_KAYDEDEN !== '';
      if (!siparisDeliveryStatus.has(r.SIPARIS_NO) || hasDelivery) {
        siparisDeliveryStatus.set(r.SIPARIS_NO, hasDelivery || siparisDeliveryStatus.get(r.SIPARIS_NO) || false);
      }
    }
  }
  
  for (const hasDelivery of siparisDeliveryStatus.values()) {
    if (hasDelivery) totals.teslimEdilen++;
    else totals.bekleyen++;
  }
  
  return totals;
}

const guncelTotals = calculateTotals(guncelFiltered);
const mobileTotals = calculateTotals(mobileFiltered);

console.log('\n📋 4. TOPLAM TUTAR KARŞILAŞTIRMASI');
console.log('-'.repeat(40));
console.log(`GuncelDesktop Toplam: ${guncelTotals.all.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL`);
console.log(`Mobile Toplam: ${mobileTotals.all.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL`);
console.log(`Fark: ${Math.abs(guncelTotals.all - mobileTotals.all).toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL`);

console.log('\n📋 5. PARA BİRİMİ DAĞILIMI');
console.log('-'.repeat(40));
console.log('GuncelDesktop:');
for (const [currency, amount] of guncelTotals.byCurrency) {
  console.log(`  ${currency}: ${amount.toLocaleString('tr-TR', {minimumFractionDigits: 2})}`);
}
console.log('Mobile:');
for (const [currency, amount] of mobileTotals.byCurrency) {
  console.log(`  ${currency}: ${amount.toLocaleString('tr-TR', {minimumFractionDigits: 2})}`);
}

console.log('\n📋 6. KPI KARŞILAŞTIRMASI');
console.log('-'.repeat(40));
console.log(`                    | GuncelDesktop | Mobile    | Fark`);
console.log(`--------------------|---------------|-----------|--------`);
console.log(`Toplam Talep        | ${guncelTotals.uniqueTalep.size.toString().padStart(13)} | ${mobileTotals.uniqueTalep.size.toString().padStart(9)} | ${(guncelTotals.uniqueTalep.size - mobileTotals.uniqueTalep.size).toString().padStart(6)}`);
console.log(`Toplam Sipariş      | ${guncelTotals.uniqueSiparis.size.toString().padStart(13)} | ${mobileTotals.uniqueSiparis.size.toString().padStart(9)} | ${(guncelTotals.uniqueSiparis.size - mobileTotals.uniqueSiparis.size).toString().padStart(6)}`);
console.log(`Toplam Tedarikçi    | ${guncelTotals.uniqueTedarikci.size.toString().padStart(13)} | ${mobileTotals.uniqueTedarikci.size.toString().padStart(9)} | ${(guncelTotals.uniqueTedarikci.size - mobileTotals.uniqueTedarikci.size).toString().padStart(6)}`);
console.log(`Teslim Edildi       | ${guncelTotals.teslimEdilen.toString().padStart(13)} | ${mobileTotals.teslimEdilen.toString().padStart(9)} | ${(guncelTotals.teslimEdilen - mobileTotals.teslimEdilen).toString().padStart(6)}`);
console.log(`Bekleyen            | ${guncelTotals.bekleyen.toString().padStart(13)} | ${mobileTotals.bekleyen.toString().padStart(9)} | ${(guncelTotals.bekleyen - mobileTotals.bekleyen).toString().padStart(6)}`);

// 7. TEDARİKÇİ BAZLI KARŞILAŞTIRMA
function getTedarikciTotals(records) {
  const groups = new Map();
  for (const r of records) {
    const key = r.CARI_UNVANI || 'Belirsiz';
    const current = groups.get(key) || { siparisSet: new Set(), toplam: 0 };
    if (r.SIPARIS_NO) current.siparisSet.add(r.SIPARIS_NO);
    current.toplam += Number(r.TOPLAM) || 0;
    groups.set(key, current);
  }
  return Array.from(groups.entries())
    .map(([name, data]) => ({ tedarikci: name, siparisAdedi: data.siparisSet.size, toplamTutar: data.toplam }))
    .sort((a, b) => b.toplamTutar - a.toplamTutar);
}

const guncelTedarikci = getTedarikciTotals(guncelFiltered);
const mobileTedarikci = getTedarikciTotals(mobileFiltered);

console.log('\n📋 7. TOP 10 TEDARİKÇİ KARŞILAŞTIRMASI');
console.log('-'.repeat(80));
console.log('GuncelDesktop Top 10:');
guncelTedarikci.slice(0, 10).forEach((t, i) => {
  console.log(`  ${i+1}. ${t.tedarikci.substring(0, 40).padEnd(40)} | ${t.toplamTutar.toLocaleString('tr-TR', {minimumFractionDigits: 2}).padStart(15)} TL`);
});

console.log('\nMobile Top 10:');
mobileTedarikci.slice(0, 10).forEach((t, i) => {
  console.log(`  ${i+1}. ${t.tedarikci.substring(0, 40).padEnd(40)} | ${t.toplamTutar.toLocaleString('tr-TR', {minimumFractionDigits: 2}).padStart(15)} TL`);
});

// 8. TEMEL FARK ANALİZİ
console.log('\n' + '=' .repeat(80));
console.log('📊 SONUÇ');
console.log('=' .repeat(80));

const toplamFark = Math.abs(guncelTotals.all - mobileTotals.all);
const tedarikciSirasi = guncelTedarikci.slice(0, 10).every((t, i) => 
  mobileTedarikci[i] && t.tedarikci === mobileTedarikci[i].tedarikci
);

if (toplamFark < 0.01 && 
    guncelTotals.uniqueSiparis.size === mobileTotals.uniqueSiparis.size &&
    guncelTotals.uniqueTedarikci.size === mobileTotals.uniqueTedarikci.size) {
  console.log('\n✅ VERİLER BİREBİR AYNI!');
  console.log('   - Toplam tutar aynı');
  console.log('   - Sipariş sayısı aynı');
  console.log('   - Tedarikçi sayısı aynı');
  console.log('   - Para birimi dağılımı aynı');
} else {
  console.log('\n❌ VERİLERDE FARK VAR!');
  if (toplamFark > 0.01) {
    console.log(`   - Toplam tutar farkı: ${toplamFark.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL`);
  }
  if (guncelTotals.uniqueSiparis.size !== mobileTotals.uniqueSiparis.size) {
    console.log(`   - Sipariş sayısı farkı: ${Math.abs(guncelTotals.uniqueSiparis.size - mobileTotals.uniqueSiparis.size)}`);
  }
}

console.log('\n📋 ÖNEMLİ NOT:');
console.log('Veriler JSON dosyasından (ocak_2026_data.json) okunuyor.');
console.log('Eğer arkadaşınız farklı veriler görüyorsa:');
console.log('  1. API\'den güncel veriler çekiliyor olabilir');
console.log('  2. Farklı bir ambar filtresi seçili olabilir');
console.log('  3. Eski bir uygulama versiyonu kullanıyor olabilir');
