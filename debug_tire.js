const d = require('./masaustu/mobile/src/data/ocak_2026_data.json');

// Tire
const tire = d.filter(r => r.AMBAR === 'Tire');
console.log('=== TIRE ===');
console.log('Kayıt:', tire.length);
console.log('ODEME_VADESI:', tire.map(r => r.ODEME_VADESI));
console.log('MASRAF_MERKEZI:', tire.map(r => r.MASRAF_MERKEZI));
console.log('PARA_BIRIMI:', tire.map(r => r.PARA_BIRIMI));
console.log('TOPLAM:', tire.map(r => r.TOPLAM));

// Bornova
const born = d.filter(r => r.AMBAR === 'Bornova');
console.log('\n=== BORNOVA ===');
console.log('Kayıt:', born.length);
console.log('MASRAF_MERKEZI:', [...new Set(born.map(r => r.MASRAF_MERKEZI))]);
console.log('ODEME_VADESI:', [...new Set(born.map(r => r.ODEME_VADESI))]);

// Tüm ODEME_VADESI
console.log('\nTüm ODEME_VADESI:', [...new Set(d.map(r => r.ODEME_VADESI))]);

// getDashboardData simülasyonu - Tire filtresi
function simulateDashboard(filteredData, label) {
  console.log('\n=== ' + label + ' Dashboard Simülasyon ===');
  
  const uniqueSiparis = new Set(filteredData.map(r => r.SIPARIS_NO).filter(Boolean));
  console.log('Unique siparis:', uniqueSiparis.size);
  
  // Teslimat durumu
  const siparisDeliveryStatus = new Map();
  for (const r of filteredData) {
    if (!r.SIPARIS_NO) continue;
    const hasDelivery = r.FATURAYI_KAYDEDEN && r.FATURAYI_KAYDEDEN !== '';
    if (!siparisDeliveryStatus.has(r.SIPARIS_NO) || hasDelivery) {
      siparisDeliveryStatus.set(r.SIPARIS_NO, hasDelivery || siparisDeliveryStatus.get(r.SIPARIS_NO) || false);
    }
  }
  let teslimEdilen = 0, bekleyen = 0;
  for (const hasDelivery of siparisDeliveryStatus.values()) {
    if (hasDelivery) teslimEdilen++;
    else bekleyen++;
  }
  console.log('Teslim:', teslimEdilen, 'Bekleyen:', bekleyen);
  
  // Aylık trend
  const monthlyGroups = new Map();
  for (const r of filteredData) {
    if (!r.SIPARIS_TARIHI) continue;
    const date = new Date(r.SIPARIS_TARIHI);
    const ay = date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0');
    if (!monthlyGroups.has(ay)) monthlyGroups.set(ay, { siparisSet: new Set(), toplam: 0 });
    const g = monthlyGroups.get(ay);
    if (r.SIPARIS_NO) g.siparisSet.add(r.SIPARIS_NO);
    g.toplam += Number(r.TOPLAM) || 0;
  }
  const trend = Array.from(monthlyGroups.entries()).sort((a,b) => b[0].localeCompare(a[0])).slice(0,12);
  console.log('Aylık trend:', trend.map(([ay, d]) => ay + ': ' + d.toplam));
  
  // Teslim durumu data
  const durumData = [
    { durum: 'Teslim Edildi', siparisAdedi: teslimEdilen },
    { durum: 'Teslim Bekliyor', siparisAdedi: bekleyen }
  ].sort((a,b) => b.siparisAdedi - a.siparisAdedi);
  console.log('Durum:', durumData);
  
  // Masraf merkezi
  const mmGroups = {};
  filteredData.forEach(r => {
    const key = r.MASRAF_MERKEZI || 'Belirsiz';
    if (!mmGroups[key]) mmGroups[key] = 0;
    mmGroups[key] += Number(r.TOPLAM) || 0;
  });
  console.log('Masraf Merkezi:', mmGroups);
  
  // Para birimi
  const pbGroups = {};
  filteredData.forEach(r => {
    const key = r.PARA_BIRIMI || 'Belirsiz';
    if (!pbGroups[key]) pbGroups[key] = 0;
    pbGroups[key] += Number(r.TOPLAM) || 0;
  });
  // Filter Belirsiz
  const pbFiltered = Object.entries(pbGroups).filter(([k,v]) => k !== 'Belirsiz');
  console.log('Para Birimi (Belirsiz hariç):', pbFiltered);
  
  // Ödeme vadesi
  const ovGroups = {};
  filteredData.forEach(r => {
    const key = r.ODEME_VADESI || 'Belirsiz';
    if (!ovGroups[key]) ovGroups[key] = 0;
    ovGroups[key] += Number(r.TOPLAM) || 0;
  });
  const ovNormalized = {};
  for (const [name, toplam] of Object.entries(ovGroups)) {
    if (!name || name === 'Belirsiz' || name === 'null') continue;
    const parsed = parseInt(name, 10);
    if (isNaN(parsed)) continue;
    const norm = String(parsed);
    ovNormalized[norm] = (ovNormalized[norm] || 0) + toplam;
  }
  console.log('Ödeme Vadesi (normalized):', ovNormalized);
  console.log('Ödeme Vadesi items:', Object.keys(ovNormalized).length);
}

simulateDashboard(tire, 'TIRE');
simulateDashboard(born, 'BORNOVA');
