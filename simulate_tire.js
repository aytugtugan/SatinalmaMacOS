// Tire seçildiğinde tam olarak ne oluyor simüle et
const d = require('./masaustu/mobile/src/data/ocak_2026_data.json');

// normalizeAmbarName simülasyonu
function normalizeAmbarName(ambar) {
  if (!ambar) return '';
  return ambar.toLocaleUpperCase('tr-TR');
}

// groupBy simülasyonu
function groupBy(data, field) {
  const groups = new Map();
  for (const r of data) {
    const key = r[field] || 'Belirsiz';
    if (!groups.has(key)) {
      groups.set(key, { count: 0, siparisSet: new Set(), talepSet: new Set(), toplam: 0 });
    }
    const g = groups.get(key);
    g.count++;
    if (r.SIPARIS_NO) g.siparisSet.add(r.SIPARIS_NO);
    if (r.TALEP_NO) g.talepSet.add(r.TALEP_NO);
    g.toplam += Number(r.TOPLAM) || 0;
  }
  return groups;
}

const ambarFilter = 'TİRE'; // ambarList'ten gelen uppercase
const normalizedFilter = normalizeAmbarName(ambarFilter);
const filteredData = d.filter(r => r.TUR && r.TUR !== '')
  .filter(r => normalizeAmbarName(r.AMBAR) === normalizedFilter);

console.log('Filtered data count:', filteredData.length);

if (filteredData.length === 0) {
  console.log('HİÇ VERİ YOK - Bu crash sebebi olabilir!');
  process.exit(0);
}

// Dashboard hesaplamaları
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

// Aylık trend
const monthlyGroups = new Map();
for (const r of filteredData) {
  if (!r.SIPARIS_TARIHI) continue;
  const date = new Date(r.SIPARIS_TARIHI);
  const ay = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
  if (!monthlyGroups.has(ay)) monthlyGroups.set(ay, { siparisSet: new Set(), toplam: 0 });
  const g = monthlyGroups.get(ay);
  if (r.SIPARIS_NO) g.siparisSet.add(r.SIPARIS_NO);
  g.toplam += Number(r.TOPLAM) || 0;
}
const monthlyTrend = Array.from(monthlyGroups.entries())
  .sort((a,b) => b[0].localeCompare(a[0])).slice(0,12)
  .map(([ay, data]) => ({ ay, siparisAdedi: data.siparisSet.size, toplamTutar: data.toplam }));

// Toplam tutar
const toplamTutar = filteredData.reduce((sum, r) => sum + (Number(r.TOPLAM) || 0), 0);

// Masraf merkezi
const masrafMerkeziGroups = groupBy(filteredData, 'MASRAF_MERKEZI');
const masrafMerkezi = Array.from(masrafMerkeziGroups.entries())
  .map(([name, data]) => ({ masrafMerkezi: name, siparisAdedi: data.siparisSet.size, toplamTutar: data.toplam }));

// Tedarikçi
const tedarikciGroups = groupBy(filteredData, 'CARI_UNVANI');
const tedarikci = Array.from(tedarikciGroups.entries())
  .map(([name, data]) => ({ tedarikci: name, siparisAdedi: data.siparisSet.size, toplamTutar: data.toplam }));

// Para birimi
const paraBirimiGroups = groupBy(filteredData, 'PARA_BIRIMI');
const paraBirimi = Array.from(paraBirimiGroups.entries())
  .map(([name, data]) => ({ paraBirimi: name === 'TL' ? 'TRY' : name, toplamTutar: data.toplam }));

// Ödeme vadesi
const odemeVadesiGroups = groupBy(filteredData, 'ODEME_VADESI');
const normalizedVadesiGroups = new Map();
for (const [name, data] of odemeVadesiGroups.entries()) {
  if (!name || name === 'Belirsiz' || name === 'null') continue;
  const parsed = parseInt(name, 10);
  if (isNaN(parsed)) continue;
  const norm = String(parsed);
  if (normalizedVadesiGroups.has(norm)) {
    const existing = normalizedVadesiGroups.get(norm);
    existing.count += data.count;
    existing.toplam += data.toplam;
    data.siparisSet.forEach(s => existing.siparisSet.add(s));
  } else {
    normalizedVadesiGroups.set(norm, { count: data.count, toplam: data.toplam, siparisSet: new Set(data.siparisSet) });
  }
}
const odemeVadesi = Array.from(normalizedVadesiGroups.entries())
  .map(([name, data]) => ({ odemeVadesi: name + ' Gün', siparisAdedi: data.siparisSet.size, toplamTutar: data.toplam }));

// Durum data
const durumList = [
  { durum: 'Teslim Edildi', siparisAdedi: teslimEdilen },
  { durum: 'Teslim Bekliyor', siparisAdedi: bekleyen }
];

// Talep eden
const talepEdenGroups = groupBy(filteredData, 'TALEP_EDEN');
const talepEden = Array.from(talepEdenGroups.entries())
  .map(([name, data]) => ({ talepEden: name, toplamTutar: data.toplam }));

// Teslimat süresi
const deliveryTimes = [];
for (const r of filteredData) {
  if (r.SIPARIS_TARIHI && r.TESLIM_TARIHI) {
    const st = new Date(r.SIPARIS_TARIHI);
    const tt = new Date(r.TESLIM_TARIHI);
    if (!isNaN(st) && !isNaN(tt)) {
      const diff = Math.round((tt - st) / (1000*60*60*24));
      if (diff >= 0 && diff < 365) deliveryTimes.push(diff);
    }
  }
}
const avgDeliveryTime = deliveryTimes.length > 0 
  ? Math.round(deliveryTimes.reduce((a,b)=>a+b,0) / deliveryTimes.length) : 0;

console.log('\n=== DASHBOARD DATA (TİRE) ===');
console.log('summary:', JSON.stringify({
  totalSiparis: uniqueSiparis.size,
  toplamTutar,
  totalTeslimat: teslimEdilen,
  bekleyenTeslimat: bekleyen,
}));
console.log('monthlyTrend:', JSON.stringify(monthlyTrend));
console.log('durumList:', JSON.stringify(durumList));
console.log('masrafMerkezi:', JSON.stringify(masrafMerkezi));
console.log('paraBirimi:', JSON.stringify(paraBirimi));
console.log('odemeVadesi:', JSON.stringify(odemeVadesi));
console.log('tedarikci:', JSON.stringify(tedarikci));
console.log('talepEden:', JSON.stringify(talepEden));
console.log('teslimatSuresi:', avgDeliveryTime);

// Şimdi DashboardScreen'deki data transformları simüle et
console.log('\n=== CHART DATA (DashboardScreen) ===');

const trendData = (monthlyTrend || []).slice(0,12).reverse().map(item => ({
  name: item.ay, value: item.toplamTutar || 0,
}));
console.log('trendData:', JSON.stringify(trendData));
console.log('trendData empty?', trendData.length === 0);

const durumData = durumList.slice().sort((a,b) => (b.siparisAdedi||0) - (a.siparisAdedi||0))
  .map(item => ({ name: item.durum, value: item.siparisAdedi || 0 }));
console.log('durumData:', JSON.stringify(durumData));

// Masraf merkezi - Belirsiz hariç
const masrafMerkeziData = masrafMerkezi
  .filter(item => item.masrafMerkezi && item.masrafMerkezi !== 'Belirsiz')
  .sort((a,b) => (b.toplamTutar||0) - (a.toplamTutar||0))
  .slice(0,8)
  .map(item => ({ name: (item.masrafMerkezi || '').substring(0,20), value: item.toplamTutar || 0 }));
console.log('masrafMerkeziData:', JSON.stringify(masrafMerkeziData));

const tedarikciData = tedarikci.sort((a,b) => (b.toplamTutar||0)-(a.toplamTutar||0))
  .slice(0,5).map(item => ({ name: (item.tedarikci||'').substring(0,20), value: item.toplamTutar || 0 }));
console.log('tedarikciData:', JSON.stringify(tedarikciData));

const paraBirimiData = paraBirimi
  .filter(item => item.paraBirimi && item.paraBirimi !== 'Belirsiz')
  .sort((a,b) => (b.toplamTutar||0)-(a.toplamTutar||0))
  .map(item => ({ name: item.paraBirimi, value: item.toplamTutar || 0 }));
console.log('paraBirimiData:', JSON.stringify(paraBirimiData));

console.log('odemeVadesiData:', JSON.stringify(odemeVadesi));

console.log('\n=== POTENTIAL ISSUES ===');
console.log('Any NaN values?');
[trendData, durumData, masrafMerkeziData, tedarikciData, paraBirimiData].forEach((arr, i) => {
  const names = ['trend','durum','masrafMerkezi','tedarikci','paraBirimi'];
  arr.forEach((item, j) => {
    if (isNaN(item.value) || item.value === undefined || item.value === null) {
      console.log('  NaN/undefined/null in', names[i], 'index', j, JSON.stringify(item));
    }
    if (typeof item.name !== 'string') {
      console.log('  non-string name in', names[i], 'index', j, 'name:', item.name, typeof item.name);
    }
  });
});
