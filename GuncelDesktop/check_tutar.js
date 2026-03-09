const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'ocak_2026_data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const records = data.records;

console.log('=== JSON VERİ ANALİZİ ===\n');

// Kimyasallar filtreleme
const kimyasallar = records.filter(r => r.AMBAR && r.AMBAR.toUpperCase().includes('KIM'));
console.log('Kimyasallar kayıt sayısı:', kimyasallar.length);

// Tunahan AK var mı?
const tunahanRecords = records.filter(r => r.CARI_UNVANI && r.CARI_UNVANI.toUpperCase().includes('TUNAHAN'));
console.log('Tunahan AK kayıtları:', tunahanRecords.length);
if (tunahanRecords.length > 0) {
  console.log('\nTunahan kayıtları:');
  for (const r of tunahanRecords) {
    console.log(`  - SIPARIS_NO: ${r.SIPARIS_NO}, CARI: ${r.CARI_UNVANI}, TOPLAM: ${r.TOPLAM}, AMBAR: ${r.AMBAR}`);
  }
}

// Tüm siparişler ve toplam tutar
const allSiparis = new Set(records.map(r => r.SIPARIS_NO).filter(Boolean));
console.log('\nToplam sipariş sayısı:', allSiparis.size);

// Toplam tutar hesaplama - tüm kayıtlar
let toplamTutar = 0;
for (const r of records) {
  toplamTutar += Number(r.TOPLAM) || 0;
}
console.log('Toplam tutar (tüm kayıtlar toplanarak):', toplamTutar.toLocaleString('tr-TR'));

// Sipariş bazında toplam hesaplama (her siparişin toplam tutarı - sadece ilk kayıt)
const siparisIlkKayit = new Map();
for (const r of records) {
  if (!r.SIPARIS_NO) continue;
  if (!siparisIlkKayit.has(r.SIPARIS_NO)) {
    siparisIlkKayit.set(r.SIPARIS_NO, Number(r.TOPLAM) || 0);
  }
}

let siparisIlkToplam = 0;
for (const toplam of siparisIlkKayit.values()) {
  siparisIlkToplam += toplam;
}
console.log('Sipariş bazında toplam (ilk kayıt):', siparisIlkToplam.toLocaleString('tr-TR'));

// Sipariş bazında max toplam
const siparisMaxKayit = new Map();
for (const r of records) {
  if (!r.SIPARIS_NO) continue;
  const toplam = Number(r.TOPLAM) || 0;
  if (!siparisMaxKayit.has(r.SIPARIS_NO) || siparisMaxKayit.get(r.SIPARIS_NO) < toplam) {
    siparisMaxKayit.set(r.SIPARIS_NO, toplam);
  }
}

let siparisMaxToplam = 0;
for (const toplam of siparisMaxKayit.values()) {
  siparisMaxToplam += toplam;
}
console.log('Sipariş bazında toplam (max kayıt):', siparisMaxToplam.toLocaleString('tr-TR'));

// GuncelDesktop'taki hesaplama mantığını simüle et
console.log('\n=== GUNCELDESKTOP MANTIK ===');

// 15,434,914 değerine ulaşmak için gerçek hesaplama ne olmalı?
// Farklı AMBAR değerlerini kontrol et
const ambarValues = new Set(records.map(r => r.AMBAR).filter(Boolean));
console.log('\nAMBAR değerleri:', Array.from(ambarValues));

// Her ambar için sipariş sayısı ve toplam tutar
console.log('\nAmbar bazında analiz:');
for (const ambar of ambarValues) {
  const ambarRecords = records.filter(r => r.AMBAR === ambar);
  const ambarSiparis = new Set(ambarRecords.map(r => r.SIPARIS_NO).filter(Boolean));
  let ambarToplam = 0;
  for (const r of ambarRecords) {
    ambarToplam += Number(r.TOPLAM) || 0;
  }
  console.log(`  ${ambar}: ${ambarSiparis.size} sipariş, ${ambarToplam.toLocaleString('tr-TR')} TL`);
}

// Boş AMBAR kaydı var mı?
const bossAmbar = records.filter(r => !r.AMBAR || r.AMBAR === '');
console.log('\nBoş AMBAR kaydı:', bossAmbar.length);

// TUR değerlerini kontrol et
const turValues = new Set(records.map(r => r.TUR).filter(Boolean));
console.log('\nTUR değerleri:', Array.from(turValues));

// TUR boş olan kayıtlar
const bosTur = records.filter(r => !r.TUR || r.TUR === '');
console.log('Boş TUR kaydı:', bosTur.length);
if (bosTur.length > 0) {
  let bosTurToplam = 0;
  for (const r of bosTur) {
    bosTurToplam += Number(r.TOPLAM) || 0;
  }
  console.log('Boş TUR kayıtlarının toplam tutarı:', bosTurToplam.toLocaleString('tr-TR'));
}

// TUR filtrelemesi ile toplam
const turluRecords = records.filter(r => r.TUR && r.TUR !== '');
let turluToplam = 0;
for (const r of turluRecords) {
  turluToplam += Number(r.TOPLAM) || 0;
}
console.log('\nTUR dolu kayıtların toplam tutarı:', turluToplam.toLocaleString('tr-TR'));

// 15,434,914 ile mevcut toplam arasındaki fark
const hedef = 15434914;
const fark = hedef - toplamTutar;
console.log('\n=== FARK ANALİZİ ===');
console.log('Hedef (15,434,914):', hedef.toLocaleString('tr-TR'));
console.log('Mevcut toplam:', toplamTutar.toLocaleString('tr-TR'));
console.log('Fark:', fark.toLocaleString('tr-TR'));

// Farka yakın kayıt var mı?
console.log('\nFarka yakın kayıtlar:');
const farkYakini = records.filter(r => {
  const toplam = Number(r.TOPLAM) || 0;
  return Math.abs(toplam - Math.abs(fark)) < 100000;
});
for (const r of farkYakini) {
  console.log(`  - SIPARIS: ${r.SIPARIS_NO}, CARI: ${r.CARI_UNVANI}, TOPLAM: ${r.TOPLAM}, AMBAR: ${r.AMBAR}`);
}
