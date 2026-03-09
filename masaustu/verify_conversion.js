(async ()=>{
  try{
    const db = require('./database');
    const res = await db.getDashboardStats('all');
    console.log('--- SUMMARY ---');
    console.log(JSON.stringify(res.summary, null, 2));
    console.log('\n--- PARA BIRIMI RAW (sample) ---');
    console.log(JSON.stringify((res.paraBirimi||[]).slice(0,10), null, 2));
    console.log('\n--- PARA BIRIMI CONVERTED (sample) ---');
    console.log(JSON.stringify((res.paraBirimiConverted||[]).slice(0,10), null, 2));
    const sumConverted = (res.paraBirimiConverted||[]).reduce((s,it)=>s + (Number(it.convertedTRY||it.toplam||0)),0);
    console.log('\nsum of paraBirimiConverted.convertedTRY (computed):', sumConverted);
    const all = await db.getAllData();
    const rows = all.data || all;
    const rowSum = rows.reduce((s,r)=>s + (Number(r.TOPLAM_TRY||0)),0);
    const missing = rows.filter(r=>r.TOPLAM_TRY==null).length;
    console.log('rows:', rows.length, 'missing TOPLAM_TRY:', missing, 'rowSum TOPLAM_TRY:', rowSum);
    console.log('\ndiff rowSum vs summary.toplamTutarTRY:', rowSum - (res.summary.toplamTutarTRY||0));
    console.log('\ndiff sumConverted vs summary.toplamTutarTRY:', sumConverted - (res.summary.toplamTutarTRY||0));
    console.log('\nTop converted currencies:');
    (res.paraBirimiConverted||[]).sort((a,b)=>(b.convertedTRY||b.toplam||0)-(a.convertedTRY||a.toplam||0)).slice(0,10).forEach(p=>console.log(p.paraBirimi, 'raw:', p.toplam, 'convertedTRY:', p.convertedTRY));
    process.exit(0);
  }catch(e){
    console.error('ERR', e);
    process.exit(2);
  }
})();
