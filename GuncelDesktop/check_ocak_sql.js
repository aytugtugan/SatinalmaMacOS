const db = require('./database');

async function main() {
  const pool = await db.getPool();
  
  // Total Ocak records
  const r1 = await pool.request().query(`
    SELECT COUNT(*) as cnt 
    FROM YLZ_TALEP_SIPARIS 
    WHERE [TÜR] IS NOT NULL AND [TÜR] <> '' 
      AND [SİPARİŞ TARİHİ] < '2026-02-01'
  `);
  console.log('SQL Ocak toplam kayıt:', r1.recordset[0].cnt);
  
  // Unique siparis
  const r2 = await pool.request().query(`
    SELECT COUNT(DISTINCT [SİPARİŞ NUMARASI]) as cnt 
    FROM YLZ_TALEP_SIPARIS 
    WHERE [TÜR] IS NOT NULL AND [TÜR] <> '' 
      AND [SİPARİŞ TARİHİ] < '2026-02-01'
  `);
  console.log('SQL Ocak unique sipariş:', r2.recordset[0].cnt);
  
  // Ambar dağılımı
  const r3 = await pool.request().query(`
    SELECT [AMBAR], COUNT(*) as cnt, COUNT(DISTINCT [SİPARİŞ NUMARASI]) as uniqueSip 
    FROM YLZ_TALEP_SIPARIS 
    WHERE [TÜR] IS NOT NULL AND [TÜR] <> '' 
      AND [SİPARİŞ TARİHİ] < '2026-02-01'
    GROUP BY [AMBAR]
    ORDER BY cnt DESC
  `);
  console.log('\nAmbar dağılımı:');
  r3.recordset.forEach(row => {
    console.log(`  ${row.AMBAR}: ${row.cnt} kayıt, ${row.uniqueSip} unique sipariş`);
  });
  
  // Dedup ile unique kayıt sayısı
  const r4 = await pool.request().query(`
    SELECT COUNT(*) as cnt FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY [SİPARİŞ NUMARASI], [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT]
        ORDER BY (SELECT NULL)
      ) as _rn
      FROM YLZ_TALEP_SIPARIS
      WHERE [TÜR] IS NOT NULL AND [TÜR] <> ''
        AND [SİPARİŞ TARİHİ] < '2026-02-01'
    ) dd WHERE dd._rn = 1
  `);
  console.log('\nDedup sonrası toplam kayıt:', r4.recordset[0].cnt);
  
  // Dedup ile ambar dağılımı
  const r5 = await pool.request().query(`
    SELECT dd.[AMBAR], COUNT(*) as cnt, COUNT(DISTINCT dd.[SİPARİŞ NUMARASI]) as uniqueSip 
    FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY [SİPARİŞ NUMARASI], [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT]
        ORDER BY (SELECT NULL)
      ) as _rn
      FROM YLZ_TALEP_SIPARIS
      WHERE [TÜR] IS NOT NULL AND [TÜR] <> ''
        AND [SİPARİŞ TARİHİ] < '2026-02-01'
    ) dd WHERE dd._rn = 1
    GROUP BY dd.[AMBAR]
    ORDER BY cnt DESC
  `);
  console.log('\nDedup ambar dağılımı:');
  r5.recordset.forEach(row => {
    console.log(`  ${row.AMBAR}: ${row.cnt} kayıt, ${row.uniqueSip} unique sipariş`);
  });

  // Excel'deki sipariş numaralarından SQL'de olmayanları kontrol et
  const XLSX = require('xlsx');
  const path = require('path');
  const wb = XLSX.readFile(path.join(__dirname, '..', 'ocak.xls'));
  const ws = wb.Sheets[wb.SheetNames[0]];
  const excelData = XLSX.utils.sheet_to_json(ws);
  const excelSiparis = [...new Set(excelData.map(r => r['Fiş No.']).filter(Boolean))];
  
  console.log('\n=== Excel vs SQL karşılaştırma ===');
  console.log('Excel unique sipariş:', excelSiparis.length);
  
  // Check each Excel sipariş in SQL
  let foundInSQL = 0;
  let notInSQL = [];
  for (const sip of excelSiparis) {
    const r = await pool.request()
      .input('sip', sip)
      .query(`SELECT COUNT(*) as cnt FROM YLZ_TALEP_SIPARIS WHERE [SİPARİŞ NUMARASI] = @sip`);
    if (r.recordset[0].cnt > 0) {
      foundInSQL++;
    } else {
      notInSQL.push(sip);
    }
  }
  console.log('SQL\'de bulunan:', foundInSQL);
  console.log('SQL\'de bulunmayan:', notInSQL.length);
  notInSQL.forEach(s => {
    const row = excelData.find(r => r['Fiş No.'] === s);
    console.log('  !', s, '|', row['Cari Hesap Unvanı']);
  });

  process.exit(0);
}

main().catch(e => { console.error('Hata:', e.message); process.exit(1); });
