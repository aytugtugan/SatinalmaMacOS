// Ocak 2026 verisini SQL'den çek + Excel'den eksik kayıtları ekle
const sql = require('mssql');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const config = {
  user: 'ozgur.copkur',
  password: 'Oz2025!!',
  server: '10.35.20.15\\SQLSRV',
  database: 'SNCG',
  options: { encrypt: false, trustServerCertificate: true, connectTimeout: 30000, requestTimeout: 60000 }
};

async function main() {
  console.log('=== SQL Bağlantısı ===');
  const pool = await sql.connect(config);
  
  // 1. SQL'den Ocak verisini çek (dedup ile)
  const query = `
    SELECT 
      dd.[FİRMA NUMARASI] as FIRMA_NUMARASI,
      dd.[FİRMA ADI] as FIRMA_ADI,
      dd.[İŞ YERİ] as ISYERI,
      dd.[AMBAR] as AMBAR,
      dd.[TÜR] as TUR,
      dd.[MALZEME/HİZMET KODU] as MALZEME_HIZMET_KODU,
      dd.[MASRAF MERKEZİ] as MASRAF_MERKEZI,
      dd.[TALEP NUMARASI] as TALEP_NO,
      dd.[TALEP EDEN] as TALEP_EDEN,
      dd.[TALEP TARİHİ] as TALEP_TARIHI,
      dd.[TALEP ONAYLAYAN] as TALEP_ONAYLAYAN,
      dd.[TALEP ONAY TARİHİ] as TALEP_ONAY_TARIHI,
      dd.[TALEP AÇIKLAMA] as TALEP_ACIKLAMA,
      dd.[SİPARİŞ NUMARASI] as SIPARIS_NO,
      dd.[SİPARİŞİ AÇAN] as SIPARISI_ACAN,
      dd.[SİPARİŞ TARİHİ] as SIPARIS_TARIHI,
      dd.[SİPARİŞ ONAYLAYAN] as SIPARIS_ONAYLAYAN,
      dd.[SİPARİŞ ONAY TARİHİ] as SIPARIS_ONAY_TARIHI,
      dd.[SİPARİŞ MALZEME] as SIPARIS_MALZEME,
      dd.[TESLİM EVRAK NO] as TESLIM_EVRAK_NO,
      dd.[TESLİM TARİHİ] as TESLIM_TARIHI,
      dd.[CARİ ÜNVANI] as CARI_UNVANI,
      dd.[TESLİM ALAN] as TESLIM_ALAN,
      dd.[AÇIKLAMA] as ACIKLAMA,
      dd.[MİKTAR] as MIKTAR,
      dd.[BİRİM] as BIRIM,
      dd.[ÖDEME VADESİ] as ODEME_VADESI,
      dd.[PARA BİRİMİ] as PARA_BIRIMI,
      dd.[BİRİM FİYAT] as BIRIM_FIYAT,
      dd.[TOPLAM] as TOPLAM,
      dd.[FATURAYI KAYDEDEN] as FATURAYI_KAYDEDEN,
      dd.[FATURA KAYDETME TARİHİ] as FATURA_KAYDETME_TARIHI,
      dd.[FATURA TARİHİ] as FATURA_TARIHI,
      dd.[FATURA NO] as FATURA_NO
    FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY [SİPARİŞ NUMARASI], [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT]
        ORDER BY (SELECT NULL)
      ) as _rn
      FROM YLZ_TALEP_SIPARIS
      WHERE ([TÜR] IS NOT NULL AND [TÜR] <> '')
        AND [SİPARİŞ TARİHİ] < '2026-02-01'
    ) dd
    WHERE dd._rn = 1
    ORDER BY dd.[SİPARİŞ TARİHİ] DESC
  `;
  
  const result = await pool.request().query(query);
  const sqlRecords = result.recordset;
  console.log('SQL Ocak kayıt (dedup):', sqlRecords.length);
  
  const sqlSiparisSet = new Set(sqlRecords.map(r => r.SIPARIS_NO).filter(Boolean));
  console.log('SQL unique sipariş:', sqlSiparisSet.size);
  
  // Ambar dağılımı
  const ambarDist = {};
  sqlRecords.forEach(r => {
    const a = (r.AMBAR || 'YOK');
    ambarDist[a] = (ambarDist[a] || 0) + 1;
  });
  console.log('SQL ambar dağılımı:', JSON.stringify(ambarDist, null, 2));
  
  // 2. Excel oku
  console.log('\n=== Excel Analizi ===');
  const wb = XLSX.readFile(path.join(__dirname, 'ocak.xls'));
  const ws = wb.Sheets[wb.SheetNames[0]];
  const excelData = XLSX.utils.sheet_to_json(ws);
  const excelSiparisSet = new Set(excelData.map(r => r['Fiş No.']).filter(Boolean));
  console.log('Excel toplam satır:', excelData.length);
  console.log('Excel unique sipariş:', excelSiparisSet.size);
  
  // 3. Excel'de olup SQL'de olmayan siparişleri bul
  const missingInSQL = excelData.filter(r => {
    const fis = r['Fiş No.'];
    return fis && !sqlSiparisSet.has(fis);
  });
  console.log('Excel\'de olup SQL\'de olmayan:', missingInSQL.length);
  
  // Excel tarihini çevir
  function excelDateToISO(serial) {
    if (!serial || typeof serial !== 'number') return null;
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(epoch.getTime() + serial * 86400000);
    return date.toISOString();
  }
  
  // Para birimi parse
  function parseDovizliTutar(dovizStr) {
    if (!dovizStr) return 'TL';
    const str = String(dovizStr).trim();
    if (str.includes('€')) return 'EUR';
    if (str.includes('$')) return 'USD';
    if (str.includes('£')) return 'GBP';
    return 'TL';
  }
  
  // Ambar normalize
  function normalizeAmbar(ambarAciklama) {
    if (!ambarAciklama) return 'Gaziantep';
    const s = String(ambarAciklama);
    if (s.toLowerCase().includes('gaz')) return 'Gaziantep';
    if (s.toLowerCase().includes('born')) return 'Bornova';
    if (s.toLowerCase().includes('tire')) return 'Tire';
    if (s.toLowerCase().includes('akh')) return 'Akhisar';
    if (s.toLowerCase().includes('gön')) return 'Gönen';
    return s;
  }
  
  // Eksik Excel kayıtlarını app formatına çevir
  const newRecords = missingInSQL.map(r => {
    const paraBirimi = parseDovizliTutar(r['Dövizli Tutar']);
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
  
  if (newRecords.length > 0) {
    console.log('\nEksik kayıtlar oluşturuldu:');
    newRecords.forEach(r => console.log('  +', r.SIPARIS_NO, '|', r.CARI_UNVANI, '|', r.TOPLAM));
  }
  
  // 4. Test kayıtlarını çıkar
  const filteredSQL = sqlRecords.filter(r => {
    if (r.SIPARIS_NO === 'TESTKURUMSOFT' || r.SIPARIS_NO === '00000001') return false;
    return true;
  });
  
  // 5. Birleştir
  const finalRecords = [...filteredSQL, ...newRecords];
  console.log('\n=== SONUÇ ===');
  console.log('Final kayıt sayısı:', finalRecords.length);
  
  const finalSiparisSet = new Set(finalRecords.map(r => r.SIPARIS_NO).filter(Boolean));
  console.log('Final unique sipariş:', finalSiparisSet.size);
  
  // Ambar dağılımı
  const finalAmbar = {};
  finalRecords.forEach(r => {
    const a = (r.AMBAR || 'YOK');
    finalAmbar[a] = (finalAmbar[a] || 0) + 1;
  });
  console.log('Final ambar dağılımı:', JSON.stringify(finalAmbar, null, 2));
  
  // Tüm Excel siparişleri var mı?
  const stillMissing = [...excelSiparisSet].filter(f => !finalSiparisSet.has(f));
  console.log('Hala eksik sipariş:', stillMissing.length);
  if (stillMissing.length > 0) stillMissing.forEach(s => console.log('  !', s));
  
  // 6. Kaydet
  const mobileOut = path.join(__dirname, 'masaustu/mobile/src/data/ocak_2026_data.json');
  const desktopOut = path.join(__dirname, 'GuncelDesktop/ocak_2026_data.json');
  
  fs.writeFileSync(mobileOut, JSON.stringify(finalRecords, null, 2), 'utf-8');
  console.log('\nMobile JSON kaydedildi:', mobileOut);
  
  fs.writeFileSync(desktopOut, JSON.stringify(finalRecords, null, 2), 'utf-8');
  console.log('Desktop JSON kaydedildi:', desktopOut);
  
  await pool.close();
  process.exit(0);
}

main().catch(e => { console.error('HATA:', e.message); process.exit(1); });
