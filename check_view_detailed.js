const sql = require('mssql');

const config = {
  server: '10.35.20.15\\SQLSRV',
  database: 'SNCG',
  user: 'ozgur.copkur',
  password: 'Oz2025!!',
  options: { encrypt: false, trustServerCertificate: true }
};

async function main() {
  const pool = await sql.connect(config);

  // 1. View tanımını al
  console.log('=== 1. VIEW TANIMI ===');
  const viewDef = await pool.request().query(`
    SELECT OBJECT_DEFINITION(OBJECT_ID('YLZ_TALEP_SIPARIS')) AS ViewDef
  `);
  console.log(viewDef.recordset[0].ViewDef);

  // 2. View'daki tüm kolonları listele
  console.log('\n=== 2. VIEW KOLONLARI ===');
  const cols = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'YLZ_TALEP_SIPARIS'
    ORDER BY ORDINAL_POSITION
  `);
  cols.recordset.forEach(c => console.log(' ', c.COLUMN_NAME, '|', c.DATA_TYPE, c.CHARACTER_MAXIMUM_LENGTH ? '(' + c.CHARACTER_MAXIMUM_LENGTH + ')' : ''));

  // 3. Toplam kayıt sayısı
  console.log('\n=== 3. TOPLAM KAYIT SAYILARI ===');
  const total = await pool.request().query(`SELECT COUNT(*) as cnt FROM YLZ_TALEP_SIPARIS`);
  console.log('View toplam:', total.recordset[0].cnt);

  const totalWithTur = await pool.request().query(`
    SELECT COUNT(*) as cnt FROM YLZ_TALEP_SIPARIS WHERE [TÜR] IS NOT NULL AND [TÜR] <> ''
  `);
  console.log('TUR dolu:', totalWithTur.recordset[0].cnt);

  // 4. Ocak + Subat ayrımı
  const ocakRaw = await pool.request().query(`
    SELECT COUNT(*) as cnt FROM YLZ_TALEP_SIPARIS
    WHERE [SİPARİŞ TARİHİ] >= '2026-01-01' AND [SİPARİŞ TARİHİ] < '2026-02-01'
      AND [TÜR] IS NOT NULL AND [TÜR] <> ''
  `);
  const subatRaw = await pool.request().query(`
    SELECT COUNT(*) as cnt FROM YLZ_TALEP_SIPARIS
    WHERE [SİPARİŞ TARİHİ] >= '2026-02-01'
      AND [TÜR] IS NOT NULL AND [TÜR] <> ''
  `);
  console.log('Ocak ham:', ocakRaw.recordset[0].cnt);
  console.log('Subat+ ham:', subatRaw.recordset[0].cnt);

  // 5. Dedup sonrası
  const ocakDedup = await pool.request().query(`
    SELECT COUNT(*) as cnt FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY [SİPARİŞ NUMARASI], [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT]
        ORDER BY (SELECT NULL)
      ) as _rn FROM YLZ_TALEP_SIPARIS
      WHERE [SİPARİŞ TARİHİ] >= '2026-01-01' AND [SİPARİŞ TARİHİ] < '2026-02-01'
        AND [TÜR] IS NOT NULL AND [TÜR] <> ''
    ) dd WHERE dd._rn = 1
  `);
  const subatDedup = await pool.request().query(`
    SELECT COUNT(*) as cnt FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY [SİPARİŞ NUMARASI], [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT]
        ORDER BY (SELECT NULL)
      ) as _rn FROM YLZ_TALEP_SIPARIS
      WHERE [SİPARİŞ TARİHİ] >= '2026-02-01'
        AND [TÜR] IS NOT NULL AND [TÜR] <> ''
    ) dd WHERE dd._rn = 1
  `);
  console.log('Ocak dedup:', ocakDedup.recordset[0].cnt);
  console.log('Subat+ dedup:', subatDedup.recordset[0].cnt);
  console.log('Fan-out orani (Ocak):', (ocakRaw.recordset[0].cnt / ocakDedup.recordset[0].cnt).toFixed(2) + 'x');
  console.log('Fan-out orani (Subat):', (subatRaw.recordset[0].cnt / subatDedup.recordset[0].cnt).toFixed(2) + 'x');

  // 6. View'ın JOIN ettiği tabloları ve fan-out kaynağını bul
  console.log('\n=== 4. FAN-OUT ANALİZİ ===');
  // En çok duplicate olan siparişler
  const topDups = await pool.request().query(`
    SELECT TOP 10 [SİPARİŞ NUMARASI] as SIP, 
      COUNT(*) as HAM, 
      COUNT(DISTINCT CONCAT([SİPARİŞ MALZEME],'|',[MİKTAR],'|',[BİRİM FİYAT])) as TEKIL
    FROM YLZ_TALEP_SIPARIS
    WHERE [SİPARİŞ TARİHİ] >= '2026-01-01' AND [TÜR] IS NOT NULL AND [TÜR] <> ''
    GROUP BY [SİPARİŞ NUMARASI]
    HAVING COUNT(*) > COUNT(DISTINCT CONCAT([SİPARİŞ MALZEME],'|',[MİKTAR],'|',[BİRİM FİYAT]))
    ORDER BY COUNT(*) DESC
  `);
  console.log('En cok duplicate siparis:');
  topDups.recordset.forEach(r => console.log(' ', r.SIP, '| Ham:', r.HAM, '| Tekil:', r.TEKIL, '| Fan-out:', (r.HAM/r.TEKIL).toFixed(1) + 'x'));

  // 7. TOPLAM = MIKTAR * BIRIM_FIYAT kontrolü
  console.log('\n=== 5. TOPLAM TUTARLILIK KONTROLÜ ===');
  const tutarKontrol = await pool.request().query(`
    SELECT TOP 20 [SİPARİŞ NUMARASI] as SIP, [SİPARİŞ MALZEME] as MAL,
      [MİKTAR], [BİRİM FİYAT] as BF, [TOPLAM],
      ([MİKTAR] * [BİRİM FİYAT]) as HESAPLANAN,
      ABS([TOPLAM] - ([MİKTAR] * [BİRİM FİYAT])) as FARK
    FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY [SİPARİŞ NUMARASI], [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT]
        ORDER BY (SELECT NULL)
      ) as _rn FROM YLZ_TALEP_SIPARIS
      WHERE [TÜR] IS NOT NULL AND [TÜR] <> '' AND [SİPARİŞ TARİHİ] >= '2026-01-01'
    ) dd WHERE dd._rn = 1 AND [TOPLAM] IS NOT NULL AND [MİKTAR] IS NOT NULL AND [BİRİM FİYAT] IS NOT NULL
      AND ABS([TOPLAM] - ([MİKTAR] * [BİRİM FİYAT])) > 1
    ORDER BY ABS([TOPLAM] - ([MİKTAR] * [BİRİM FİYAT])) DESC
  `);
  if (tutarKontrol.recordset.length === 0) {
    console.log('TOPLAM = MIKTAR * BIRIM_FIYAT her yerde tutarli');
  } else {
    console.log('TOPLAM tutarsiz kayitlar:');
    tutarKontrol.recordset.forEach(r => {
      console.log(' ', r.SIP, '|', (r.MAL||'').substring(0,30), '| Miktar:', r.MİKTAR, '| BF:', r.BF, '| Toplam:', r.TOPLAM, '| Hesaplanan:', r.HESAPLANAN?.toFixed(2), '| Fark:', r.FARK?.toFixed(2));
    });
  }

  // 8. NULL kontrolü - önemli alanların boş olma durumu
  console.log('\n=== 6. NULL/BOŞ ALAN KONTROLÜ ===');
  const nullCheck = await pool.request().query(`
    SELECT 
      SUM(CASE WHEN [SİPARİŞ NUMARASI] IS NULL OR [SİPARİŞ NUMARASI] = '' THEN 1 ELSE 0 END) as SIPARIS_NULL,
      SUM(CASE WHEN [CARİ ÜNVANI] IS NULL OR [CARİ ÜNVANI] = '' THEN 1 ELSE 0 END) as CARI_NULL,
      SUM(CASE WHEN [AMBAR] IS NULL OR [AMBAR] = '' THEN 1 ELSE 0 END) as AMBAR_NULL,
      SUM(CASE WHEN [TOPLAM] IS NULL THEN 1 ELSE 0 END) as TOPLAM_NULL,
      SUM(CASE WHEN [MİKTAR] IS NULL THEN 1 ELSE 0 END) as MIKTAR_NULL,
      SUM(CASE WHEN [BİRİM FİYAT] IS NULL THEN 1 ELSE 0 END) as BF_NULL,
      SUM(CASE WHEN [SİPARİŞ TARİHİ] IS NULL THEN 1 ELSE 0 END) as TARIH_NULL,
      SUM(CASE WHEN [MASRAF MERKEZİ] IS NULL OR [MASRAF MERKEZİ] = '' THEN 1 ELSE 0 END) as MASRAF_NULL,
      SUM(CASE WHEN [SİPARİŞ MALZEME] IS NULL OR [SİPARİŞ MALZEME] = '' THEN 1 ELSE 0 END) as MALZEME_NULL,
      COUNT(*) as TOPLAM_KAYIT
    FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY [SİPARİŞ NUMARASI], [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT]
        ORDER BY (SELECT NULL)
      ) as _rn FROM YLZ_TALEP_SIPARIS
      WHERE [TÜR] IS NOT NULL AND [TÜR] <> '' AND [SİPARİŞ TARİHİ] >= '2026-01-01'
    ) dd WHERE dd._rn = 1
  `);
  const nc = nullCheck.recordset[0];
  console.log('Toplam kayit:', nc.TOPLAM_KAYIT);
  console.log('Siparis No NULL:', nc.SIPARIS_NULL);
  console.log('Cari Unvani NULL:', nc.CARI_NULL);
  console.log('Ambar NULL:', nc.AMBAR_NULL);
  console.log('Toplam NULL:', nc.TOPLAM_NULL);
  console.log('Miktar NULL:', nc.MIKTAR_NULL);
  console.log('Birim Fiyat NULL:', nc.BF_NULL);
  console.log('Siparis Tarihi NULL:', nc.TARIH_NULL);
  console.log('Masraf Merkezi NULL:', nc.MASRAF_NULL);
  console.log('Siparis Malzeme NULL:', nc.MALZEME_NULL);

  // 9. Şubat Excel'den birkaç kayıt ile birebir doğrulama
  console.log('\n=== 7. EXCEL vs SQL BİREBİR DOĞRULAMA ===');
  const excelChecks = [
    { sip: 'S.ACM.GAN.000082', excelKdvDahil: 1755775.44, kdvOran: 1.2, aciklama: 'Cemre Pet' },
    { sip: 'S.ACM.GAN.000083', excelKdvDahil: 308917.2, kdvOran: 1.2, aciklama: 'Piramit Iskele' },
    { sip: 'S.ACM.GAN.000084', excelKdvDahil: 573101.76, kdvOran: 2.2, aciklama: 'SIA Makina ($ kur farki?)' },
    { sip: 'S.ACM.GAN.000093', excelKdvDahil: 228000, kdvOran: 1.2, aciklama: 'Mondi Turkey' },
    { sip: 'S.ACM.GAN.000127', excelKdvDahil: 2565000, kdvOran: 1.14, aciklama: 'Dolphin' },
    { sip: 'S.ACM.İZM.000040', excelKdvDahil: 1104000, kdvOran: 1.0, aciklama: 'Lobitek (KDV istisnasi)' },
  ];

  for (const check of excelChecks) {
    const r = await pool.request().query(`
      SELECT [SİPARİŞ NUMARASI] as SIP, [CARİ ÜNVANI] as CARI,
        SUM([TOPLAM]) as SQL_TOPLAM,
        COUNT(*) as HAM_KAYIT,
        COUNT(DISTINCT CONCAT([SİPARİŞ MALZEME],'|',[MİKTAR],'|',[BİRİM FİYAT])) as TEKIL_KALEM
      FROM YLZ_TALEP_SIPARIS
      WHERE [SİPARİŞ NUMARASI] = '${check.sip}'
      GROUP BY [SİPARİŞ NUMARASI], [CARİ ÜNVANI]
    `);
    
    const dedup = await pool.request().query(`
      SELECT SUM([TOPLAM]) as DEDUP_TOPLAM FROM (
        SELECT *, ROW_NUMBER() OVER (
          PARTITION BY [SİPARİŞ NUMARASI], [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT]
          ORDER BY (SELECT NULL)
        ) as _rn FROM YLZ_TALEP_SIPARIS
        WHERE [SİPARİŞ NUMARASI] = '${check.sip}'
      ) dd WHERE dd._rn = 1
    `);
    
    const row = r.recordset[0];
    const dedupRow = dedup.recordset[0];
    if (!row) { console.log(check.sip, '- BULUNAMADI'); continue; }
    
    const beklenenKdvHaric = check.excelKdvDahil / check.kdvOran;
    const match = Math.abs(dedupRow.DEDUP_TOPLAM - beklenenKdvHaric) < 1;
    
    console.log(`\n${check.sip} (${check.aciklama}):`);
    console.log(`  Cari: ${(row.CARI||'').substring(0,40)}`);
    console.log(`  Ham kayit: ${row.HAM_KAYIT} | Tekil kalem: ${row.TEKIL_KALEM}`);
    console.log(`  SQL ham toplam: ${row.SQL_TOPLAM?.toFixed(2)} | SQL dedup toplam: ${dedupRow.DEDUP_TOPLAM?.toFixed(2)}`);
    console.log(`  Excel KDV dahil: ${check.excelKdvDahil} | Excel/KDV orani: ${check.kdvOran}`);
    console.log(`  Beklenen KDV haric: ${beklenenKdvHaric.toFixed(2)}`);
    console.log(`  Eslesme: ${match ? '✅' : '❌'} (fark: ${Math.abs(dedupRow.DEDUP_TOPLAM - beklenenKdvHaric).toFixed(2)})`);
  }

  // 10. View'daki kaynak tabloları bul
  console.log('\n=== 8. VIEW KAYNAK TABLOLARI ===');
  const deps = await pool.request().query(`
    SELECT DISTINCT 
      referenced_entity_name as TABLO
    FROM sys.dm_sql_referenced_entities('dbo.YLZ_TALEP_SIPARIS', 'OBJECT')
    WHERE referenced_entity_name IS NOT NULL
  `);
  console.log('View referans tablolar:');
  deps.recordset.forEach(r => console.log(' ', r.TABLO));

  // 11. AMBAR normalizasyon kontrolü
  console.log('\n=== 9. AMBAR DEĞERLERİ ===');
  const ambarValues = await pool.request().query(`
    SELECT DISTINCT [AMBAR], COUNT(*) as CNT
    FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY [SİPARİŞ NUMARASI], [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT]
        ORDER BY (SELECT NULL)
      ) as _rn FROM YLZ_TALEP_SIPARIS
      WHERE [TÜR] IS NOT NULL AND [TÜR] <> '' AND [SİPARİŞ TARİHİ] >= '2026-01-01'
    ) dd WHERE dd._rn = 1
    GROUP BY [AMBAR]
    ORDER BY [AMBAR]
  `);
  ambarValues.recordset.forEach(r => console.log(' ', JSON.stringify(r.AMBAR), ':', r.CNT));

  // 12. FATURAYI KAYDEDEN doluluk (teslim bilgisi)
  console.log('\n=== 10. TESLİM DURUMU ===');
  const teslimCheck = await pool.request().query(`
    SELECT 
      SUM(CASE WHEN [FATURAYI KAYDEDEN] IS NOT NULL AND [FATURAYI KAYDEDEN] <> '' THEN 1 ELSE 0 END) as TESLIM,
      SUM(CASE WHEN [FATURAYI KAYDEDEN] IS NULL OR [FATURAYI KAYDEDEN] = '' THEN 1 ELSE 0 END) as BEKLEYEN,
      COUNT(*) as TOPLAM
    FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY [SİPARİŞ NUMARASI], [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT]
        ORDER BY (SELECT NULL)
      ) as _rn FROM YLZ_TALEP_SIPARIS
      WHERE [TÜR] IS NOT NULL AND [TÜR] <> '' AND [SİPARİŞ TARİHİ] >= '2026-02-01'
    ) dd WHERE dd._rn = 1
  `);
  const tc = teslimCheck.recordset[0];
  console.log('Subat+ Teslim edilen:', tc.TESLIM);
  console.log('Subat+ Bekleyen:', tc.BEKLEYEN);
  console.log('Subat+ Toplam:', tc.TOPLAM);

  await pool.close();
}

main().catch(e => { console.error(e); process.exit(1); });
