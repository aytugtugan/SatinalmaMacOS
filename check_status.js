const fs = require('fs');
const d = JSON.parse(fs.readFileSync('/Users/aytugtugan/PROJELER/SatinAlma/GuncelDesktop/ocak_2026_data.json','utf8'));
const r = d.records;
let nullTE=0, nullTT=0, nullTA=0, emptyFK=0, starFK=0;
r.forEach(x => {
  if (x.TESLIM_EVRAK_NO === null) nullTE++;
  if (x.TESLIM_TARIHI === null) nullTT++;
  if (x.TESLIM_ALAN === null) nullTA++;
  if (x.FATURAYI_KAYDEDEN === '' || x.FATURAYI_KAYDEDEN === null || x.FATURAYI_KAYDEDEN === undefined) emptyFK++;
  if (x.FATURAYI_KAYDEDEN === '*') starFK++;
});
console.log('null TESLIM_EVRAK_NO:', nullTE);
console.log('null TESLIM_TARIHI:', nullTT);
console.log('null TESLIM_ALAN:', nullTA);
console.log('empty FATURAYI_KAYDEDEN:', emptyFK);
console.log('star FATURAYI_KAYDEDEN:', starFK);
console.log('meta:', JSON.stringify(d.meta, null, 2));
console.log('Sample record (first):', JSON.stringify(d.records[0], null, 2));
console.log('Sample record (last):', JSON.stringify(d.records[d.records.length-1], null, 2));
