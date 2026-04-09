const https = require('https');
const db = require('../database');

function getJson(url, timeout = 8000){
  return new Promise((resolve, reject)=>{
    const req = https.get(url, (res)=>{
      let raw=''; res.on('data', c=> raw+=c); res.on('end', ()=>{ try{ resolve(JSON.parse(raw)); }catch(e){ reject(e); } });
    });
    req.on('error', e=> reject(e));
    req.setTimeout(timeout, ()=> req.destroy(new Error('timeout')));
  });
}

(async ()=>{
  try{
    const C = await db.getColumnMapping();
    const q = (col) => '[' + String(col).replace(/]/g, ']]') + ']';
    const sql = `SELECT ISNULL(${q(C.PARA_BIRIMI)}, 'TRY') as cur, ISNULL(SUM(${q(C.TOPLAM)}),0) as sumTop FROM YLZ_TALEP_SIPARIS GROUP BY ISNULL(${q(C.PARA_BIRIMI)}, 'TRY')`;
    const rows = await db.executeQuery(sql);
    // fetch rates with base TRY
    const api = 'https://api.exchangerate.host/latest?base=TRY';
    const payload = await getJson(api);
    const rates = (payload && payload.rates) ? payload.rates : {};
    let totalTRY = 0;
    console.log('FULL-TABLE CONVERTED:');
    for(const r of rows){
      const cur = (r.cur||'TRY').toString().trim();
      const sumTop = Number(r.sumTop)||0;
      if(cur==='TRY'){
        console.log(cur, sumTop.toFixed(2), '=>', sumTop.toFixed(2),'TRY');
        totalTRY += sumTop;
      } else {
        const rate = rates[cur];
        if(rate && rate!==0){
          const curToTry = 1 / rate;
          const conv = sumTop * curToTry;
          console.log(cur, sumTop.toFixed(2), '=>', Math.round(conv*100)/100, 'TRY (implied rate', Math.round(curToTry*1000000)/1000000,')');
          totalTRY += conv;
        } else {
          console.log(cur, sumTop.toFixed(2), '=> no rate');
        }
      }
    }
    console.log('FULL TOTAL CONVERTED TRY:', Math.round(totalTRY*100)/100);
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1);} 
})();
