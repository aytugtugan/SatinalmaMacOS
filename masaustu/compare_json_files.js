const mobile = require('./mobile/src/data/ocak_2026_data.json');
const desktop = require('./ocak_2026_data.json');

console.log('=== DOSYA KARŞILAŞTIRMASI ===');
console.log('Mobile JSON kayıt sayısı:', mobile.records.length);
console.log('Desktop JSON kayıt sayısı:', desktop.records.length);

// Toplam tutarları hesapla
const mobileTotal = mobile.records.filter(r => r.TUR && r.TUR !== '').reduce((sum, r) => sum + (Number(r.TOPLAM) || 0), 0);
const desktopTotal = desktop.records.filter(r => r.TUR && r.TUR !== '').reduce((sum, r) => sum + (Number(r.TOPLAM) || 0), 0);

console.log('\n=== TOPLAM TUTARLAR ===');
console.log('Mobile TOPLAM (TUR filtreli):', mobileTotal.toLocaleString('tr-TR', {minimumFractionDigits: 2}), 'TL');
console.log('Desktop TOPLAM (TUR filtreli):', desktopTotal.toLocaleString('tr-TR', {minimumFractionDigits: 2}), 'TL');
console.log('Fark:', Math.abs(mobileTotal - desktopTotal).toLocaleString('tr-TR', {minimumFractionDigits: 2}), 'TL');

// TUR filtreli kayıt sayıları
const mobileTurRecords = mobile.records.filter(r => r.TUR && r.TUR !== '');
const desktopTurRecords = desktop.records.filter(r => r.TUR && r.TUR !== '');

console.log('\n=== TÜR FİLTRELİ KAYITLAR ===');
console.log('Mobile TUR dolu kayıt:', mobileTurRecords.length);
console.log('Desktop TUR dolu kayıt:', desktopTurRecords.length);

// Meta bilgisi
console.log('\n=== META BİLGİSİ ===');
console.log('Mobile meta:', JSON.stringify(mobile.meta, null, 2));
console.log('Desktop meta:', JSON.stringify(desktop.meta, null, 2));

// İlk kayıtı karşılaştır
console.log('\n=== İLK KAYIT KARŞILAŞTIRMASI ===');
console.log('Mobile ilk kayıt TOPLAM:', mobile.records[0].TOPLAM);
console.log('Desktop ilk kayıt TOPLAM:', desktop.records[0].TOPLAM);

// Gruplu analiz - Tedarikçiler
console.log('\n=== TEDARİKÇİ ANALİZİ ===');
const mobileTedarikci = {};
const desktopTedarikci = {};

for (const r of mobileTurRecords) {
  const ted = r.CARI_UNVANI || 'Belirsiz';
  mobileTedarikci[ted] = (mobileTedarikci[ted] || 0) + (Number(r.TOPLAM) || 0);
}

for (const r of desktopTurRecords) {
  const ted = r.CARI_UNVANI || 'Belirsiz';
  desktopTedarikci[ted] = (desktopTedarikci[ted] || 0) + (Number(r.TOPLAM) || 0);
}

const mobileTedList = Object.entries(mobileTedarikci).sort((a, b) => b[1] - a[1]).slice(0, 10);
const desktopTedList = Object.entries(desktopTedarikci).sort((a, b) => b[1] - a[1]).slice(0, 10);

console.log('\nMobile Top 10 Tedarikçi:');
mobileTedList.forEach(([name, val], i) => {
  console.log(`  ${i+1}. ${name.substring(0, 30).padEnd(30)} : ${val.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL`);
});

console.log('\nDesktop Top 10 Tedarikçi:');
desktopTedList.forEach(([name, val], i) => {
  console.log(`  ${i+1}. ${name.substring(0, 30).padEnd(30)} : ${val.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL`);
});

// Tedarikçi sayıları
const mobileTedCount = Object.keys(mobileTedarikci).length;
const desktopTedCount = Object.keys(desktopTedarikci).length;
console.log('\nMobile benzersiz tedarikçi:', mobileTedCount);
console.log('Desktop benzersiz tedarikçi:', desktopTedCount);

// Masraf merkezi
console.log('\n=== MASRAF MERKEZİ ANALİZİ ===');
const mobileMasraf = {};
const desktopMasraf = {};

for (const r of mobileTurRecords) {
  const mm = r.MASRAF_MERKEZI || 'Belirsiz';
  mobileMasraf[mm] = (mobileMasraf[mm] || 0) + (Number(r.TOPLAM) || 0);
}

for (const r of desktopTurRecords) {
  const mm = r.MASRAF_MERKEZI || 'Belirsiz';
  desktopMasraf[mm] = (desktopMasraf[mm] || 0) + (Number(r.TOPLAM) || 0);
}

const mobileMasrafList = Object.entries(mobileMasraf).sort((a, b) => b[1] - a[1]).slice(0, 10);
const desktopMasrafList = Object.entries(desktopMasraf).sort((a, b) => b[1] - a[1]).slice(0, 10);

console.log('\nMobile Top 10 Masraf Merkezi:');
mobileMasrafList.forEach(([name, val], i) => {
  console.log(`  ${i+1}. ${name.substring(0, 30).padEnd(30)} : ${val.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL`);
});

console.log('\nDesktop Top 10 Masraf Merkezi:');
desktopMasrafList.forEach(([name, val], i) => {
  console.log(`  ${i+1}. ${name.substring(0, 30).padEnd(30)} : ${val.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL`);
});

// Para birimi
console.log('\n=== PARA BİRİMİ ANALİZİ ===');
const mobilePara = {};
const desktopPara = {};

for (const r of mobileTurRecords) {
  const pb = r.PARA_BIRIMI || 'TL';
  mobilePara[pb] = (mobilePara[pb] || 0) + (Number(r.TOPLAM) || 0);
}

for (const r of desktopTurRecords) {
  const pb = r.PARA_BIRIMI || 'TL';
  desktopPara[pb] = (desktopPara[pb] || 0) + (Number(r.TOPLAM) || 0);
}

console.log('Mobile Para Birimi Dağılımı:', mobilePara);
console.log('Desktop Para Birimi Dağılımı:', desktopPara);

// Dosya karşılaştırması - checksumlar
const crypto = require('crypto');
const fs = require('fs');
const mobileFile = fs.readFileSync('./mobile/src/data/ocak_2026_data.json');
const desktopFile = fs.readFileSync('./ocak_2026_data.json');

const mobileHash = crypto.createHash('md5').update(mobileFile).digest('hex');
const desktopHash = crypto.createHash('md5').update(desktopFile).digest('hex');

console.log('\n=== DOSYA HASH KARŞILAŞTIRMASI ===');
console.log('Mobile JSON MD5:', mobileHash);
console.log('Desktop JSON MD5:', desktopHash);
console.log('Dosyalar aynı mı?', mobileHash === desktopHash ? 'EVET' : 'HAYIR');
