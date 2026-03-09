// Düzeltilen dedup key ile verileri doğrula
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
};

async function main() {
  const pool = await sql.connect(config);
  
  // ---- 1. SQL Şubat+ verileri (doğru dedup ile) ----
  const subatQuery = `
    SELECT COUNT(*) as totalRows, 
      COUNT(DISTINCT [SİPARİŞ NUMARASI]) as uniqueSiparis,
      ISNULL(SUM([TOPLAM]),0) as toplamTutar
    FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY [SİPARİŞ NUMARASI], [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT]
        ORDER BY (SELECT NULL)
      ) as _rn
      FROM YLZ_TALEP_SIPARIS
      WHERE ([TÜR] IS NOT NULL AND [TÜR] <> '')
        AND ([TALEP TARİHİ] >= '2026-02-01' OR [SİPARİŞ TARİHİ] >= '2026-02-01')
    ) dd WHERE dd._rn = 1
  `;
  const subatResult = await pool.request().query(subatQuery);
  console.log('=== ŞUBAT+ SQL (doğru dedup) ===');
  console.log(subatResult.recordset[0]);

  // ---- 2. SQL Şubat+ GAZİANTEP ----
  const subatGazQuery = `
    SELECT COUNT(*) as totalRows,
      COUNT(DISTINCT [SİPARİŞ NUMARASI]) as uniqueSiparis,
      ISNULL(SUM([TOPLAM]),0) as toplamTutar
    FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY [SİPARİŞ NUMARASI], [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT]
        ORDER BY (SELECT NULL)
      ) as _rn
      FROM YLZ_TALEP_SIPARIS
      WHERE ([TÜR] IS NOT NULL AND [TÜR] <> '')
        AND ([TALEP TARİHİ] >= '2026-02-01' OR [SİPARİŞ TARİHİ] >= '2026-02-01')
        AND UPPER([AMBAR]) = UPPER('Gaziantep')
    ) dd WHERE dd._rn = 1
  `;
  const subatGazResult = await pool.request().query(subatGazQuery);
  console.log('\n=== ŞUBAT+ GAZİANTEP (doğru dedup) ===');
  console.log(subatGazResult.recordset[0]);

  // ---- 3. Statik Ocak verileri ----
  const staticData = JSON.parse(fs.readFileSync(path.join(__dirname, 'ocak_2026_data.json'), 'utf8'));
  const ocakAll = staticData.filter(r => r.TUR && r.TUR !== '');
  
  // Doğru dedup uygula
  const seenKeys = new Set();
  const ocakDeduped = ocakAll.filter(r => {
    const key = `${r.SIPARIS_NO || ''}|${r.SIPARIS_MALZEME || ''}|${r.MIKTAR || ''}|${r.BIRIM_FIYAT || ''}`;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });

  const ocakSiparis = new Set(ocakDeduped.map(r => r.SIPARIS_NO).filter(Boolean));
  const ocakToplam = ocakDeduped.reduce((s,r) => s + (Number(r.TOPLAM) || 0), 0);
  console.log('\n=== OCAK STATİK (doğru dedup) ===');
  console.log(`Kayıt: ${ocakDeduped.length}, Sipariş: ${ocakSiparis.size}, Toplam: ${ocakToplam.toLocaleString('tr-TR')}`);

  // Gaziantep Ocak
  const ocakGaz = ocakDeduped.filter(r => r.AMBAR === 'Gaziantep');
  const ocakGazSiparis = new Set(ocakGaz.map(r => r.SIPARIS_NO).filter(Boolean));
  const ocakGazToplam = ocakGaz.reduce((s,r) => s + (Number(r.TOPLAM) || 0), 0);
  console.log('\n=== OCAK GAZİANTEP (doğru dedup) ===');
  console.log(`Kayıt: ${ocakGaz.length}, Sipariş: ${ocakGazSiparis.size}, Toplam: ${ocakGazToplam.toLocaleString('tr-TR')}`);

  // ---- 4. Combined (Ocak statik + Şubat+ SQL) GAZİANTEP bilgileri ----
  const combinedGazSiparis = subatGazResult.recordset[0].uniqueSiparis + ocakGazSiparis.size;
  const combinedGazToplam = subatGazResult.recordset[0].toplamTutar + ocakGazToplam;
  console.log('\n=== BİRLEŞİK GAZİANTEP ===');
  console.log(`Sipariş: ${combinedGazSiparis}, Toplam: ${combinedGazToplam.toLocaleString('tr-TR')}`);

  // ---- 5. Aylık Trend karşılaştırması (SQL Şubat+) ----
  const monthlyQuery = `
    SELECT FORMAT([SİPARİŞ TARİHİ], 'yyyy-MM') as ay,
      COUNT(DISTINCT [SİPARİŞ NUMARASI]) as siparisAdedi,
      ISNULL(SUM([TOPLAM]),0) as toplamTutar
    FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY [SİPARİŞ NUMARASI], [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT]
        ORDER BY (SELECT NULL)
      ) as _rn
      FROM YLZ_TALEP_SIPARIS
      WHERE ([TÜR] IS NOT NULL AND [TÜR] <> '')
        AND ([TALEP TARİHİ] >= '2026-02-01' OR [SİPARİŞ TARİHİ] >= '2026-02-01')
        AND UPPER([AMBAR]) = UPPER('Gaziantep')
    ) dd WHERE dd._rn = 1
    GROUP BY FORMAT([SİPARİŞ TARİHİ], 'yyyy-MM')
    ORDER BY ay
  `;
  const monthlyResult = await pool.request().query(monthlyQuery);
  console.log('\n=== GAZİANTEP AYLIK TREND (Şubat+ SQL) ===');
  for (const r of monthlyResult.recordset) {
    console.log(`  ${r.ay}: sipariş=${r.siparisAdedi}, tutar=${Number(r.toplamTutar).toLocaleString('tr-TR')}`);
  }

  // ---- 6. Teslim durumu (GAZİANTEP, tüm aylar combined) ----
  const teslimQuery = `
    SELECT 
      CASE WHEN t.hasE = 1 THEN 'Teslim Edildi' ELSE 'Teslim Bekliyor' END as durum,
      COUNT(*) as siparisAdedi,
      ISNULL(SUM(t.toplamTutar),0) as toplamTutar
    FROM (
      SELECT [SİPARİŞ NUMARASI],
        MAX(CASE WHEN [FATURAYI KAYDEDEN] IS NOT NULL AND [FATURAYI KAYDEDEN] <> '' THEN 1 ELSE 0 END) as hasE,
        ISNULL(SUM([TOPLAM]),0) as toplamTutar
      FROM (
        SELECT *, ROW_NUMBER() OVER (
          PARTITION BY [SİPARİŞ NUMARASI], [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT]
          ORDER BY (SELECT NULL)
        ) as _rn
        FROM YLZ_TALEP_SIPARIS
        WHERE ([TÜR] IS NOT NULL AND [TÜR] <> '')
          AND ([TALEP TARİHİ] >= '2026-02-01' OR [SİPARİŞ TARİHİ] >= '2026-02-01')
          AND UPPER([AMBAR]) = UPPER('Gaziantep')
          AND [SİPARİŞ NUMARASI] IS NOT NULL
      ) dd WHERE dd._rn = 1
      GROUP BY [SİPARİŞ NUMARASI]
    ) t
    GROUP BY t.hasE
  `;
  const teslimResult = await pool.request().query(teslimQuery);
  console.log('\n=== GAZİANTEP TESLİM DURUMU (Şubat+ SQL) ===');
  for (const r of teslimResult.recordset) {
    console.log(`  ${r.durum}: sipariş=${r.siparisAdedi}, tutar=${Number(r.toplamTutar).toLocaleString('tr-TR')}`);
  }

  // ---- 7. Top 5 Tedarikçi (tüm ambarlar) - Cemre Pet kontrolü ----
  const cemreQuery = `
    SELECT TOP 5 [CARİ ÜNVANI] as tedarikci,
      COUNT(DISTINCT [SİPARİŞ NUMARASI]) as siparisAdedi,
      ISNULL(SUM([TOPLAM]),0) as toplamTutar
    FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY [SİPARİŞ NUMARASI], [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT]
        ORDER BY (SELECT NULL)
      ) as _rn
      FROM YLZ_TALEP_SIPARIS
      WHERE ([TÜR] IS NOT NULL AND [TÜR] <> '')
        AND ([TALEP TARİHİ] >= '2026-02-01' OR [SİPARİŞ TARİHİ] >= '2026-02-01')
        AND [CARİ ÜNVANI] IS NOT NULL AND [CARİ ÜNVANI] <> ''
    ) dd WHERE dd._rn = 1
    GROUP BY [CARİ ÜNVANI]
    ORDER BY toplamTutar DESC
  `;
  const cemreResult = await pool.request().query(cemreQuery);
  console.log('\n=== TOP 5 TEDARİKÇİ (Şubat+ SQL, doğru dedup) ===');
  for (const r of cemreResult.recordset) {
    console.log(`  ${r.tedarikci}: sipariş=${r.siparisAdedi}, tutar=${Number(r.toplamTutar).toLocaleString('tr-TR')}`);
  }

  console.log('\n✅ Doğrulama tamamlandı');
  await pool.close();
}

main().catch(e => { console.error(e); process.exit(1); });
