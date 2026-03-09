const http = require('http');
const url = 'http://10.35.20.17:5055/api/Satinalma/veriler';

http.get(url, {timeout: 10000}, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    const records = JSON.parse(data);
    console.log('Toplam kayit:', records.length);
    
    // Tire haric
    const tiresiz = records.filter(r => {
      const ambar = (r['AMBAR'] || '').toUpperCase();
      return !ambar.includes('TIRE') && !ambar.includes('TİRE');
    });
    console.log('Tire haric kayit:', tiresiz.length);
    
    // 082 ve 083 ara
    const r082 = records.filter(r => (r['SİPARİŞ NUMARASI'] || '').includes('000082'));
    const r083 = records.filter(r => (r['SİPARİŞ NUMARASI'] || '').includes('000083'));
    
    console.log('\n--- S.ACM.GAN.000082 ---');
    console.log('Kayit sayisi:', r082.length);
    r082.forEach(r => {
      const malzeme = (r['SİPARİŞ MALZEME'] || '').substring(0, 50);
      console.log(r['SİPARİŞ NUMARASI'], '|', r['CARİ ÜNVANI'], '|', malzeme, '|', r['TOPLAM'], '|', r['AMBAR']);
    });
    
    console.log('\n--- S.ACM.GAN.000083 ---');
    console.log('Kayit sayisi:', r083.length);
    r083.forEach(r => {
      const malzeme = (r['SİPARİŞ MALZEME'] || '').substring(0, 50);
      console.log(r['SİPARİŞ NUMARASI'], '|', r['CARİ ÜNVANI'], '|', malzeme, '|', r['TOPLAM'], '|', r['AMBAR']);
    });
    
    // Cemre Pet kayitlari (Gaziantep)
    const cemrePet = records.filter(r => {
      const cari = (r['CARİ ÜNVANI'] || '').toUpperCase();
      const ambar = (r['AMBAR'] || '').toUpperCase();
      return cari.includes('CEMRE') && ambar.includes('GAZ');
    });
    
    console.log('\n--- CEMRE PET Gaziantep ---');
    console.log('Kayit sayisi:', cemrePet.length);
    let cemreTotal = 0;
    cemrePet.forEach(r => {
      cemreTotal += (r['TOPLAM'] || 0);
      const malzeme = (r['SİPARİŞ MALZEME'] || '').substring(0, 50);
      console.log(r['SİPARİŞ NUMARASI'], '|', malzeme, '|', r['TOPLAM']);
    });
    console.log('Cemre Pet Gaziantep TOPLAM:', cemreTotal);
    
    // Tum Cemre Pet
    const cemreAll = records.filter(r => (r['CARİ ÜNVANI'] || '').toUpperCase().includes('CEMRE'));
    console.log('\n--- TUM CEMRE PET ---');
    let cemreAllTotal = 0;
    cemreAll.forEach(r => {
      cemreAllTotal += (r['TOPLAM'] || 0);
      console.log(r['SİPARİŞ NUMARASI'], '|', r['AMBAR'], '|', r['TOPLAM']);
    });
    console.log('Tum Cemre Pet TOPLAM:', cemreAllTotal);
    
    // Ambar bazinda kayit sayisi
    const ambarCount = {};
    records.forEach(r => {
      const ambar = r['AMBAR'] || 'BOŞ';
      ambarCount[ambar] = (ambarCount[ambar] || 0) + 1;
    });
    console.log('\n--- AMBAR BAZINDA KAYIT ---');
    Object.entries(ambarCount).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(k, ':', v));
    
    // Dedup kontrol - ayni siparis numarasi + malzeme birden fazla mi?
    const dupCheck = {};
    records.forEach(r => {
      const key = (r['SİPARİŞ NUMARASI'] || '') + '|' + (r['SİPARİŞ MALZEME'] || '') + '|' + (r['MİKTAR'] || '') + '|' + (r['BİRİM FİYAT'] || '');
      dupCheck[key] = (dupCheck[key] || 0) + 1;
    });
    const dups = Object.entries(dupCheck).filter(([k,v]) => v > 1);
    console.log('\n--- DEDUP KONTROL ---');
    console.log('Duplicate key sayisi:', dups.length);
    if (dups.length > 0) {
      dups.slice(0, 10).forEach(([k,v]) => console.log('  DUP:', k, '-> x' + v));
    }
  });
}).on('error', e => console.error('Error:', e.message));
