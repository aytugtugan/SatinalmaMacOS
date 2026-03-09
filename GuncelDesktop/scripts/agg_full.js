const db = require('../database');

(async () => {
  try {
    const C = await db.getColumnMapping();
    const q = (col) => '[' + String(col).replace(/]/g, ']]') + ']';
    const sql = `SELECT ISNULL(${q(C.PARA_BIRIMI)}, 'TRY') as cur, COUNT(*) as countRows, ISNULL(SUM(${q(C.TOPLAM)}),0) as sumTop FROM YLZ_TALEP_SIPARIS GROUP BY ISNULL(${q(C.PARA_BIRIMI)}, 'TRY') ORDER BY sumTop DESC`;
    const res = await db.executeQuery(sql);
    console.log('FULL-TABLE PER-CURRENCY:');
    console.log(res);
    // also grand totals
    const total = await db.executeQuery(`SELECT ISNULL(SUM(${q(C.TOPLAM)}),0) as totalTop FROM YLZ_TALEP_SIPARIS`);
    console.log('FULL TOTAL RAW SUM:', total[0].totalTop);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
