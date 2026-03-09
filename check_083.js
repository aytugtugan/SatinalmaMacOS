const sql = require('mssql');
const config = {
  server: '10.35.20.15',
  port: 1433,
  database: 'SNCG',
  user: 'ozgur.copkur',
  password: 'Oz2025!!',
  options: { encrypt: false, trustServerCertificate: true, instanceName: 'SQLSRV' }
};

async function main() {
  try {
    await sql.connect(config);
    // 1. Düz sorgu
    const result = await sql.query`
      SELECT [SİPARİŞ NUMARASI], [SİPARİŞ TARİHİ], [SİPARİŞ MALZEME], [AMBAR], [TÜR], 
             [MİKTAR], [BİRİM FİYAT], [TOPLAM], [CARİ ÜNVANI], [FATURAYI KAYDEDEN]
      FROM YLZ_TALEP_SIPARIS
      WHERE [SİPARİŞ NUMARASI] = 'S.ACM.GAN.000083'
    `;
    
    // 2. ROW_NUMBER ile (API'nin kullandığı query)
    const result2 = await sql.query`
      SELECT * FROM (
        SELECT [SİPARİŞ NUMARASI], [SİPARİŞ TARİHİ], [SİPARİŞ MALZEME], [AMBAR], [TÜR], 
               [MİKTAR], [BİRİM FİYAT], [TOPLAM], [CARİ ÜNVANI], [FATURAYI KAYDEDEN],
               ROW_NUMBER() OVER (
                 PARTITION BY [SİPARİŞ NUMARASI], [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT]
                 ORDER BY (SELECT NULL)
               ) as _rn
        FROM YLZ_TALEP_SIPARIS
        WHERE ([TÜR] IS NOT NULL AND [TÜR] <> '')
          AND [SİPARİŞ TARİHİ] >= '2026-02-01'
      ) dd
      WHERE dd._rn = 1 AND dd.[SİPARİŞ NUMARASI] = 'S.ACM.GAN.000083'
    `;
    console.log('\n--- With ROW_NUMBER (API query) ---');
    console.log('Row count:', result2.recordset.length);
    result2.recordset.forEach(r => console.log(JSON.stringify(r)));

    // 3. View'da kaç kere var?
    const result3 = await sql.query`
      SELECT [SİPARİŞ NUMARASI], [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT], COUNT(*) as cnt
      FROM YLZ_TALEP_SIPARIS
      WHERE [SİPARİŞ NUMARASI] = 'S.ACM.GAN.000083'
      GROUP BY [SİPARİŞ NUMARASI], [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT]
    `;
    console.log('\n--- Fan-out check ---');
    result3.recordset.forEach(r => console.log(JSON.stringify(r)));
    console.log('Row count:', result.recordset.length);
    result.recordset.forEach(r => console.log(JSON.stringify(r)));
  } catch(e) {
    console.error(e.message);
  } finally {
    await sql.close();
  }
}
main();
