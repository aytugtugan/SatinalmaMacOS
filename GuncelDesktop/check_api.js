const https = require('http');

const url = 'http://10.35.20.17:5050/api/Satinalma/veriler';

https.get(url, (res) => {
  let raw = '';
  res.on('data', chunk => raw += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(raw);
      console.log('API kayıt sayısı:', data.length);
      
      // Unique siparişler
      const siparis = new Set(data.map(r => r['SİPARİŞ NUMARASI']).filter(Boolean));
      console.log('Unique sipariş:', siparis.size);
      
      // Toplam tutar
      let toplam = 0;
      for (const r of data) {
        toplam += Number(r['TOPLAM']) || 0;
      }
      console.log('API toplam tutar:', toplam.toLocaleString('tr-TR'));
      
      // Kimyasallar var mı?
      const kimya = data.filter(r => r['AMBAR'] && r['AMBAR'].toUpperCase().includes('KIM'));
      console.log('Kimyasallar kayıt:', kimya.length);
      
      // Tunahan AK var mı?
      const tunahan = data.filter(r => r['CARİ ÜNVANI'] && r['CARİ ÜNVANI'].toUpperCase().includes('TUNAHAN'));
      console.log('Tunahan AK kayıt:', tunahan.length);
      if (tunahan.length > 0) {
        console.log('Tunahan kayıtları:');
        for (const t of tunahan) {
          console.log('  -', t['SİPARİŞ NUMARASI'], t['CARİ ÜNVANI'], t['TOPLAM'], t['AMBAR']);
        }
      }
      
      // AMBAR değerleri
      const ambarlar = new Set(data.map(r => r['AMBAR']).filter(Boolean));
      console.log('AMBAR değerleri:', Array.from(ambarlar));
      
    } catch (e) {
      console.error('Parse error:', e.message);
    }
  });
}).on('error', e => console.error('Request error:', e.message));
