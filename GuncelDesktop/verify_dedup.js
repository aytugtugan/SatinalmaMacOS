// Verify dedup fix for Cemre Pet
const db = require('./database');

(async () => {
  try {
    console.log('=== DEDUP FIX DOGRULAMA ===\n');
    
    // Test 1: getAllData - check combined data dedup
    console.log('1. getAllData() - duplikasyon kontrolu...');
    const { data } = await db.getAllData();
    const cemreAll = data.filter(r => (r.CARI_UNVANI || '').includes('CEMRE'));
    let cemreTotal = 0;
    cemreAll.forEach(r => { cemreTotal += Number(r.TOPLAM) || 0; });
    console.log(`   Cemre Pet kayit: ${cemreAll.length}, TOPLAM: ${cemreTotal}`);
    console.log(`   Beklenen: ~2,926,292 (8 tekil kayit: 4 Ocak + 4 Subat)`);
    console.log(`   ${Math.abs(cemreTotal - 2926292) < 1 ? '✓ DOGRU' : '✗ HATALI - ' + cemreTotal}`);
    
    // Test 2: getDashboardStats - tedarikci gruplama
    console.log('\n2. getDashboardStats() - tedarikci kontrolu...');
    const stats = await db.getDashboardStats('all');
    const cemreTedarikci = (stats.tedarikci || []).find(t => (t.tedarikci || '').includes('CEMRE'));
    if (cemreTedarikci) {
      console.log(`   Cemre Pet tutar: ${cemreTedarikci.toplamTutar}`);
      console.log(`   Beklenen: ~2,926,292`);
      console.log(`   ${Math.abs(cemreTedarikci.toplamTutar - 2926292) < 1 ? '✓ DOGRU' : '✗ HATALI - ' + cemreTedarikci.toplamTutar}`);
    } else {
      console.log('   Cemre Pet tedarikci listesinde bulunamadi');
    }
    
    // Test 3: Top 5 tedarikci
    console.log('\n3. Top 10 Tedarikci (tutara gore):');
    (stats.tedarikci || []).slice(0, 10).forEach((t, i) => {
      const name = (t.tedarikci || '').substring(0, 45).padEnd(45);
      console.log(`   ${i+1}. ${name} | ${t.toplamTutar.toLocaleString('tr-TR')} TL | ${t.siparisAdedi} siparis`);
    });
    
    // Test 4: Overall summary
    console.log('\n4. Genel ozet:');
    console.log(`   Toplam Siparis: ${stats.summary.totalSiparis}`);
    console.log(`   Toplam Tutar: ${stats.summary.toplamTutar.toLocaleString('tr-TR')} TL`);
    console.log(`   Toplam Tutar TRY: ${stats.summary.toplamTutarTRY.toLocaleString('tr-TR')} TL`);
    
    console.log('\n=== TEST TAMAMLANDI ===');
    process.exit(0);
  } catch (err) {
    console.error('HATA:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
