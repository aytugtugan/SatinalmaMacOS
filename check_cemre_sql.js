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
  
  // 1. Cemre Pet HAM verileri (dedup olmadan) - 082
  console.log('=== S.ACM.GAN.000082 HAM VERİLER ===');
  const raw082 = await pool.request().query(`
    SELECT [SİPARİŞ NUMARASI], [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT], [TOPLAM], [AMBAR], [CARİ ÜNVANI]
    FROM YLZ_TALEP_SIPARIS
    WHERE [SİPARİŞ NUMARASI] = 'S.ACM.GAN.000082'
  `);
  console.log('Ham kayit sayisi:', raw082.recordset.length);
  raw082.recordset.forEach(r => {
    console.log(r['SİPARİŞ MALZEME'], '|', 'Miktar:', r['MİKTAR'], '|', 'BirimFiyat:', r['BİRİM FİYAT'], '|', 'Toplam:', r['TOPLAM']);
  });
  
  // 2. Cemre Pet DEDUP sonrasi (API ile ayni sorgu)
  console.log('\n=== S.ACM.GAN.000082 DEDUP SONRASI ===');
  const dedup082 = await pool.request().query(`
    SELECT [SİPARİŞ NUMARASI], [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT], [TOPLAM]
    FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY [SİPARİŞ NUMARASI], [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT]
        ORDER BY (SELECT NULL)
      ) as _rn
      FROM YLZ_TALEP_SIPARIS
      WHERE [SİPARİŞ NUMARASI] = 'S.ACM.GAN.000082'
    ) dd WHERE dd._rn = 1
  `);
  console.log('Dedup kayit sayisi:', dedup082.recordset.length);
  let dedupTotal = 0;
  dedup082.recordset.forEach(r => {
    dedupTotal += (r['TOPLAM'] || 0);
    console.log(r['SİPARİŞ MALZEME'], '|', 'Miktar:', r['MİKTAR'], '|', 'BirimFiyat:', r['BİRİM FİYAT'], '|', 'Toplam:', r['TOPLAM']);
  });
  console.log('Dedup Toplam:', dedupTotal);
  
  // 3. Tüm Cemre Pet siparişleri (tüm aylar, GAN)
  console.log('\n=== TÜM CEMRE PET SİPARİŞLERİ (GAN) ===');
  const allCemre = await pool.request().query(`
    SELECT [SİPARİŞ NUMARASI], [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT], [TOPLAM], [SİPARİŞ TARİHİ], [AMBAR]
    FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY [SİPARİŞ NUMARASI], [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT]
        ORDER BY (SELECT NULL)
      ) as _rn
      FROM YLZ_TALEP_SIPARIS
      WHERE [CARİ ÜNVANI] LIKE '%CEMRE%'
    ) dd WHERE dd._rn = 1
    ORDER BY [SİPARİŞ TARİHİ] DESC
  `);
  console.log('Toplam kayit:', allCemre.recordset.length);
  let allCemreTotal = 0;
  allCemre.recordset.forEach(r => {
    allCemreTotal += (r['TOPLAM'] || 0);
    const tarih = r['SİPARİŞ TARİHİ'] ? new Date(r['SİPARİŞ TARİHİ']).toISOString().substring(0,10) : 'null';
    console.log(r['SİPARİŞ NUMARASI'], '|', tarih, '|', r['AMBAR'], '|', (r['SİPARİŞ MALZEME']||'').substring(0,40), '|', r['TOPLAM']);
  });
  console.log('Tüm Cemre Toplam:', allCemreTotal);
  
  // 4. S.ACM.GAN.000083 kontrol
  console.log('\n=== S.ACM.GAN.000083 ===');
  const r083 = await pool.request().query(`
    SELECT [SİPARİŞ NUMARASI], [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT], [TOPLAM], [CARİ ÜNVANI], [AMBAR], [SİPARİŞ TARİHİ]
    FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY [SİPARİŞ NUMARASI], [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT]
        ORDER BY (SELECT NULL)
      ) as _rn
      FROM YLZ_TALEP_SIPARIS
      WHERE [SİPARİŞ NUMARASI] = 'S.ACM.GAN.000083'
    ) dd WHERE dd._rn = 1
  `);
  console.log('Kayit sayisi:', r083.recordset.length);
  r083.recordset.forEach(r => {
    console.log(r['SİPARİŞ NUMARASI'], '|', r['CARİ ÜNVANI'], '|', r['SİPARİŞ MALZEME'], '|', r['TOPLAM'], '|', r['AMBAR']);
  });

  // 5. Distinct SIPARIS_MALZEME + MIKTAR + BIRIM_FIYAT for 082
  console.log('\n=== 082 DISTINCT COMBINATION ===');
  const dist082 = await pool.request().query(`
    SELECT DISTINCT [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT], [TOPLAM]
    FROM YLZ_TALEP_SIPARIS
    WHERE [SİPARİŞ NUMARASI] = 'S.ACM.GAN.000082'
  `);
  console.log('Distinct combination:', dist082.recordset.length);
  let distTotal = 0;
  dist082.recordset.forEach(r => {
    distTotal += (r['TOPLAM'] || 0);
    console.log(r['SİPARİŞ MALZEME'], '|', 'Miktar:', r['MİKTAR'], '|', 'BirimFiyat:', r['BİRİM FİYAT'], '|', 'Toplam:', r['TOPLAM']);
  });
  console.log('Distinct Toplam:', distTotal);
  
  await pool.close();
}

main().catch(e => { console.error(e); process.exit(1); });
