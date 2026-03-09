const fs = require('fs');
const path = require('path');
const http = require('http');

// Ocak verisi
const ocakPath = path.join(__dirname, 'ocak_2026_data.json');
const ocakData = JSON.parse(fs.readFileSync(ocakPath, 'utf8'));
const ocakRecords = ocakData.records;

console.log('=== VERİ KARŞILAŞTIRMASI ===\n');

// Ocak analizi
const ocakSiparis = new Set(ocakRecords.map(r => r.SIPARIS_NO).filter(Boolean));
let ocakToplam = 0;
for (const r of ocakRecords) {
  ocakToplam += Number(r.TOPLAM) || 0;
}
console.log('OCAK (Statik JSON):');
console.log('  Kayıt sayısı:', ocakRecords.length);
console.log('  Sipariş sayısı:', ocakSiparis.size);
console.log('  Toplam tutar:', ocakToplam.toLocaleString('tr-TR'), 'TL');

// API'den Şubat verisi
const url = 'http://10.35.20.17:5050/api/Satinalma/veriler';

http.get(url, (res) => {
  let raw = '';
  res.on('data', chunk => raw += chunk);
  res.on('end', () => {
    try {
      const apiRecords = JSON.parse(raw);
      
      const apiSiparis = new Set(apiRecords.map(r => r['SİPARİŞ NUMARASI']).filter(Boolean));
      let apiToplam = 0;
      for (const r of apiRecords) {
        apiToplam += Number(r['TOPLAM']) || 0;
      }
      
      console.log('\nŞUBAT (API):');
      console.log('  Kayıt sayısı:', apiRecords.length);
      console.log('  Sipariş sayısı:', apiSiparis.size);
      console.log('  Toplam tutar:', apiToplam.toLocaleString('tr-TR'), 'TL');
      
      // Birleşik analiz - duplikasyon kontrolü
      // API verilerini normalize et
      function normalizeApiRecord(r) {
        return {
          TALEP_NO: r['TALEP NUMARASI'],
          SIPARIS_NO: r['SİPARİŞ NUMARASI'],
          MALZEME_HIZMET_KODU: r['MALZEME/HİZMET KODU'],
          MIKTAR: r['MİKTAR'],
          TOPLAM: r['TOPLAM'],
          AMBAR: r['AMBAR'],
          CARI_UNVANI: r['CARİ ÜNVANI'],
        };
      }
      
      const normalizedApi = apiRecords.map(normalizeApiRecord);
      
      // Kayıtları benzersiz key ile birleştir
      function getRecordKey(r) {
        return `${r.TALEP_NO || ''}_${r.SIPARIS_NO || ''}_${r.MALZEME_HIZMET_KODU || ''}_${r.MIKTAR || ''}`;
      }
      
      const recordMap = new Map();
      
      // Önce Ocak
      for (const r of ocakRecords) {
        const key = getRecordKey(r);
        recordMap.set(key, r);
      }
      
      // Sonra API (üzerine yazar)
      for (const r of normalizedApi) {
        const key = getRecordKey(r);
        recordMap.set(key, r);
      }
      
      const mergedRecords = Array.from(recordMap.values());
      const mergedSiparis = new Set(mergedRecords.map(r => r.SIPARIS_NO).filter(Boolean));
      let mergedToplam = 0;
      for (const r of mergedRecords) {
        mergedToplam += Number(r.TOPLAM) || 0;
      }
      
      console.log('\nBİRLEŞİK (Ocak + Şubat):');
      console.log('  Kayıt sayısı:', mergedRecords.length);
      console.log('  Sipariş sayısı:', mergedSiparis.size);
      console.log('  Toplam tutar:', mergedToplam.toLocaleString('tr-TR'), 'TL');
      
      // Hedef değer
      const hedef = 15434914;
      console.log('\n=== SONUÇ ===');
      console.log('Hedef toplam tutar: 15.434.914 TL');
      console.log('Hesaplanan toplam:', mergedToplam.toLocaleString('tr-TR'), 'TL');
      console.log('Fark:', (hedef - mergedToplam).toLocaleString('tr-TR'), 'TL');
      
      if (Math.abs(hedef - mergedToplam) < 10) {
        console.log('\n✅ TUTARLAR TUTARLI!');
      } else {
        console.log('\n⚠️ Fark var, kontrol et');
      }
      
      // Sipariş sayısı kontrolü
      console.log('\nSipariş sayısı kontrolü:');
      console.log('  Hedef: 216 sipariş');
      console.log('  Hesaplanan:', mergedSiparis.size, 'sipariş');
      
    } catch (e) {
      console.error('Parse error:', e.message);
    }
  });
}).on('error', e => {
  console.error('API bağlantı hatası:', e.message);
  console.log('\n⚠️ API erişilemiyor, sadece Ocak verisi kullanılacak');
});
