const data = require('./ocak_2026_data.json');
const records = data.records || [];

// Cemre Pet kayitlarini filtrele
const cemre = records.filter(r => (r.CARI_UNVANI || '').includes('CEMRE'));
console.log('=== CEMRE PET KAYITLARI (Statik Ocak JSON) ===');
console.log('Kayit sayisi:', cemre.length);
let total = 0;
cemre.forEach((r, i) => {
  const toplam = Number(r.TOPLAM) || 0;
  total += toplam;
  console.log(`  [${i+1}] MALZEME: ${r.SIPARIS_MALZEME}`);
  console.log(`       MIKTAR: ${r.MIKTAR}, BIRIM_FIYAT: ${r.BIRIM_FIYAT}`);
  console.log(`       PARA_BIRIMI: ${r.PARA_BIRIMI}, TOPLAM: ${toplam}`);
  console.log(`       SIPARIS_NO: ${r.SIPARIS_NO}`);
});
console.log('---');
console.log('Statik TOPLAM sum:', total);
console.log('Beklenen tutar:', 2926292);
console.log('Oran (beklenen / toplam):', 2926292 / total);

// Tum USD kayitlari
console.log('\n=== TUM USD KAYITLARI ===');
const usdRecs = records.filter(r => (r.PARA_BIRIMI || '').toUpperCase().includes('USD'));
console.log('USD kayit sayisi:', usdRecs.length);
let totalUSD = 0;
usdRecs.forEach((r, i) => {
  const toplam = Number(r.TOPLAM) || 0;
  totalUSD += toplam;
  console.log(`  [${i+1}] ${(r.CARI_UNVANI || '').substring(0,40)} | TOPLAM: ${toplam}`);
});
console.log('USD Toplam:', totalUSD);

// Tekrar kontrolu
console.log('\n=== TEKRAR KONTROLU ===');
const dupes = new Map();
records.forEach(r => {
  const key = (r.SIPARIS_NO || '') + '|' + (r.SIPARIS_MALZEME || '') + '|' + (r.TOPLAM || '');
  dupes.set(key, (dupes.get(key) || 0) + 1);
});
const dupEntries = [...dupes.entries()].filter(([k, v]) => v > 1);
if (dupEntries.length > 0) {
  console.log('Tekrarlayan kayitlar:');
  dupEntries.forEach(([k, v]) => console.log(`  ${v}x: ${k}`));
} else {
  console.log('Tekrarlayan kayit yok');
}

// Simulate getStaticStats groupBy
console.log('\n=== SIMULE: getStaticStats tedarikci gruplama ===');
const filteredData = records.filter(r => r.TUR && r.TUR !== '');
const tedarikciGroups = new Map();
for (const r of filteredData) {
  const key = r.CARI_UNVANI || 'Belirsiz';
  if (!tedarikciGroups.has(key)) {
    tedarikciGroups.set(key, { count: 0, siparisSet: new Set(), toplam: 0, paraBirimi: new Map() });
  }
  const g = tedarikciGroups.get(key);
  g.count++;
  if (r.SIPARIS_NO) g.siparisSet.add(r.SIPARIS_NO);
  const cur = r.PARA_BIRIMI || 'TL';
  const amount = Number(r.TOPLAM) || 0;
  g.paraBirimi.set(cur, (g.paraBirimi.get(cur) || 0) + amount);
  g.toplam += amount;
}

// Simulate mergeGroupStats (static only, no SQL)
console.log('\n=== SIMULE: mergeGroupStats (sadece statik - SQL olmadan) ===');
const merged = new Map();
for (const [key, d] of tedarikciGroups) {
  let totalTRY = 0;
  for (const [cur, amount] of d.paraBirimi) {
    // Code says: "Doviz cevirisi YAPMA - degerler zaten TL cinsinden"
    totalTRY += amount;
  }
  merged.set(key, { siparisAdedi: d.siparisSet.size, toplamTutar: totalTRY });
}

// Sort by toplamTutar desc
const sortedTedarikci = [...merged.entries()]
  .map(([k, v]) => ({ tedarikci: k, ...v }))
  .sort((a, b) => b.toplamTutar - a.toplamTutar);

console.log('Top 10 tedarikci (sadece statik):');
sortedTedarikci.slice(0, 10).forEach((t, i) => {
  console.log(`  ${i+1}. ${t.tedarikci.substring(0,45).padEnd(45)} | ${t.toplamTutar.toLocaleString('tr-TR')} TL | ${t.siparisAdedi} siparis`);
});

// Check Cemre Pet specifically
const cemreMerged = sortedTedarikci.find(t => t.tedarikci.includes('CEMRE'));
if (cemreMerged) {
  console.log('\nCemre Pet merged degeri:', cemreMerged.toplamTutar);
  console.log('Beklenen:', 2926292);
  console.log('Fark:', 2926292 - cemreMerged.toplamTutar);
}

// Check unique PARA_BIRIMI values
console.log('\n=== PARA BIRIMI DAGILIMI ===');
const paraBirimleri = new Map();
for (const r of filteredData) {
  const cur = r.PARA_BIRIMI || 'TL';
  const amount = Number(r.TOPLAM) || 0;
  if (!paraBirimleri.has(cur)) {
    paraBirimleri.set(cur, { count: 0, toplam: 0 });
  }
  paraBirimleri.get(cur).count++;
  paraBirimleri.get(cur).toplam += amount;
}
for (const [cur, info] of paraBirimleri) {
  console.log(`  ${cur}: ${info.count} kayit, toplam: ${info.toplam.toLocaleString('tr-TR')}`);
}

console.log('\nToplam kayit sayisi:', records.length);
