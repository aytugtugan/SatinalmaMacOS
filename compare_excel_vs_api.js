const http = require('http');

// Kullanıcının verdiği Şubat Excel verileri (Tutar sütunu)
const excelSubat = {
  'S.ACM.GAN.000055': 1397.06,
  'S.ACM.GAN.000079': 14400,
  'S.ACM.GAN.000080': 26366.52,
  'S.ACM.GAN.000082': 1755775.44,
  'S.ACM.GAN.000083': 308917.2,
  'S.ACM.GAN.000084': 573101.76,
  'S.ACM.GAN.000085': 94682.82,
  'S.ACM.GAN.000087': 61482.36,
  'S.ACM.GAN.000089': 1680,
  'S.ACM.GAN.000090': 113120,  // Kayzer (K)
  'S.ACM.GAN.000091': 17556,
  'S.ACM.GAN.000092': 4320,
  'S.ACM.GAN.000093': 228000,
  'S.ACM.GAN.000095': 1870,    // MTH (K)
  'S.ACM.GAN.000096': 168000,
  'S.ACM.GAN.000097': 13104,
  'S.ACM.GAN.000098': 2561.26,
  'S.ACM.GAN.000099': 1063,    // Muhtelif (K)
  'S.ACM.GAN.000100': 30000,
  'S.ACM.GAN.000101': 54000,
  'S.ACM.GAN.000102': 2644.52,
  'S.ACM.GAN.000103': 4044.56,
  'S.ACM.GAN.000104': 4044.56,
  'S.ACM.GAN.000105': 40445.64,
  'S.ACM.GAN.000106': 48534.77,
  'S.ACM.GAN.000107': 148200,
  'S.ACM.GAN.000108': 7500,
  'S.ACM.GAN.000109': 92949.12,
  'S.ACM.GAN.000110': 74359.3,
  'S.ACM.GAN.000111': 11153.9,
  'S.ACM.GAN.000112': 20523.17,
  'S.ACM.GAN.000113': 9319.34,
  'S.ACM.GAN.000114': 1300,
  'S.ACM.GAN.000115': 5610,
  'S.ACM.GAN.000116': 780,
  'S.ACM.GAN.000117': 216000,
  'S.ACM.GAN.000119': 855000,
  'S.ACM.GAN.000120': 2475,
  'S.ACM.GAN.000121': 21272.35,
  'S.ACM.GAN.000122': 200400,
  'S.ACM.GAN.000124': 24663.6,
  'S.ACM.GAN.000127': 2565000,
  'S.ACM.GAN.000128': 619940.4,
  'S.ACM.GAN.000129': 268200,
  'S.ACM.İZM.000031': 13860,
  'S.ACM.İZM.000032': 47499.9,
  'S.ACM.İZM.000033': 180000,
  'S.ACM.İZM.000034': 18000,
  'S.ACM.İZM.000035': 102290.39,
  'S.ACM.İZM.000036': 32400,
  'S.ACM.İZM.000037': 98400,
  'S.ACM.İZM.000040': 1104000,
  'S.ACM.İZM.000041': 8755.97,
  'S.ACM.İZM.000042': 6897,
  'S.ACM.İZM.000043': 38214,
  'S.ACM.İZM.000044': 3744,
};

http.get('http://10.35.20.17:5055/api/Satinalma/veriler', {timeout: 10000}, (res) => {
  let d = '';
  res.on('data', c => { d += c; });
  res.on('end', () => {
    const records = JSON.parse(d);
    
    // Siparis bazinda API toplamlarini hesapla
    const apiToplam = {};
    records.forEach(r => {
      const sip = r['SİPARİŞ NUMARASI'];
      if (!sip) return;
      if (!apiToplam[sip]) apiToplam[sip] = { toplam: 0, items: 0, cari: r['CARİ ÜNVANI'] };
      apiToplam[sip].toplam += (Number(r['TOPLAM']) || 0);
      apiToplam[sip].items++;
    });
    
    console.log('=== ŞUBAT EXCEL vs SQL/API KARŞILAŞTIRMA ===');
    console.log('');
    console.log(
      'Sipariş No'.padEnd(22),
      'Excel (TL)'.padStart(14),
      'SQL/API (TL)'.padStart(14),
      'Oran'.padStart(8),
      'KDV %'.padStart(8),
      'Eşleşme'
    );
    console.log('-'.repeat(80));
    
    let matchCount = 0;
    let kdvCount = 0;
    let mismatchCount = 0;
    let totalExcel = 0;
    let totalApi = 0;
    
    const oranlar = [];
    
    for (const [sipNo, excelTutar] of Object.entries(excelSubat).sort()) {
      totalExcel += excelTutar;
      const api = apiToplam[sipNo];
      
      if (!api) {
        console.log(sipNo.padEnd(22), excelTutar.toFixed(2).padStart(14), 'API YOK'.padStart(14));
        continue;
      }
      
      totalApi += api.toplam;
      const oran = excelTutar / api.toplam;
      oranlar.push(oran);
      const kdvYuzde = ((oran - 1) * 100).toFixed(1);
      
      let eslesme = '';
      if (Math.abs(excelTutar - api.toplam) < 1) {
        eslesme = '✅ AYNI';
        matchCount++;
      } else if (Math.abs(oran - 1.2) < 0.01) {
        eslesme = '⚠️  KDV %20';
        kdvCount++;
      } else if (Math.abs(oran - 1.1) < 0.01) {
        eslesme = '⚠️  KDV %10';
        kdvCount++;
      } else {
        eslesme = '❌ FARKLI';
        mismatchCount++;
      }
      
      console.log(
        sipNo.padEnd(22),
        excelTutar.toFixed(2).padStart(14),
        api.toplam.toFixed(2).padStart(14),
        oran.toFixed(4).padStart(8),
        (kdvYuzde + '%').padStart(8),
        eslesme
      );
    }
    
    console.log('-'.repeat(80));
    console.log('');
    console.log('TOPLAM Excel:', totalExcel.toFixed(2));
    console.log('TOPLAM API:', totalApi.toFixed(2));
    console.log('Genel Oran:', (totalExcel / totalApi).toFixed(4));
    console.log('');
    console.log('Birebir ayni:', matchCount);
    console.log('KDV farkli:', kdvCount);
    console.log('Diger fark:', mismatchCount);
    
    // Oran dagilimi
    const oranMap = {};
    oranlar.forEach(o => {
      const rounded = (Math.round(o * 100) / 100).toFixed(2);
      oranMap[rounded] = (oranMap[rounded] || 0) + 1;
    });
    console.log('\nOran dagilimi:');
    Object.entries(oranMap).sort().forEach(([k,v]) => console.log('  Oran', k, ':', v, 'siparis'));
    
    // Cemre Pet detay
    console.log('\n=== CEMRE PET DETAY ===');
    console.log('Excel 082:', excelSubat['S.ACM.GAN.000082']);
    console.log('API 082:', apiToplam['S.ACM.GAN.000082']?.toplam);
    console.log('Oran:', (excelSubat['S.ACM.GAN.000082'] / apiToplam['S.ACM.GAN.000082']?.toplam).toFixed(4));
    console.log('Excel / 1.2 =', (excelSubat['S.ACM.GAN.000082'] / 1.2).toFixed(2), '(KDV haric)');
    console.log('API toplam =', apiToplam['S.ACM.GAN.000082']?.toplam.toFixed(2), '(SQL)');
    console.log('Esit mi?', Math.abs(excelSubat['S.ACM.GAN.000082'] / 1.2 - apiToplam['S.ACM.GAN.000082']?.toplam) < 1 ? 'EVET' : 'HAYIR');
  });
}).on('error', e => console.error(e.message));
