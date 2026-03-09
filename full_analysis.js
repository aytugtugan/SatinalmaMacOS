// Tam analiz scripti
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// 1. Excel oku
const wb = XLSX.readFile(path.join(__dirname, 'ocak.xls'));
const ws = wb.Sheets[wb.SheetNames[0]];
const excelData = XLSX.utils.sheet_to_json(ws);

console.log('=== EXCEL ===');
console.log('Satır:', excelData.length);
console.log('Kolonlar:', Object.keys(excelData[0]).join(', '));

// Excel'deki ambar dağılımı
const excelAmbar = {};
excelData.forEach(r => {
  const a = r['Ambar Açıklaması'] || 'YOK';
  excelAmbar[a] = (excelAmbar[a] || 0) + 1;
});
console.log('Ambar dağılımı:', JSON.stringify(excelAmbar));

// Unique Fiş No
const uniqueFis = new Set(excelData.map(r => r['Fiş No.']).filter(Boolean));
console.log('Unique sipariş:', uniqueFis.size);

// Excel tarih aralığı
function excelDateToDate(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const epoch = new Date(Date.UTC(1899, 11, 30));
  return new Date(epoch.getTime() + serial * 86400000);
}

const dates = excelData.map(r => excelDateToDate(r['Tarih'])).filter(Boolean).sort((a,b) => a-b);
console.log('Tarih aralığı:', dates[0]?.toISOString().split('T')[0], '-', dates[dates.length-1]?.toISOString().split('T')[0]);

// Toplam tutar
const excelToplam = excelData.reduce((s, r) => s + (Number(r['Tutar']) || 0), 0);
console.log('Toplam tutar:', excelToplam.toLocaleString('tr-TR'));

// 2. Mevcut JSON oku
console.log('\n=== MEVCUT JSON ===');
const jsonPath = path.join(__dirname, 'masaustu/mobile/src/data/ocak_2026_data.json');
const jsonArr = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
const arr = Array.isArray(jsonArr) ? jsonArr : (jsonArr.records || []);
console.log('Toplam kayıt:', arr.length);

// Ambar dağılımı
const jsonAmbar = {};
arr.forEach(r => {
  const a = (r.AMBAR || 'YOK');
  jsonAmbar[a] = (jsonAmbar[a] || 0) + 1;
});
console.log('Ambar dağılımı:', JSON.stringify(jsonAmbar));

// Unique sipariş
const jsonSiparis = new Set(arr.map(r => r.SIPARIS_NO).filter(Boolean));
console.log('Unique sipariş:', jsonSiparis.size);

// JSON tarih aralığı
const jsonDates = arr.map(r => r.SIPARIS_TARIHI ? new Date(r.SIPARIS_TARIHI) : null).filter(Boolean).sort((a,b) => a-b);
console.log('Tarih aralığı:', jsonDates[0]?.toISOString().split('T')[0], '-', jsonDates[jsonDates.length-1]?.toISOString().split('T')[0]);

// Şubat+ kayıt var mı JSONdda?
const subatRecords = arr.filter(r => {
  if (!r.SIPARIS_TARIHI) return false;
  return new Date(r.SIPARIS_TARIHI) >= new Date('2026-02-01');
});
console.log('Şubat+ kayıt (olmamalı!):', subatRecords.length);
if (subatRecords.length > 0) {
  subatRecords.slice(0,5).forEach(r => {
    console.log('  !', r.SIPARIS_NO, r.SIPARIS_TARIHI, r.AMBAR);
  });
}

// 3. Excel-JSON karşılaştır
console.log('\n=== KARŞILAŞTIRMA ===');
const excelInJSON = [...uniqueFis].filter(f => jsonSiparis.has(f));
const excelNotInJSON = [...uniqueFis].filter(f => !jsonSiparis.has(f));
console.log('Excel -> JSON bulundu:', excelInJSON.length);
console.log('Excel -> JSON eksik:', excelNotInJSON.length);
excelNotInJSON.forEach(s => {
  const row = excelData.find(r => r['Fiş No.'] === s);
  console.log('  EKSIK:', s, '|', row['Cari Hesap Unvanı'], '|', row['Tutar'], '|', row['Ambar Açıklaması']);
});

// JSON'daki Gaziantep siparişlerinden Excel'de olmayanlar
const gazJSON = arr.filter(r => (r.AMBAR || '').toUpperCase().includes('GAZ'));
const gazJSONSip = new Set(gazJSON.map(r => r.SIPARIS_NO).filter(Boolean));
const jsonNotInExcel = [...gazJSONSip].filter(s => !uniqueFis.has(s));
console.log('\nJSON Gaziantep -> Excel eksik:', jsonNotInExcel.length);
jsonNotInExcel.forEach(s => {
  const row = gazJSON.find(r => r.SIPARIS_NO === s);
  console.log('  FAZLA:', s, '|', row.CARI_UNVANI, '|', row.TOPLAM);
});

// FATURAYI_KAYDEDEN durumu
const withFatura = arr.filter(r => r.FATURAYI_KAYDEDEN && r.FATURAYI_KAYDEDEN !== '');
console.log('\n=== TESLİMAT DURUMU ===');
console.log('FATURAYI_KAYDEDEN dolu:', withFatura.length);
console.log('FATURAYI_KAYDEDEN boş:', arr.length - withFatura.length);
console.log('Ocak kayıtlarının tamamı teslim edildi olarak işaretlenmeli!');
