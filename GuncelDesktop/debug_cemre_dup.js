const sql = require('mssql');
const config = {
  server: '10.35.20.15\\SQLSRV', database: 'SNCG', user: 'ozgur.copkur', password: 'Oz2025!!',
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
  requestTimeout: 30000, connectionTimeout: 15000
};

(async () => {
  const pool = await sql.connect(config);
  
  // Subat kayitlarinin malzeme bazinda duplikasyon analizi
  const r = await pool.request().query(`
    SELECT [SİPARİŞ MALZEME] as MALZEME, 
           COUNT(*) as KAYIT_SAYISI, 
           ISNULL(SUM(TOPLAM),0) as TOPLAM_SUM,
           MIN(TOPLAM) as TOPLAM_EACH
    FROM YLZ_TALEP_SIPARIS 
    WHERE [CARİ ÜNVANI] LIKE '%CEMRE%' 
      AND ([TALEP TARİHİ] >= '2026-02-01' OR [SİPARİŞ TARİHİ] >= '2026-02-01')
    GROUP BY [SİPARİŞ MALZEME]
    ORDER BY TOPLAM_SUM DESC
  `);
  
  console.log('=== SUBAT 2026+ CEMRE PET: MALZEME BAZINDA DUPLIKASYON ===');
  let grandTotal = 0;
  let correctTotal = 0;
  r.recordset.forEach(row => {
    grandTotal += row.TOPLAM_SUM;
    correctTotal += row.TOPLAM_EACH;
    const isDup = row.KAYIT_SAYISI > 1 ? ' *** DUPLIKE ***' : '';
    console.log(`${row.MALZEME}: ${row.KAYIT_SAYISI} kayit x ${row.TOPLAM_EACH} = ${row.TOPLAM_SUM}${isDup}`);
  });
  console.log('---');
  console.log('SQL SUM (duplike dahil):', grandTotal);
  console.log('Dogru SUM (1 kayit/malzeme):', correctTotal);
  console.log('Ocak statik:', 1463146.2);
  console.log('Ocak + Dogru Subat:', 1463146.2 + correctTotal);
  console.log('Beklenen:', 2926292);

  // Genel duplikasyon kontrolu - tum tedarikçiler
  console.log('\n=== GENEL DUPLIKASYON TESTI (tum tedarikçiler) ===');
  const allDup = await pool.request().query(`
    SELECT TOP 10
      [CARİ ÜNVANI] as TEDARIKCI,
      COUNT(*) as KAYIT_SAYISI,
      COUNT(DISTINCT [SİPARİŞ NUMARASI]) as TEKIL_SIPARIS,
      COUNT(DISTINCT [SİPARİŞ MALZEME]) as TEKIL_MALZEME,
      ISNULL(SUM(TOPLAM),0) as TOPLAM_SUM
    FROM YLZ_TALEP_SIPARIS 
    WHERE ([TALEP TARİHİ] >= '2026-02-01' OR [SİPARİŞ TARİHİ] >= '2026-02-01')
      AND [TÜR] IS NOT NULL AND [TÜR] <> ''
    GROUP BY [CARİ ÜNVANI]
    HAVING COUNT(*) > COUNT(DISTINCT CONCAT([SİPARİŞ NUMARASI], '|', [SİPARİŞ MALZEME]))
    ORDER BY TOPLAM_SUM DESC
  `);
  
  if (allDup.recordset.length > 0) {
    console.log('Duplike kayitli tedarikçiler:');
    allDup.recordset.forEach(row => {
      console.log(`  ${(row.TEDARIKCI||'').substring(0,40)} | ${row.KAYIT_SAYISI} kayit / ${row.TEKIL_SIPARIS} siparis / ${row.TEKIL_MALZEME} malzeme | SUM: ${row.TOPLAM_SUM}`);
    });
  } else {
    console.log('Duplike kayit bulunamadi');
  }
  
  await pool.close();
})().catch(e => console.error(e.message));
