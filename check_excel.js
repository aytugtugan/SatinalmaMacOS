const XLSX = require('xlsx');
const path = require('path');

const wb = XLSX.readFile(path.join(__dirname, 'ocak.xls'));
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws);

console.log('=== Excel Kolonları ===');
console.log('Kolonlar:', Object.keys(data[0]));

// Bölüm, Fabrika, İşyeri, Ambar değerleri
console.log('\n=== Bölüm değerleri ===');
const bolumVals = [...new Set(data.map(r => r['Bölüm']))];
console.log(bolumVals);

console.log('\n=== Fabrika değerleri ===');
const fabrikaVals = [...new Set(data.map(r => r['Fabrika']))];
console.log(fabrikaVals);

console.log('\n=== İşyeri değerleri ===');
const isyeriVals = [...new Set(data.map(r => r['İşyeri']))];
console.log(isyeriVals);

console.log('\n=== Ambar değerleri ===');
const ambarVals = [...new Set(data.map(r => r['Ambar']))];
console.log(ambarVals);

console.log('\n=== Ambar Açıklaması değerleri ===');
const ambarAcikVals = [...new Set(data.map(r => r['Ambar Açıklaması']))];
console.log(ambarAcikVals);

// Tire kaydı tam haliyle
const tireRow = data.find(r => (r['Ambar Açıklaması'] || '').toUpperCase().includes('TİRE') || (r['Ambar Açıklaması'] || '').toUpperCase().includes('TIRE'));
console.log('\n=== Tire kayıt ===');
console.log(JSON.stringify(tireRow, null, 2));

// E-Fatura değerleri
console.log('\n=== E-Fatura değerleri ===');
console.log([...new Set(data.map(r => r['E-Fatura']))]);

// __EMPTY değerleri  
console.log('\n=== __EMPTY değerleri (örnek) ===');
console.log(data.slice(0,3).map(r => r['__EMPTY']));
