const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Excel oku
const wb = XLSX.readFile(path.join(__dirname, 'ocak.xls'));
const ws = wb.Sheets[wb.SheetNames[0]];
const excelData = XLSX.utils.sheet_to_json(ws);

console.log('=== EXCEL ANALİZİ ===');
console.log('Toplam satır:', excelData.length);

// Unique Fiş No
const uniqueFis = new Set(excelData.map(r => r['Fiş No.']).filter(Boolean));
console.log('Unique Fiş No. sayısı:', uniqueFis.size);

// Duplike fiş no'lar
const fisCounts = {};
excelData.forEach(r => {
  const f = r['Fiş No.'];
  if (f) fisCounts[f] = (fisCounts[f] || 0) + 1;
});
const dupes = Object.entries(fisCounts).filter(([k, v]) => v > 1);
if (dupes.length > 0) {
  console.log('Duplike Fiş No.lar:');
  dupes.forEach(([k, v]) => console.log('  ', k, ':', v, 'kez'));
}

// Mevcut JSON
const jsonPath = path.join(__dirname, 'masaustu/mobile/src/data/ocak_2026_data.json');
const jsonArr = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
const arr = Array.isArray(jsonArr) ? jsonArr : (jsonArr.records || []);

console.log('\n=== MEVCUT JSON ===');
console.log('Toplam satır:', arr.length);

// JSON'daki ambar dağılımı
const ambarDist = {};
arr.forEach(r => {
  const a = (r.AMBAR || 'YOK').toUpperCase();
  ambarDist[a] = (ambarDist[a] || 0) + 1;
});
console.log('Ambar dağılımı:', JSON.stringify(ambarDist, null, 2));

// JSON unique sipariş
const allSiparis = new Set(arr.map(r => r.SIPARIS_NO).filter(Boolean));
console.log('Toplam unique sipariş:', allSiparis.size);

// Gaziantep
const gaziantepJSON = arr.filter(r => (r.AMBAR || '').toUpperCase().includes('GAZ'));
const jsonGazSiparis = new Set(gaziantepJSON.map(r => r.SIPARIS_NO).filter(Boolean));
console.log('\nGaziantep kayıt:', gaziantepJSON.length);
console.log('Gaziantep unique sipariş:', jsonGazSiparis.size);

// Karşılaştır
const excelOnly = [...uniqueFis].filter(f => !jsonGazSiparis.has(f));
console.log('\n=== FARKLAR ===');
console.log('Excel\'de olup JSON\'da olmayan:', excelOnly.length);
excelOnly.forEach(f => {
  const row = excelData.find(r => r['Fiş No.'] === f);
  console.log('  +', f, '|', row['Cari Hesap Unvanı'], '|', row['Tutar']);
});

const jsonOnly = [...jsonGazSiparis].filter(s => !uniqueFis.has(s));
console.log('JSON\'da olup Excel\'de olmayan:', jsonOnly.length);
jsonOnly.forEach(s => {
  const rows = gaziantepJSON.filter(r => r.SIPARIS_NO === s);
  console.log('  -', s, '|', rows[0].CARI_UNVANI, '|', rows.map(r => r.TOPLAM).reduce((a,b) => a + (Number(b)||0), 0));
});

// Excel'deki tüm siparişleri listele
console.log('\n=== EXCEL SİPARİŞ LİSTESİ ===');
const sorted = [...uniqueFis].sort();
sorted.forEach((f, i) => {
  const row = excelData.find(r => r['Fiş No.'] === f);
  console.log(`${i+1}. ${f} | ${row['Cari Hesap Unvanı']} | ${row['Tutar']} | ${row['Ambar Açıklaması']}`);
});
