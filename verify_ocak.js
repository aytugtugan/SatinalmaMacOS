const fs = require('fs');
const path = require('path');

const files = [
  'GuncelDesktop/ocak_2026_data.json',
  'masaustu/ocak_2026_data.json',
  'masaustu/mobile/src/data/ocak_2026_data.json',
];

const base = '/Users/aytugtugan/PROJELER/SatinAlma';

for (const f of files) {
  const full = path.join(base, f);
  if (!fs.existsSync(full)) { console.log('YOK:', f); continue; }
  const d = JSON.parse(fs.readFileSync(full, 'utf8'));
  const r = d.records || [];
  
  let emptyFK = 0, starFK = 0, nullTE = 0, nullTT = 0, nullTA = 0;
  for (const x of r) {
    if (!x.FATURAYI_KAYDEDEN || x.FATURAYI_KAYDEDEN === '') emptyFK++;
    if (x.FATURAYI_KAYDEDEN === '*') starFK++;
    if (!x.TESLIM_EVRAK_NO || x.TESLIM_EVRAK_NO === '') nullTE++;
    if (!x.TESLIM_TARIHI) nullTT++;
    if (!x.TESLIM_ALAN || x.TESLIM_ALAN === '') nullTA++;
  }
  
  console.log(`\n${f} (${r.length} kayit):`);
  console.log(`  Bos FATURAYI_KAYDEDEN: ${emptyFK}`);
  console.log(`  Yildiz FATURAYI_KAYDEDEN: ${starFK}`);
  console.log(`  Bos TESLIM_EVRAK_NO: ${nullTE}`);
  console.log(`  Bos TESLIM_TARIHI: ${nullTT}`);
  console.log(`  Bos TESLIM_ALAN: ${nullTA}`);
  
  // Siparis bazinda kontrol
  const sipMap = new Map();
  for (const x of r) {
    if (!x.SIPARIS_NO) continue;
    if (!sipMap.has(x.SIPARIS_NO)) sipMap.set(x.SIPARIS_NO, []);
    sipMap.get(x.SIPARIS_NO).push(x);
  }
  let delivered = 0, pending = 0;
  for (const [sip, recs] of sipMap) {
    const anyDelivered = recs.some(x => x.FATURAYI_KAYDEDEN && x.FATURAYI_KAYDEDEN !== '');
    if (anyDelivered) delivered++; else pending++;
  }
  console.log(`  Siparis: ${sipMap.size} (Teslim: ${delivered}, Bekleyen: ${pending})`);
}
