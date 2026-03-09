const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// ===== 1. Excel Oku =====
const wb = XLSX.readFile(path.join(__dirname, 'ocak.xls'));
const ws = wb.Sheets[wb.SheetNames[0]];
const excelData = XLSX.utils.sheet_to_json(ws);

// ===== 2. Mevcut JSON Oku =====
const jsonPath = path.join(__dirname, 'masaustu/mobile/src/data/ocak_2026_data.json');
const jsonArr = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
const existingRecords = Array.isArray(jsonArr) ? jsonArr : (jsonArr.records || []);

console.log('Mevcut JSON kayıt sayısı:', existingRecords.length);

// Sample record structure
const sampleRec = existingRecords.find(r => r.SIPARIS_NO && r.SIPARIS_NO.includes('GAN'));
if (sampleRec) {
  console.log('\nOrnek GAN kayit alanlari:', Object.keys(sampleRec).join(', '));
  console.log('FIRMA_NUMARASI:', sampleRec.FIRMA_NUMARASI);
  console.log('FIRMA_ADI:', sampleRec.FIRMA_ADI);
  console.log('TUR:', sampleRec.TUR);
  console.log('PARA_BIRIMI:', sampleRec.PARA_BIRIMI);
  console.log('AMBAR:', sampleRec.AMBAR);
  console.log('ISYERI:', sampleRec.ISYERI);
}

// ===== 3. Excel siparislerini set olarak al =====
const excelSiparisSet = new Set(excelData.map(r => r['Fiş No.']).filter(Boolean));
console.log('\nExcel unique siparis:', excelSiparisSet.size);

// ===== 4. JSON'da olan ama Excel'de olmayan siparisler =====
const jsonSiparisSet = new Set(existingRecords.map(r => r.SIPARIS_NO).filter(Boolean));
const jsonOnlyRecords = existingRecords.filter(r => {
  if (!r.SIPARIS_NO) return true; // siparis no'su olmayan kayitlari tut
  return excelSiparisSet.has(r.SIPARIS_NO) || !r.SIPARIS_NO.includes('ACM');
});

// TEST kayitlarini cikar
const cleanedRecords = jsonOnlyRecords.filter(r => {
  if (r.SIPARIS_NO === 'TESTKURUMSOFT' || r.SIPARIS_NO === '00000001') return false;
  return true;
});

console.log('Test kayitlari cikarildi, kalan:', cleanedRecords.length);

// ===== 5. Excel'de olup JSON'da olmayan siparis numaralari =====
const existingSiparisSet = new Set(cleanedRecords.map(r => r.SIPARIS_NO).filter(Boolean));
const missingFromJSON = excelData.filter(r => {
  const fis = r['Fiş No.'];
  return fis && !existingSiparisSet.has(fis);
});
console.log('Eksik kayit sayisi:', missingFromJSON.length);
missingFromJSON.forEach(r => {
  console.log('  +', r['Fiş No.'], '|', r['Cari Hesap Unvanı'], '|', r['Ambar Açıklaması']);
});

// ===== 6. Excel tarihlerini JS Date'e cevir =====
function excelDateToISO(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const date = new Date(epoch.getTime() + serial * 86400000);
  return date.toISOString();
}

// ===== 7. Para birimi ve dovizli tutar parse =====
function parseDovizliTutar(dovizStr) {
  if (!dovizStr) return { paraBirimi: 'TL', dovizTutar: null };
  const str = String(dovizStr).trim();
  if (str.includes('€')) return { paraBirimi: 'EUR', dovizTutar: str };
  if (str.includes('$')) return { paraBirimi: 'USD', dovizTutar: str };
  if (str.includes('£')) return { paraBirimi: 'GBP', dovizTutar: str };
  return { paraBirimi: 'TL', dovizTutar: null };
}

// ===== 8. Ambar adini normalize et =====
function normalizeAmbar(ambarAciklama) {
  if (!ambarAciklama) return 'Gaziantep';
  const upper = String(ambarAciklama).toUpperCase();
  if (upper.includes('GAZ')) return 'Gaziantep';
  if (upper.includes('BORN')) return 'Bornova';
  if (upper.includes('TİRE') || upper.includes('TIRE')) return 'Tire';
  if (upper.includes('AKH')) return 'Akhisar';
  if (upper.includes('GÖN')) return 'Gönen';
  return ambarAciklama;
}

// ===== 9. Eksik kayitlari app formatina cevir =====
const newRecords = missingFromJSON.map(r => {
  const { paraBirimi } = parseDovizliTutar(r['Dövizli Tutar']);
  const odemePlan = r['Ödeme Planı Kodu'] ? String(r['Ödeme Planı Kodu']).trim() : null;
  const ambar = normalizeAmbar(r['Ambar Açıklaması']);
  
  return {
    FIRMA_NUMARASI: 32,
    FIRMA_ADI: '2022-2026 ACEMOĞLU GIDA SAN. VE TİC. A.Ş.',
    ISYERI: ambar,
    AMBAR: ambar,
    TUR: 'MALZEME',
    MALZEME_HIZMET_KODU: null,
    MASRAF_MERKEZI: null,
    TALEP_NO: null,
    TALEP_EDEN: null,
    TALEP_TARIHI: null,
    TALEP_ONAYLAYAN: null,
    TALEP_ONAY_TARIHI: null,
    TALEP_ACIKLAMA: null,
    SIPARIS_NO: r['Fiş No.'],
    SIPARISI_ACAN: r['Ekleyen'] || null,
    SIPARIS_TARIHI: excelDateToISO(r['Tarih']),
    SIPARIS_ONAYLAYAN: null,
    SIPARIS_ONAY_TARIHI: null,
    SIPARIS_MALZEME: null,
    TESLIM_EVRAK_NO: null,
    TESLIM_TARIHI: null,
    CARI_UNVANI: r['Cari Hesap Unvanı'] || null,
    TESLIM_ALAN: null,
    ACIKLAMA: null,
    MIKTAR: 1,
    BIRIM: 'ADET',
    ODEME_VADESI: odemePlan,
    PARA_BIRIMI: paraBirimi,
    BIRIM_FIYAT: r['Tutar'] || 0,
    TOPLAM: r['Tutar'] || 0,
    FATURAYI_KAYDEDEN: null,
    FATURA_KAYDETME_TARIHI: null,
    FATURA_TARIHI: null,
    FATURA_NO: null,
  };
});

console.log('\nOlusturulan yeni kayit sayisi:', newRecords.length);

// ===== 10. Birlestir ve kaydet =====
const finalRecords = [...cleanedRecords, ...newRecords];
console.log('Final kayit sayisi:', finalRecords.length);

// Unique siparis sayisi
const finalSiparis = new Set(finalRecords.map(r => r.SIPARIS_NO).filter(Boolean));
console.log('Final unique siparis:', finalSiparis.size);

// Ambar dagilimi
const ambarDist = {};
finalRecords.forEach(r => {
  const a = (r.AMBAR || 'YOK').toUpperCase();
  ambarDist[a] = (ambarDist[a] || 0) + 1;
});
console.log('Ambar dagilimi:', JSON.stringify(ambarDist, null, 2));

// Gaziantep unique siparis
const gazRecords = finalRecords.filter(r => (r.AMBAR || '').toUpperCase().includes('GAZ'));
const gazSiparis = new Set(gazRecords.map(r => r.SIPARIS_NO).filter(Boolean));
console.log('Gaziantep unique siparis:', gazSiparis.size);

// Excel'deki tum siparisler final'da var mi?
const finalSiparisSet = new Set(finalRecords.map(r => r.SIPARIS_NO).filter(Boolean));
const stillMissing = [...excelSiparisSet].filter(f => !finalSiparisSet.has(f));
console.log('Hala eksik siparis:', stillMissing.length);
if (stillMissing.length > 0) {
  stillMissing.forEach(s => console.log('  !', s));
}

// Kaydet
const mobileOutPath = path.join(__dirname, 'masaustu/mobile/src/data/ocak_2026_data.json');
const desktopOutPath = path.join(__dirname, 'GuncelDesktop/ocak_2026_data.json');

fs.writeFileSync(mobileOutPath, JSON.stringify(finalRecords, null, 2), 'utf-8');
console.log('\nMobile JSON kaydedildi:', mobileOutPath);

fs.writeFileSync(desktopOutPath, JSON.stringify(finalRecords, null, 2), 'utf-8');
console.log('Desktop JSON kaydedildi:', desktopOutPath);
