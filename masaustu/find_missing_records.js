const mobile = require('./mobile/src/data/ocak_2026_data.json');
const desktop = require('./ocak_2026_data.json');

console.log('=== EKSİK KAYIT TESPİTİ ===\n');

// Mobile'da olup Desktop'ta olmayan kayıtları bul
const mobileRecords = mobile.records.filter(r => r.TUR && r.TUR !== '');
const desktopRecords = desktop.records.filter(r => r.TUR && r.TUR !== '');

// Kayıt karşılaştırma fonksiyonu (anahtar: TALEP_NO + SIPARIS_NO + TOPLAM)
function getKey(r) {
  return `${r.TALEP_NO || ''}_${r.SIPARIS_NO || ''}_${r.TOPLAM || 0}`;
}

const desktopKeys = new Set(desktopRecords.map(getKey));
const mobileKeys = new Set(mobileRecords.map(getKey));

// Mobile'da olup Desktop'ta olmayan
const onlyMobile = mobileRecords.filter(r => !desktopKeys.has(getKey(r)));
console.log(`Mobile'da olup Desktop'ta olmayan: ${onlyMobile.length} kayıt\n`);

if (onlyMobile.length > 0) {
  let extraTotal = 0;
  console.log('Eksik kayıtlar (Desktop\'ta yok):');
  console.log('-'.repeat(120));
  for (const r of onlyMobile) {
    const amount = Number(r.TOPLAM) || 0;
    extraTotal += amount;
    console.log(`Talep: ${(r.TALEP_NO || 'N/A').padEnd(20)} | Sipariş: ${(r.SIPARIS_NO || 'N/A').padEnd(20)} | Tutar: ${amount.toLocaleString('tr-TR').padStart(15)} ${r.PARA_BIRIMI || 'TL'} | Tedarikçi: ${(r.CARI_UNVANI || 'N/A').substring(0, 30)}`);
  }
  console.log('-'.repeat(120));
  console.log(`TOPLAM EKSİK TUTAR: ${extraTotal.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL\n`);
}

// Desktop'ta olup Mobile'da olmayan
const onlyDesktop = desktopRecords.filter(r => !mobileKeys.has(getKey(r)));
console.log(`Desktop'ta olup Mobile'da olmayan: ${onlyDesktop.length} kayıt\n`);

if (onlyDesktop.length > 0) {
  let extraTotal = 0;
  console.log('Fazla kayıtlar (Mobile\'da yok):');
  console.log('-'.repeat(120));
  for (const r of onlyDesktop) {
    const amount = Number(r.TOPLAM) || 0;
    extraTotal += amount;
    console.log(`Talep: ${(r.TALEP_NO || 'N/A').padEnd(20)} | Sipariş: ${(r.SIPARIS_NO || 'N/A').padEnd(20)} | Tutar: ${amount.toLocaleString('tr-TR').padStart(15)} ${r.PARA_BIRIMI || 'TL'} | Tedarikçi: ${(r.CARI_UNVANI || 'N/A').substring(0, 30)}`);
  }
  console.log('-'.repeat(120));
  console.log(`TOPLAM FAZLA TUTAR: ${extraTotal.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL\n`);
}

// CEMRE PET firmayı ara
console.log('\n=== CEMRE PET FİRMA KONTROLÜ ===');
const mobileCemre = mobileRecords.filter(r => r.CARI_UNVANI && r.CARI_UNVANI.includes('CEMRE'));
const desktopCemre = desktopRecords.filter(r => r.CARI_UNVANI && r.CARI_UNVANI.includes('CEMRE'));

console.log(`Mobile'da CEMRE kayıt sayısı: ${mobileCemre.length}`);
console.log(`Desktop'ta CEMRE kayıt sayısı: ${desktopCemre.length}`);

if (mobileCemre.length > 0) {
  const cemreTotal = mobileCemre.reduce((s, r) => s + (Number(r.TOPLAM) || 0), 0);
  console.log(`Mobile CEMRE toplam tutar: ${cemreTotal.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL`);
}

// PET ŞİŞE masraf merkezini ara
console.log('\n=== PET ŞİŞE MASRAF MERKEZİ KONTROLÜ ===');
const mobilePet = mobileRecords.filter(r => r.MASRAF_MERKEZI && r.MASRAF_MERKEZI.includes('PET'));
const desktopPet = desktopRecords.filter(r => r.MASRAF_MERKEZI && r.MASRAF_MERKEZI.includes('PET'));

console.log(`Mobile'da PET kayıt sayısı: ${mobilePet.length}`);
console.log(`Desktop'ta PET kayıt sayısı: ${desktopPet.length}`);

if (mobilePet.length > 0) {
  const petTotal = mobilePet.reduce((s, r) => s + (Number(r.TOPLAM) || 0), 0);
  console.log(`Mobile PET toplam tutar: ${petTotal.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL`);
}

// Meta tarihlerini karşılaştır
console.log('\n=== META TARİH KARŞILAŞTIRMASI ===');
console.log('Mobile oluşturma tarihi:', mobile.meta.generatedAt);
console.log('Desktop oluşturma tarihi:', desktop.meta.generatedAt);

const mobileDate = new Date(mobile.meta.generatedAt);
const desktopDate = new Date(desktop.meta.generatedAt);

if (mobileDate > desktopDate) {
  console.log('\n⚠️ UYARI: Mobile JSON daha yeni! Desktop JSON eski!');
  console.log('Çözüm: Desktop JSON dosyasını Mobile\'daki ile değiştirin.');
} else {
  console.log('\n⚠️ UYARI: Desktop JSON daha yeni! Mobile JSON eski!');
}
