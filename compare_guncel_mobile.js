// GuncelDesktop vs Mobile JSON karşılaştırması
const guncelDesktopJson = require('/Users/aytugtugan/PROJELER/SatinAlma/GuncelDesktop/ocak_2026_data.json');
const mobileJson = require('/Users/aytugtugan/PROJELER/SatinAlma/masaustu/mobile/src/data/ocak_2026_data.json');

console.log('=== GUNCEL DESKTOP vs MOBILE KARŞILAŞTIRMA ===\n');

const guncelRecords = guncelDesktopJson.records.filter(r => r.TUR && r.TUR !== '');
const mobileRecords = mobileJson.records.filter(r => r.TUR && r.TUR !== '');

// Toplam tutarlar
const guncelTotal = guncelRecords.reduce((sum, r) => sum + (Number(r.TOPLAM) || 0), 0);
const mobileTotal = mobileRecords.reduce((sum, r) => sum + (Number(r.TOPLAM) || 0), 0);

console.log('GuncelDesktop kayıt sayısı:', guncelRecords.length);
console.log('Mobile kayıt sayısı:', mobileRecords.length);
console.log('\nGuncelDesktop TOPLAM:', guncelTotal.toLocaleString('tr-TR', {minimumFractionDigits: 2}), 'TL');
console.log('Mobile TOPLAM:', mobileTotal.toLocaleString('tr-TR', {minimumFractionDigits: 2}), 'TL');
console.log('FARK:', Math.abs(guncelTotal - mobileTotal).toLocaleString('tr-TR', {minimumFractionDigits: 2}), 'TL');

// Meta bilgisi
console.log('\n=== META BİLGİSİ ===');
console.log('GuncelDesktop generatedAt:', guncelDesktopJson.meta?.generatedAt);
console.log('Mobile generatedAt:', mobileJson.meta?.generatedAt);

// Tedarikçi analizi
console.log('\n=== TEDARİKÇİ ANALİZİ ===');
const guncelTed = {};
const mobileTed = {};

for (const r of guncelRecords) {
  const ted = r.CARI_UNVANI || 'Belirsiz';
  guncelTed[ted] = (guncelTed[ted] || 0) + (Number(r.TOPLAM) || 0);
}

for (const r of mobileRecords) {
  const ted = r.CARI_UNVANI || 'Belirsiz';
  mobileTed[ted] = (mobileTed[ted] || 0) + (Number(r.TOPLAM) || 0);
}

console.log('GuncelDesktop benzersiz tedarikçi:', Object.keys(guncelTed).length);
console.log('Mobile benzersiz tedarikçi:', Object.keys(mobileTed).length);

const guncelTedList = Object.entries(guncelTed).sort((a, b) => b[1] - a[1]).slice(0, 10);
const mobileTedList = Object.entries(mobileTed).sort((a, b) => b[1] - a[1]).slice(0, 10);

console.log('\nGuncelDesktop Top 10:');
guncelTedList.forEach(([name, val], i) => {
  console.log(`  ${i+1}. ${name.substring(0, 35).padEnd(35)} : ${val.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL`);
});

console.log('\nMobile Top 10:');
mobileTedList.forEach(([name, val], i) => {
  console.log(`  ${i+1}. ${name.substring(0, 35).padEnd(35)} : ${val.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL`);
});

// Para birimi
console.log('\n=== PARA BİRİMİ ANALİZİ ===');
const guncelPara = {};
const mobilePara = {};

for (const r of guncelRecords) {
  const pb = r.PARA_BIRIMI || 'TL';
  guncelPara[pb] = (guncelPara[pb] || 0) + (Number(r.TOPLAM) || 0);
}

for (const r of mobileRecords) {
  const pb = r.PARA_BIRIMI || 'TL';
  mobilePara[pb] = (mobilePara[pb] || 0) + (Number(r.TOPLAM) || 0);
}

console.log('GuncelDesktop Para Birimi:', JSON.stringify(guncelPara));
console.log('Mobile Para Birimi:', JSON.stringify(mobilePara));

// Hash karşılaştırması
const crypto = require('crypto');
const fs = require('fs');
const guncelFile = fs.readFileSync('/Users/aytugtugan/PROJELER/SatinAlma/GuncelDesktop/ocak_2026_data.json');
const mobileFile = fs.readFileSync('/Users/aytugtugan/PROJELER/SatinAlma/masaustu/mobile/src/data/ocak_2026_data.json');

const guncelHash = crypto.createHash('md5').update(guncelFile).digest('hex');
const mobileHash = crypto.createHash('md5').update(mobileFile).digest('hex');

console.log('\n=== DOSYA HASH ===');
console.log('GuncelDesktop MD5:', guncelHash);
console.log('Mobile MD5:', mobileHash);
console.log('Dosyalar aynı mı?', guncelHash === mobileHash ? '✅ EVET' : '❌ HAYIR');

if (guncelHash !== mobileHash) {
  console.log('\n⚠️ UYARI: GuncelDesktop ve Mobile JSON dosyaları FARKLI!');
}
