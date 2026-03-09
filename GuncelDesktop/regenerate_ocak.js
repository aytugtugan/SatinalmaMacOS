// Ocak 2026 statik verilerini SQL'den doğru dedup ile yeniden çek
const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const config = {
  server: '10.35.20.15\\SQLSRV',
  database: 'SNCG',
  user: 'ozgur.copkur',
  password: 'Oz2025!!',
  options: { encrypt: false, trustServerCertificate: true },
  requestTimeout: 120000,
  connectionTimeout: 30000,
  pool: { max: 5, idleTimeoutMillis: 30000 }
};

async function main() {
  const pool = await sql.connect(config);
  
  // Doğru dedup key ile Ocak verilerini çek
  const query = `
    SELECT 
      [FİRMA NUMARASI], [FİRMA ADI], [İŞ YERİ], [AMBAR], [TÜR],
      [MALZEME/HİZMET KODU], [MASRAF MERKEZİ],
      [TALEP NUMARASI], [TALEP EDEN], [TALEP TARİHİ],
      [TALEP ONAYLAYAN], [TALEP ONAY TARİHİ], [TALEP AÇIKLAMA],
      [SİPARİŞ NUMARASI], [SİPARİŞİ AÇAN], [SİPARİŞ TARİHİ],
      [SİPARİŞ ONAYLAYAN], [SİPARİŞ ONAY TARİHİ], [SİPARİŞ MALZEME],
      [TESLİM EVRAK NO], [TESLİM TARİHİ], [CARİ ÜNVANI], [TESLİM ALAN],
      [AÇIKLAMA], [MİKTAR], [BİRİM], [ÖDEME VADESİ], [PARA BİRİMİ],
      [BİRİM FİYAT], [TOPLAM],
      [FATURAYI KAYDEDEN], [FATURA KAYDETME TARİHİ], [FATURA TARİHİ], [FATURA NO]
    FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY [SİPARİŞ NUMARASI], [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT]
        ORDER BY (SELECT NULL)
      ) as _rn
      FROM YLZ_TALEP_SIPARIS
      WHERE [SİPARİŞ TARİHİ] >= '2026-01-01' AND [SİPARİŞ TARİHİ] < '2026-02-01'
        AND [TÜR] IS NOT NULL AND [TÜR] <> ''
    ) dd
    WHERE dd._rn = 1
    ORDER BY [SİPARİŞ TARİHİ] DESC
  `;
  
  const result = await pool.request().query(query);
  const rows = result.recordset;
  
  console.log(`SQL'den ${rows.length} tekil kayıt çekildi`);
  
  // Statik JSON formatına dönüştür (mobile ve desktop uyumlu alan adları)
  const mapped = rows.map(r => ({
    FIRMA_NUMARASI: r['FİRMA NUMARASI'],
    FIRMA_ADI: r['FİRMA ADI'],
    ISYERI: r['İŞ YERİ'],
    AMBAR: r['AMBAR'],
    TUR: r['TÜR'],
    MALZEME_HIZMET_KODU: r['MALZEME/HİZMET KODU'],
    MASRAF_MERKEZI: r['MASRAF MERKEZİ'],
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
    FATURAYI_KAYDEDEN: r['FATURAYI KAYDEDEN'],
    FATURA_KAYDETME_TARIHI: r['FATURA KAYDETME TARİHİ'],
    FATURA_TARIHI: r['FATURA TARİHİ'],
    FATURA_NO: r['FATURA NO'],
  }));
  
  // Benzersiz sipariş sayısı
  const uniqueSiparis = new Set(mapped.map(r => r.SIPARIS_NO).filter(Boolean));
  console.log(`Benzersiz sipariş: ${uniqueSiparis.size}`);
  
  // GAZİANTEP kontrolü
  const gaz = mapped.filter(r => r.AMBAR && r.AMBAR.toUpperCase().includes('GAZİANTEP'));
  const gazSiparis = new Set(gaz.map(r => r.SIPARIS_NO).filter(Boolean));
  console.log(`GAZİANTEP kayıt: ${gaz.length}, benzersiz sipariş: ${gazSiparis.size}`);
  
  // Dosyaya yaz
  const outPath = path.join(__dirname, 'ocak_2026_data.json');
  
  // Backup
  if (fs.existsSync(outPath)) {
    const backupPath = outPath + '.backup2.json';
    fs.copyFileSync(outPath, backupPath);
    console.log(`Yedek: ${backupPath}`);
  }
  
  fs.writeFileSync(outPath, JSON.stringify(mapped, null, 2), 'utf8');
  console.log(`✅ ${outPath} güncellendi (${mapped.length} kayıt)`);
  
  // Mobil statik dosyayı da güncelle
  const mobileStaticPath = path.join(__dirname, '..', 'masaustu', 'mobile', 'src', 'data', 'ocak_2026_static.json');
  if (fs.existsSync(mobileStaticPath)) {
    fs.writeFileSync(mobileStaticPath, JSON.stringify(mapped, null, 2), 'utf8');
    console.log(`✅ ${mobileStaticPath} güncellendi`);
  } else {
    console.log(`⚠️ Mobil statik dosya bulunamadı: ${mobileStaticPath}`);
    // Alternatif yol dene
    const altPath = path.join(__dirname, '..', 'masaustu', 'mobile', 'src', 'data', 'ocak_2026_data.json');
    if (fs.existsSync(altPath)) {
      fs.writeFileSync(altPath, JSON.stringify(mapped, null, 2), 'utf8');
      console.log(`✅ ${altPath} güncellendi`);
    }
  }
  
  await pool.close();
}

main().catch(e => { console.error(e); process.exit(1); });
