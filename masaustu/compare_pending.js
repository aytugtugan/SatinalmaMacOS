(async ()=>{
  try{
    const db=require('./database');
    const C = await db.getColumnMapping();
    const q = (col)=>'['+String(col).replace(/]/g,']]')+']';
    const DATE_FILTER='2026-01-01';
    const whereClause = `(${q(C.TALEP_TARIHI)} >= '${DATE_FILTER}' OR ${q(C.SIPARIS_TARIHI)} >= '${DATE_FILTER}')`;
    const pendingSql = `SELECT DISTINCT ${q(C.SIPARIS_NO)} as siparis_no FROM YLZ_TALEP_SIPARIS WHERE (${q(C.TESLIM_EVRAK_NO)} IS NULL OR ${q(C.TESLIM_EVRAK_NO)} = '') AND ${q(C.SIPARIS_NO)} IS NOT NULL AND ${whereClause}`;
    const pendingRows = await db.executeQuery(pendingSql);
    const pendingSet = new Set(pendingRows.map(r=>r.siparis_no));

      // SQL v2: treat SIPARIS_NO as delivered if ANY row for that SIPARIS_NO has a non-empty TESLIM_EVRAK_NO
      const pendingSqlV2 = `SELECT DISTINCT ${q(C.SIPARIS_NO)} as siparis_no FROM YLZ_TALEP_SIPARIS main WHERE NOT EXISTS (SELECT 1 FROM YLZ_TALEP_SIPARIS t2 WHERE t2.${q(C.SIPARIS_NO)} = main.${q(C.SIPARIS_NO)} AND (t2.${q(C.TESLIM_EVRAK_NO)} IS NOT NULL AND t2.${q(C.TESLIM_EVRAK_NO)} <> '')) AND main.${q(C.SIPARIS_NO)} IS NOT NULL AND ${whereClause}`;
      const pendingRowsV2 = await db.executeQuery(pendingSqlV2);
      const pendingSetV2 = new Set(pendingRowsV2.map(r=>r.siparis_no));

    const all = await db.getAllData();
    const rows = all.data || all;
    const siparisMap = new Map();
    for(const item of rows){
      const id=item.SIPARIS_NO;
      if(!id) continue;
      const evrakNo=item.TESLIM_EVRAK_NO;
      const delivered = evrakNo && String(evrakNo).trim()!=='';
      const prev=siparisMap.get(id)||{delivered:false};
      siparisMap.set(id,{delivered: prev.delivered||delivered});
    }
    const computedPendingSet = new Set(Array.from(siparisMap.entries()).filter(([k,v])=>!v.delivered).map(([k,v])=>k));

    const onlyInSql = Array.from(pendingSet).filter(x=>!computedPendingSet.has(x));
    const onlyInComputed = Array.from(computedPendingSet).filter(x=>!pendingSet.has(x));

    console.log('pendingSet SQL count', pendingSet.size, 'computedPending count', computedPendingSet.size);
    console.log('onlyInSql count', onlyInSql.length, 'onlyInComputed count', onlyInComputed.length);
    console.log('onlyInSql sample', onlyInSql.slice(0,20));
    console.log('onlyInComputed sample', onlyInComputed.slice(0,20));

    // Compare SQL v2 (NOT EXISTS) with computed set
    const onlyInSqlV2 = Array.from(pendingSetV2).filter(x=>!computedPendingSet.has(x));
    const onlyInComputedV2 = Array.from(computedPendingSet).filter(x=>!pendingSetV2.has(x));
    console.log('pendingSet SQL v2 count', pendingSetV2.size);
    console.log('onlyInSqlV2 count', onlyInSqlV2.length, 'onlyInComputedV2 count', onlyInComputedV2.length);
    console.log('onlyInSqlV2 sample', onlyInSqlV2.slice(0,20));
    console.log('onlyInComputedV2 sample', onlyInComputedV2.slice(0,20));
    process.exit(0);
  }catch(e){ console.error(e); process.exit(2); }
})();
