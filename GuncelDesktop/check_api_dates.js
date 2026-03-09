const http = require('http');

const url = 'http://10.35.20.17:5050/api/Satinalma/veriler';

http.get(url, (res) => {
  let raw = '';
  res.on('data', chunk => raw += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(raw);
      
      console.log('=== API VERİ TARİH ANALİZİ ===\n');
      console.log('Toplam kayıt:', data.length);
      
      // Tarih dağılımı
      const talepTarihleri = new Map();
      const siparisTarihleri = new Map();
      
      for (const r of data) {
        // Talep tarihi
        const talepTarihi = r['TALEP TARİHİ'];
        if (talepTarihi) {
          const ay = talepTarihi.substring(0, 7); // YYYY-MM
          talepTarihleri.set(ay, (talepTarihleri.get(ay) || 0) + 1);
        }
        
        // Sipariş tarihi
        const siparisTarihi = r['SİPARİŞ TARİHİ'];
        if (siparisTarihi) {
          const ay = siparisTarihi.substring(0, 7);
          siparisTarihleri.set(ay, (siparisTarihleri.get(ay) || 0) + 1);
        }
      }
      
      console.log('Talep Tarihi Dağılımı:');
      for (const [ay, sayi] of [...talepTarihleri.entries()].sort()) {
        console.log(`  ${ay}: ${sayi} kayıt`);
      }
      
      console.log('\nSipariş Tarihi Dağılımı:');
      for (const [ay, sayi] of [...siparisTarihleri.entries()].sort()) {
        console.log(`  ${ay}: ${sayi} kayıt`);
      }
      
      // 2026-02-01 öncesi kayıt var mı?
      const oncesiKayitlar = data.filter(r => {
        const siparisTarihi = r['SİPARİŞ TARİHİ'];
        const talepTarihi = r['TALEP TARİHİ'];
        // Hem talep hem sipariş 2026-02-01 öncesinde
        return (siparisTarihi && siparisTarihi < '2026-02-01') && 
               (talepTarihi && talepTarihi < '2026-02-01');
      });
      
      console.log('\n2026-02-01 öncesi kayıtlar (hem talep hem sipariş):');
      console.log('  Sayı:', oncesiKayitlar.length);
      
      // Sadece Şubat+ siparişleri
      const subatSiparisler = data.filter(r => {
        const siparisTarihi = r['SİPARİŞ TARİHİ'];
        return siparisTarihi && siparisTarihi >= '2026-02-01';
      });
      console.log('\nŞubat+ sipariş tarihi olanlar:', subatSiparisler.length);
      
      let subatToplam = 0;
      for (const r of subatSiparisler) {
        subatToplam += Number(r['TOPLAM']) || 0;
      }
      console.log('Şubat+ toplam tutar:', subatToplam.toLocaleString('tr-TR'), 'TL');
      
    } catch (e) {
      console.error('Parse error:', e.message);
    }
  });
}).on('error', e => console.error('API bağlantı hatası:', e.message));
