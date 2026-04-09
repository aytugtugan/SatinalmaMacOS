/**
 * Desktop ve Mobil uygulama verilerini karşılaştırma aracı
 * Usage: node compare_desktop_mobile.js
 */

const fs = require('fs');
const path = require('path');

// Desktop database module
const database = require('./masaustu/database.js');

// Mobil dataProcessor'den verileri al (Node.js'te kullanamazız direkt, simüle edelim)
// Bunun yerine statik JSON dosyalarını karşılaştıralım
const staticDataPath = path.join(__dirname, './masaustu/ocak_2026_data.json');
const mobileStaticDataPath = path.join(__dirname, './masaustu/mobile/src/data/ocak_2026_data.json');

console.log('='.repeat(80));
console.log('DESKTOP ↔ MOBİL VERİ KARŞILAŞTIRMASI');
console.log('='.repeat(80));
console.log('');

// 1. Statik JSON dosyalarının aynı olup olmadığını kontrol et
console.log('📋 ADIM 1: Statik JSON dosyaları kontrol ediliyor...\n');

try {
  const desktopStatic = JSON.parse(fs.readFileSync(staticDataPath, 'utf8'));
  const mobileStatic = JSON.parse(fs.readFileSync(mobileStaticDataPath, 'utf8'));
  
  const desktopRecords = desktopStatic.records || desktopStatic;
  const mobileRecords = mobileStatic.records || mobileStatic;
  
  console.log(`   Desktop JSON records: ${Array.isArray(desktopRecords) ? desktopRecords.length : 0}`);
  console.log(`   Mobile JSON records:  ${Array.isArray(mobileRecords) ? mobileRecords.length : 0}`);
  
  if (JSON.stringify(desktopRecords) === JSON.stringify(mobileRecords)) {
    console.log('   ✅ Statik JSON dosyaları AYNI\n');
  } else {
    console.log('   ⚠️  Statik JSON dosyaları FARKLI\n');
  }
} catch (e) {
  console.error(`   ❌ JSON dosyası okunamadı: ${e.message}\n`);
}

// 2. Desktop SQL verileri kontrol et
console.log('📊 ADIM 2: Desktop Database SQL verileri alınıyor...\n');

async function compareData() {
  try {
    // Desktop all data
    const allData = await database.getAllData();
    console.log(`   ✅ Toplam kayıt: ${allData.length}`);
    console.log(`   ✅ Statik Ocak 2026: ${allData.filter(r => {
      if (!r.SIPARIS_TARIHI) return true;
      const d = new Date(r.SIPARIS_TARIHI);
      return d.getFullYear() === 2026 && d.getMonth() === 0;
    }).length}`);
    
    // Get dashboard stats
    console.log('\n   📈 Tüm veri için KPI (all ambars):');
    const dashStats = await database.getDashboardStats(null);
    console.log(`      • Toplam Talep: ${dashStats.summary.totalTalep}`);
    console.log(`      • Toplam Sipariş: ${dashStats.summary.totalSiparis}`);
    console.log(`      • Toplam Harcama: ${dashStats.summary.toplamTutar.toFixed(2)} TRY`);
    console.log(`      • Tedarikçi Sayısı: ${dashStats.summary.totalTedarikci}`);
    
    // Get factory comparison
    console.log('\n   🏭 Fabrika Karşılaştırması:');
    const factoryComparison = await database.getFactoryComparisonData();
    const ambars = Object.keys(factoryComparison).sort();
    console.log(`      Fabrika Sayısı: ${ambars.length}\n`);
    
    for (const ambar of ambars.slice(0, 5)) {
      const data = factoryComparison[ambar];
      console.log(`      ${ambar}:`);
      console.log(`         - Sipariş: ${data.siparisAdedi}`);
      console.log(`         - Talep: ${data.talepAdedi}`);
      console.log(`         - Tutar: ${data.toplamTutar.toFixed(2)} TRY`);
      console.log(`         - Teslim Oranı: %${data.teslimOrani}`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Karşılaştırma tamamlandı. Yukarıdaki numaraları mobil app\'tan birebir eşleyin.');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error(`❌ Hata: ${error.message}`);
  } finally {
    process.exit(0);
  }
}

compareData();
