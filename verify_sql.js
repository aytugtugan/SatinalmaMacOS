const fs = require('fs');
const path = require('path');

const base = '/Users/aytugtugan/PROJELER/SatinAlma';

function checkFile(filePath, label) {
  const code = fs.readFileSync(path.join(base, filePath), 'utf8');
  console.log(`\n=== ${label} (${filePath}) ===`);
  
  // getStaticStats delivery logic
  const staticMatch = code.match(/getStaticStats[\s\S]*?const hasDelivery = r\.(\w+)/);
  if (staticMatch) {
    console.log(`  getStaticStats delivery field: ${staticMatch[1]}`);
  }
  
  // teslimDurumSql / teslimDurum query
  const teslimMatches = code.match(/CASE WHEN.*?(\w+(?:_\w+)*)\)? IS NOT NULL.*?THEN 'Teslim Edildi'/g);
  if (teslimMatches) {
    for (const m of teslimMatches) {
      const field = m.match(/CASE WHEN.*?C\.(\w+)/);
      if (field) console.log(`  SQL teslim durum field: ${field[1]}`);
    }
  }
  
  // summary query delivery field
  const summaryMatch = code.match(/Summary.*?CASE WHEN.*?C\.(\w+)/s);
  if (summaryMatch) {
    console.log(`  Summary query field: ${summaryMatch[1]}`);
  }
  
  // mapStaticRecordToSqlFormat - check FATURAYI_KAYDEDEN
  const mapMatch = code.match(/mapStaticRecordToSqlFormat[\s\S]*?return \{([\s\S]*?)\};/);
  if (mapMatch) {
    const hasFK = mapMatch[1].includes('FATURAYI_KAYDEDEN');
    console.log(`  mapStaticRecordToSqlFormat has FATURAYI_KAYDEDEN: ${hasFK}`);
  }
  
  // getColumnNames - check FATURAYI_KAYDEDEN
  const colMatch = code.match(/columnCache\s*=\s*\{([\s\S]*?)\};/);
  if (colMatch) {
    const hasFK = colMatch[1].includes('FATURAYI_KAYDEDEN');
    console.log(`  columnCache has FATURAYI_KAYDEDEN: ${hasFK}`);
  }
  
  // Static merge delivery field
  const mergeMatches = code.match(/for \(const r of staticStats\.records\)[\s\S]*?const hasDelivery = r\.(\w+)/);
  if (mergeMatches) {
    console.log(`  Static merge delivery field: ${mergeMatches[1]}`);
  }
}

function checkMobile(filePath, label) {
  const code = fs.readFileSync(path.join(base, filePath), 'utf8');
  console.log(`\n=== ${label} (${filePath}) ===`);
  
  // getDashboardData delivery field
  const dashMatch = code.match(/getDashboardData[\s\S]*?const hasDelivery = r\.(\w+)/);
  if (dashMatch) {
    console.log(`  getDashboardData delivery field: ${dashMatch[1]}`);
  }
  
  // durum label
  const durumMatch = code.match(/durum: '(Teslim Edildi)'[\s\S]*?durum: '(\w+)'/);
  if (durumMatch) {
    console.log(`  Durum labels: "${durumMatch[1]}" / "${durumMatch[2]}"`);
  }
  
  // Beklemede check
  if (code.includes('Beklemede')) {
    console.log('  WARNING: Still contains "Beklemede" label');
  } else {
    console.log('  OK: No "Beklemede" label found');
  }
  
  // getDetayliRaporData durum
  const detayMatch = code.match(/getDetayliRaporData[\s\S]*?durum:.*?'(Teslim Edildi)'.*?'(\w[\w\s]*)'/);
  if (detayMatch) {
    console.log(`  getDetayliRaporData durum: "${detayMatch[1]}" / "${detayMatch[2]}"`);
  }
}

checkFile('GuncelDesktop/database.js', 'GuncelDesktop');
checkFile('masaustu/database.js', 'Masaustu');
checkMobile('masaustu/mobile/src/data/dataProcessor.js', 'Mobile');
