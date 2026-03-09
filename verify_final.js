// Quick verify - final JSON data matches expectations
const fs = require('fs');
const path = require('path');

const json = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'masaustu/mobile/src/data/ocak_2026_data.json'), 'utf-8'
));
const arr = Array.isArray(json) ? json : (json.records || []);

console.log('=== Final Doğrulama ===');
console.log('Toplam kayıt:', arr.length);

const uniqueSiparis = new Set(arr.map(r => r.SIPARIS_NO).filter(Boolean));
console.log('Unique sipariş:', uniqueSiparis.size);

// Ambar dağılımı
const ambarDist = {};
const ambarSiparis = {};
arr.forEach(r => {
  const a = (r.AMBAR || 'YOK').toUpperCase();
  ambarDist[a] = (ambarDist[a] || 0) + 1;
  if (!ambarSiparis[a]) ambarSiparis[a] = new Set();
  if (r.SIPARIS_NO) ambarSiparis[a].add(r.SIPARIS_NO);
});
console.log('\nAmbar dağılımı:');
Object.entries(ambarDist).forEach(([ambar, cnt]) => {
  console.log(`  ${ambar}: ${cnt} kayıt, ${ambarSiparis[ambar].size} unique sipariş`);
});

// Excel karşılaştırma
const XLSX = require('xlsx');
const wb = XLSX.readFile(path.join(__dirname, 'ocak.xls'));
const ws = wb.Sheets[wb.SheetNames[0]];
const excelData = XLSX.utils.sheet_to_json(ws);
const excelSiparis = new Set(excelData.map(r => r['Fiş No.']).filter(Boolean));

const jsonSiparis = new Set(arr.map(r => r.SIPARIS_NO).filter(Boolean));
const missing = [...excelSiparis].filter(s => !jsonSiparis.has(s));
console.log('\nExcel sipariş sayısı:', excelSiparis.size);
console.log('JSON\'da eksik Excel sipariş:', missing.length);
if (missing.length > 0) missing.forEach(s => console.log('  !', s));

// Test kayıtlarını kontrol
const testRecords = arr.filter(r => r.SIPARIS_NO === 'TESTKURUMSOFT' || r.SIPARIS_NO === '00000001');
console.log('Test kayıtları:', testRecords.length, testRecords.length > 0 ? '(UYARI: Test kayıtları hala var!)' : '(Temiz)');

// dataProcessor.js uyumluluğu
console.log('\n=== dataProcessor.js Uyumluluğu ===');
console.log('Array.isArray:', Array.isArray(json));
console.log('İlk kayıt alanları:', arr[0] ? Object.keys(arr[0]).join(', ') : 'BOŞ');
