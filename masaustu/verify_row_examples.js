(async ()=>{
  try{
    const db = require('./database');
    const stats = await db.getDashboardStats('all');
    const raw = stats.paraBirimi || [];
    const conv = stats.paraBirimiConverted || [];
    const rawMap = Object.fromEntries(raw.map(r=>[ (r.paraBirimi||'TRY').toString().trim().toUpperCase(), Number(r.toplamTutar)||0 ]));
    const convMap = Object.fromEntries(conv.map(r=>[ (r.paraBirimi||'TRY').toString().trim().toUpperCase(), Number(r.convertedTRY)||0 ]));
    const rateMap = {};
    for(const k of Object.keys(rawMap)){
      const rawTot = rawMap[k];
      const convTot = convMap[k] || 0;
      if(rawTot && rawTot !== 0) rateMap[k] = convTot / rawTot;
      else rateMap[k] = k==='TL' || k==='TRY' ? 1 : null;
    }
    console.log('Derived rateMap (TRY per unit):', rateMap);

    const all = await db.getAllData();
    const rows = all.data || all;
    const usdRows = rows.filter(r=> (String(r.PARA_BIRIMI||'').toUpperCase().includes('USD')) ).slice(0,10);
    console.log('\nSample USD rows (first 10):');
    for(const r of usdRows){
      const orig = Number(r.TOPLAM)||0;
      const existing = Number(r.TOPLAM_TRY)||0;
      const code = (r.PARA_BIRIMI||'USD').toString().trim().toUpperCase();
      const rate = rateMap[code] || null;
      const expected = rate ? orig * rate : null;
      const diff = expected!=null ? existing - expected : null;
      console.log({ SIPARIS_NO: r.SIPARIS_NO, PARA_BIRIMI: r.PARA_BIRIMI, TOPLAM_orig: orig, expected_TOPLAM_TRY: expected, existing_TOPLAM_TRY: existing, rate });
    }

    // show mismatches across all currencies (threshold 0.1)
    const mismatches = [];
    for(const r of rows){
      const code = (r.PARA_BIRIMI||'TRY').toString().trim().toUpperCase();
      const orig = Number(r.TOPLAM)||0;
      const existing = Number(r.TOPLAM_TRY)||0;
      const rate = rateMap[code] || (code==='TL' || code==='TRY'?1:null);
      const expected = rate ? orig * rate : null;
      if(expected==null) continue;
      const d = Math.abs(existing - expected);
      if(d > 0.1){ // show notable mismatches
        mismatches.push({ SIPARIS_NO: r.SIPARIS_NO, PARA_BIRIMI: r.PARA_BIRIMI, TOPLAM_orig: orig, expected_TOPLAM_TRY: expected, existing_TOPLAM_TRY: existing, diff: d });
      }
    }
    console.log('\nTotal rows checked:', rows.length, 'Notable mismatches (>0.1):', mismatches.length);
    if(mismatches.length>0) console.log('Some mismatches sample:', mismatches.slice(0,10));
    else console.log('No notable mismatches found.');
    process.exit(0);
  }catch(e){ console.error('ERR', e); process.exit(2); }
})();
