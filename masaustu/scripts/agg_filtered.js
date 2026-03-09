const db = require('../database');

(async () => {
  try {
    const all = await db.getAllData();
    const rows = all.data || all;
    const agg = {};
    let totalTop = 0, totalTRY = 0;
    for (const r of rows) {
      const cur = (r.PARA_BIRIMI || 'TRY').toString().trim();
      const top = Number(r.TOPLAM) || 0;
      const tTRY = (r.TOPLAM_TRY != null && !Number.isNaN(Number(r.TOPLAM_TRY))) ? Number(r.TOPLAM_TRY) : 0;
      totalTop += top; totalTRY += tTRY;
      if (!agg[cur]) agg[cur] = { count: 0, sumTop: 0, sumTRY: 0, rows: [] };
      agg[cur].count++; agg[cur].sumTop += top; agg[cur].sumTRY += tTRY;
      if (agg[cur].rows.length < 5) agg[cur].rows.push({ SIPARIS_NO: r.SIPARIS_NO, TOPLAM: top, TOPLAM_TRY: tTRY });
    }

    console.log('ROWS', rows.length);
    console.log('TOTAL_RAW_SUM', Math.round(totalTop * 100) / 100);
    console.log('TOTAL_TRY_SUM', Math.round(totalTRY * 100) / 100);
    for (const k of Object.keys(agg)) {
      const a = agg[k];
      const impl = a.sumTop ? (a.sumTRY / a.sumTop) : null;
      console.log('---', k, 'count', a.count, 'sumTop', Math.round(a.sumTop * 100) / 100, 'sumTRY', Math.round(a.sumTRY * 100) / 100, 'impliedRate', impl ? Math.round(impl * 1000000) / 1000000 : 'N/A');
      console.log(' samples:', JSON.stringify(a.rows));
    }

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
