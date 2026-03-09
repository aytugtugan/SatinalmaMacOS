const sql = require('mssql');

const config = {
  server: '10.35.20.15\\SQLSRV',
  database: 'SNCG',
  user: 'ozgur.copkur',
  password: 'Oz2025!!',
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
};

async function main() {
  const pool = await sql.connect(config);

  // 1) Bu sipariş numaraları var mı?
  const r1 = await pool.request().query(`
    SELECT [SİPARİŞ NUMARASI], [SİPARİŞ TARİHİ], [AMBAR], [TÜR], [CARİ ÜNVANI], [TOPLAM], [SİPARİŞ MALZEME]
    FROM YLZ_TALEP_SIPARIS
    WHERE [SİPARİŞ NUMARASI] IN ('S.ACM.GAN.000082', 'S.ACM.GAN.000083', 'S.ACM.GAN000082', 'S.ACM.GAN000083')
  `);
  console.log('=== Aranan siparişler ===');
  console.log('Bulunan:', r1.recordset.length);
  r1.recordset.forEach(r => console.log(r['SİPARİŞ NUMARASI'], '|', r['SİPARİŞ TARİHİ'], '|', r['AMBAR'], '|', r['TÜR'], '|', r['CARİ ÜNVANI'], '|', r['TOPLAM']));

  // 2) Şubat verilerinde kaç kayıt var?
  const r2 = await pool.request().query(`
    SELECT COUNT(*) as cnt FROM YLZ_TALEP_SIPARIS
    WHERE [SİPARİŞ TARİHİ] >= '2026-02-01' AND [TÜR] IS NOT NULL AND [TÜR] <> ''
  `);
  console.log('\nŞubat+ toplam kayıt:', r2.recordset[0].cnt);

  // 3) Son siparişler (en yüksek numaralar)
  const r3 = await pool.request().query(`
    SELECT DISTINCT [SİPARİŞ NUMARASI], [SİPARİŞ TARİHİ], [AMBAR]
    FROM YLZ_TALEP_SIPARIS
    WHERE [SİPARİŞ NUMARASI] LIKE 'S.ACM.GAN.%'
      AND [TÜR] IS NOT NULL AND [TÜR] <> ''
    ORDER BY [SİPARİŞ NUMARASI] DESC
  `);
  console.log('\nSon 10 GAN siparişi:');
  r3.recordset.slice(0, 10).forEach(r => console.log(r['SİPARİŞ NUMARASI'], '|', r['SİPARİŞ TARİHİ'], '|', r['AMBAR']));

  // 4) Tire hariç Şubat siparişleri
  const r4 = await pool.request().query(`
    SELECT DISTINCT [SİPARİŞ NUMARASI], [SİPARİŞ TARİHİ], [AMBAR]
    FROM YLZ_TALEP_SIPARIS
    WHERE [SİPARİŞ TARİHİ] >= '2026-02-01'
      AND [TÜR] IS NOT NULL AND [TÜR] <> ''
      AND UPPER([AMBAR]) <> 'TİRE' AND UPPER([AMBAR]) <> 'TIRE'
    ORDER BY [SİPARİŞ NUMARASI] DESC
  `);
  console.log('\nŞubat+ unique siparişler (Tire hariç):', r4.recordset.length);
  r4.recordset.slice(0, 15).forEach(r => console.log(r['SİPARİŞ NUMARASI'], '|', r['SİPARİŞ TARİHİ'], '|', r['AMBAR']));

  await pool.close();
}

main().catch(e => { console.error('HATA:', e.message); process.exit(1); });
