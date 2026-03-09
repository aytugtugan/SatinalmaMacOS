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

    // 1. TESTKURUMSOFT / 00000001 fis nolu
    console.log('\n=== TESTKURUMSOFT / 00000001 ===');
    const r1 = await sql.query`
      SELECT [SİPARİŞ NUMARASI], [SİPARİŞ TARİHİ], [SİPARİŞ MALZEME], [AMBAR], [TÜR], [CARİ ÜNVANI], [TOPLAM], [FATURAYI KAYDEDEN]
      FROM YLZ_TALEP_SIPARIS
      WHERE [SİPARİŞ NUMARASI] LIKE '%00000001%' OR [CARİ ÜNVANI] LIKE '%TESTKURUMSOFT%'
    `;
    console.log('Rows:', r1.recordset.length);
    r1.recordset.forEach(r => console.log(JSON.stringify(r)));

    // 2. S.ACM.GAN.000017
    console.log('\n=== S.ACM.GAN.000017 ===');
    const r2 = await sql.query`
      SELECT [SİPARİŞ NUMARASI], [SİPARİŞ TARİHİ], [SİPARİŞ MALZEME], [AMBAR], [TÜR], [TOPLAM], [CARİ ÜNVANI], [FATURAYI KAYDEDEN]
      FROM YLZ_TALEP_SIPARIS
      WHERE [SİPARİŞ NUMARASI] = 'S.ACM.GAN.000017'
    `;
    console.log('Rows:', r2.recordset.length);
    r2.recordset.forEach(r => console.log(JSON.stringify(r)));

    // 3. S.ACM.GAN.000050
    console.log('\n=== S.ACM.GAN.000050 ===');
    const r3 = await sql.query`
      SELECT [SİPARİŞ NUMARASI], [SİPARİŞ TARİHİ], [SİPARİŞ MALZEME], [AMBAR], [TÜR], [TOPLAM], [CARİ ÜNVANI], [FATURAYI KAYDEDEN]
      FROM YLZ_TALEP_SIPARIS
      WHERE [SİPARİŞ NUMARASI] = 'S.ACM.GAN.000050'
    `;
    console.log('Rows:', r3.recordset.length);
    r3.recordset.forEach(r => console.log(JSON.stringify(r)));

    // 4. S.ACM.GAN.000055
    console.log('\n=== S.ACM.GAN.000055 ===');
    const r4 = await sql.query`
      SELECT [SİPARİŞ NUMARASI], [SİPARİŞ TARİHİ], [SİPARİŞ MALZEME], [AMBAR], [TÜR], [TOPLAM], [CARİ ÜNVANI], [FATURAYI KAYDEDEN]
      FROM YLZ_TALEP_SIPARIS
      WHERE [SİPARİŞ NUMARASI] = 'S.ACM.GAN.000055'
    `;
    console.log('Rows:', r4.recordset.length);
    r4.recordset.forEach(r => console.log(JSON.stringify(r)));

  } catch(e) {
    console.error(e.message);
  } finally {
    await sql.close();
  }
}
main();
