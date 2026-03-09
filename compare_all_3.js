const guncel = require('/Users/aytugtugan/PROJELER/SatinAlma/GuncelDesktop/ocak_2026_data.json');
const masaustu = require('/Users/aytugtugan/PROJELER/SatinAlma/masaustu/ocak_2026_data.json');
const mobile = require('/Users/aytugtugan/PROJELER/SatinAlma/masaustu/mobile/src/data/ocak_2026_data.json');

const gRecords = guncel.records.filter(r => r.TUR && r.TUR !== '');
const mRecords = masaustu.records.filter(r => r.TUR && r.TUR !== '');
const mobRecords = mobile.records.filter(r => r.TUR && r.TUR !== '');

const gTotal = gRecords.reduce((s, r) => s + (Number(r.TOPLAM) || 0), 0);
const mTotal = mRecords.reduce((s, r) => s + (Number(r.TOPLAM) || 0), 0);
const mobTotal = mobRecords.reduce((s, r) => s + (Number(r.TOPLAM) || 0), 0);

console.log('=== TÜM 3 KLASÖR KARŞILAŞTIRMASI ===');
console.log('GuncelDesktop: ' + gRecords.length + ' kayıt, ' + gTotal.toLocaleString('tr-TR') + ' TL');
console.log('masaustu:      ' + mRecords.length + ' kayıt, ' + mTotal.toLocaleString('tr-TR') + ' TL');
console.log('mobile:        ' + mobRecords.length + ' kayıt, ' + mobTotal.toLocaleString('tr-TR') + ' TL');
console.log('');
console.log('GuncelDesktop meta:', guncel.meta?.generatedAt);
console.log('masaustu meta:', masaustu.meta?.generatedAt);
console.log('mobile meta:', mobile.meta?.generatedAt);

const crypto = require('crypto');
const fs = require('fs');

const gHash = crypto.createHash('md5').update(fs.readFileSync('/Users/aytugtugan/PROJELER/SatinAlma/GuncelDesktop/ocak_2026_data.json')).digest('hex');
const mHash = crypto.createHash('md5').update(fs.readFileSync('/Users/aytugtugan/PROJELER/SatinAlma/masaustu/ocak_2026_data.json')).digest('hex');
const mobHash = crypto.createHash('md5').update(fs.readFileSync('/Users/aytugtugan/PROJELER/SatinAlma/masaustu/mobile/src/data/ocak_2026_data.json')).digest('hex');

console.log('\n=== MD5 HASH ===');
console.log('GuncelDesktop:', gHash);
console.log('masaustu:', mHash);
console.log('mobile:', mobHash);

console.log('\n=== SONUÇ ===');
if (gHash === mHash && mHash === mobHash) {
  console.log('✅ Tüm dosyalar AYNI');
} else {
  console.log('❌ Dosyalar FARKLI!');
  if (gHash !== mHash) console.log('  - GuncelDesktop ≠ masaustu');
  if (mHash !== mobHash) console.log('  - masaustu ≠ mobile');
  if (gHash !== mobHash) console.log('  - GuncelDesktop ≠ mobile');
}
