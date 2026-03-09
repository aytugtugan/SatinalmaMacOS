const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const config = {
  server: '10.35.20.15\\SQLSRV',
  database: 'SNCG',
  user: 'ozgur.copkur',
  password: 'Oz2025!!',
  options: { encrypt: false, trustServerCertificate: true }
};

async function main() {
  const pool = await sql.connect(config);
  
  // Ocak 2026 verileri - API ile aynı dedup mantığı
  const result = await pool.request().query(`
    SELECT 
      [FİRMA NUMARASI], [FİRMA ADI], [İŞ YERİ], [AMBAR], [TÜR],
      [MALZEME/HİZMET KODU], [MASRAF MERKEZİ],
      [TALEP NUMARASI], [TALEP EDEN], [TALEP TARİHİ],
      [TALEP ONAYLAYAN], [TALEP ONAY TARİHİ], [TALEP AÇIKLAMA],
      [SİPARİŞ NUMARASI], [SİPARİŞİ AÇAN], [SİPARİŞ TARİHİ],
      [SİPARİŞ ONAYLAYAN], [SİPARİŞ ONAY TARİHİ], [SİPARİŞ MALZEME],
      [TESLİM EVRAK NO], [TESLİM TARİHİ], [CARİ ÜNVANI], [TESLİM ALAN],
      [AÇIKLAMA], [MİKTAR], [BİRİM], [ÖDEME VADESİ], [PARA BİRİMİ],
      [BİRİM FİYAT], [TOPLAM], [FATURAYI KAYDEDEN],
      [FATURA KAYDETME TARİHİ], [FATURA TARİHİ], [FATURA NO]
    FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY [SİPARİŞ NUMARASI], [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT]
        ORDER BY (SELECT NULL)
      ) as _rn
      FROM YLZ_TALEP_SIPARIS
      WHERE ([TÜR] IS NOT NULL AND [TÜR] <> '')
        AND [SİPARİŞ TARİHİ] >= '2026-01-01' AND [SİPARİŞ TARİHİ] < '2026-02-01'
    ) dd WHERE dd._rn = 1
    ORDER BY [SİPARİŞ TARİHİ] DESC
  `);
  
  console.log('SQL Ocak kayit sayisi:', result.recordset.length);
  
  // Normalize et - dataProcessor ile uyumlu format
  const records = result.recordset.map(r => {
    // Teslim durumu: FATURAYI KAYDEDEN doluysa veya Ocak siparişi olduğu için teslim edilmiş kabul et
    const faturayiKaydeden = r['FATURAYI KAYDEDEN'] || 'OCAK_TESLIM';
    
    return {
      FIRMA_NUMARASI: r['FİRMA NUMARASI'],
      FIRMA_ADI: r['FİRMA ADI'],
      ISYERI: r['İŞ YERİ'],
      AMBAR: r['AMBAR'],
      TUR: r['TÜR'],
      MALZEME_HIZMET_KODU: r['MALZEME/HİZMET KODU'],
      MASRAF_MERKEZI: r['MASRAF MERKEZİ'] || 'Belirsiz',
      TALEP_NO: r['TALEP NUMARASI'],
      TALEP_EDEN: r['TALEP EDEN'],
      TALEP_TARIHI: r['TALEP TARİHİ'],
      TALEP_ONAYLAYAN: r['TALEP ONAYLAYAN'],
      TALEP_ONAY_TARIHI: r['TALEP ONAY TARİHİ'],
      TALEP_ACIKLAMA: r['TALEP AÇIKLAMA'],
      SIPARIS_NO: r['SİPARİŞ NUMARASI'],
      SIPARISI_ACAN: r['SİPARİŞİ AÇAN'],
      SIPARIS_TARIHI: r['SİPARİŞ TARİHİ'],
      SIPARIS_ONAYLAYAN: r['SİPARİŞ ONAYLAYAN'],
      SIPARIS_ONAY_TARIHI: r['SİPARİŞ ONAY TARİHİ'],
      SIPARIS_MALZEME: r['SİPARİŞ MALZEME'],
      TESLIM_EVRAK_NO: r['TESLİM EVRAK NO'],
      TESLIM_TARIHI: r['TESLİM TARİHİ'],
      CARI_UNVANI: r['CARİ ÜNVANI'],
      TESLIM_ALAN: r['TESLİM ALAN'],
      ACIKLAMA: r['AÇIKLAMA'],
      MIKTAR: r['MİKTAR'],
      BIRIM: r['BİRİM'],
      ODEME_VADESI: r['ÖDEME VADESİ'],
      PARA_BIRIMI: r['PARA BİRİMİ'],
      BIRIM_FIYAT: r['BİRİM FİYAT'],
      TOPLAM: r['TOPLAM'],
      FATURAYI_KAYDEDEN: faturayiKaydeden,
      FATURA_KAYDETME_TARIHI: r['FATURA KAYDETME TARİHİ'],
      FATURA_TARIHI: r['FATURA TARİHİ'],
      FATURA_NO: r['FATURA NO'],
    };
  });
  
  // İstatistikler
  const ambarCount = {};
  const siparisSet = new Set();
  let toplam = 0;
  records.forEach(r => {
    ambarCount[r.AMBAR] = (ambarCount[r.AMBAR] || 0) + 1;
    siparisSet.add(r.SIPARIS_NO);
    toplam += (Number(r.TOPLAM) || 0);
  });
  
  console.log('\nKayit sayisi:', records.length);
  console.log('Benzersiz siparis:', siparisSet.size);
  console.log('Toplam tutar:', toplam.toFixed(2));
  console.log('\nAmbar dagilimi:');
  Object.entries(ambarCount).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(' ', k, ':', v));
  
  // Cemre Pet kontrol
  const cemre = records.filter(r => (r.CARI_UNVANI || '').toUpperCase().includes('CEMRE'));
  console.log('\nCemre Pet kayitlari:', cemre.length);
  let cemreTotal = 0;
  cemre.forEach(r => {
    cemreTotal += (Number(r.TOPLAM) || 0);
    console.log(' ', r.SIPARIS_NO, '|', r.SIPARIS_MALZEME, '|', r.TOPLAM);
  });
  console.log('Cemre Pet toplam:', cemreTotal);
  
  // JSON dosyasını kaydet
  const outputPath = path.join(__dirname, 'masaustu/mobile/src/data/ocak_2026_data.json');
  
  // Backup al
  const backupPath = outputPath + '.backup_excel.json';
  if (fs.existsSync(outputPath)) {
    fs.copyFileSync(outputPath, backupPath);
    console.log('\nEski dosya yedeklendi:', backupPath);
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(records, null, 2), 'utf-8');
  console.log('Yeni Ocak JSON kaydedildi:', outputPath);
  console.log('Toplam kayit:', records.length);
  
  await pool.close();
}

main().catch(e => { console.error(e); process.exit(1); });
