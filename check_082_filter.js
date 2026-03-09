const http = require('http');
http.get('http://10.35.20.17:5055/api/Satinalma/veriler', {timeout: 10000}, (res) => {
  let d = '';
  res.on('data', c => { d += c; });
  res.on('end', () => {
    const records = JSON.parse(d);
    const r082 = records.filter(r => (r['SİPARİŞ NUMARASI']||'').includes('000082'));
    const r083 = records.filter(r => (r['SİPARİŞ NUMARASI']||'').includes('000083'));
    console.log('082 TUR:', r082.map(r => JSON.stringify(r['TÜR'])));
    console.log('083 TUR:', r083.map(r => JSON.stringify(r['TÜR'])));
    console.log('082 AMBAR:', r082.map(r => r['AMBAR']));
    console.log('083 AMBAR:', r083.map(r => r['AMBAR']));
    const noTur = records.filter(r => !r['TÜR'] || r['TÜR'] === '');
    console.log('TUR bos kayit:', noTur.length);
    
    // Simulate dataProcessor merge - does 082/083 pass dedup?
    const seen = new Set();
    const passing = records.filter(r => {
      const ambar = (r['AMBAR'] || '').toUpperCase();
      if (ambar.includes('TIRE') || ambar.includes('TİRE')) return false;
      const key = (r['SİPARİŞ NUMARASI']||'') + '|' + (r['SİPARİŞ MALZEME']||'') + '|' + (r['MİKTAR']||'') + '|' + (r['BİRİM FİYAT']||'');
      if (!key || key === '|||') return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    const p082 = passing.filter(r => (r['SİPARİŞ NUMARASI']||'').includes('000082'));
    const p083 = passing.filter(r => (r['SİPARİŞ NUMARASI']||'').includes('000083'));
    console.log('\nAfter dedup + Tire filter:');
    console.log('082 count:', p082.length);
    console.log('083 count:', p083.length);
    console.log('Total passing:', passing.length);
    
    // Check GAN siparis for Gaziantep specifically
    const ganGaz = passing.filter(r => (r['SİPARİŞ NUMARASI']||'').startsWith('S.ACM.GAN'));
    console.log('\nGAN Gaziantep siparis:', ganGaz.length);
    ganGaz.forEach(r => console.log(r['SİPARİŞ NUMARASI'], '|', (r['CARİ ÜNVANI']||'').substring(0,30), '|', r['TOPLAM']));
  });
}).on('error', e => console.error(e.message));
