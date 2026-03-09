const fs = require('fs');
const path = 'ocak_2026_data.json';
const out = 'ocak_2026_data.cleaned.json';
const obj = JSON.parse(fs.readFileSync(path, 'utf8'));
const data = obj.records || obj || [];
const isBad = r => {
  const am = (r.AMBAR||'').toString().trim();
  const fn = (r.FIRMA_NUMARASI||'').toString().trim();
  if (/^\d+$/.test(am)) return true; // AMBAR is purely numeric
  if (fn === '"' || fn === '""' || fn === '') return true; // suspicious firma num
  // if more than half of main fields are null/empty, mark bad
  const keys = ['FIRMA_NUMARASI','FIRMA_ADI','ISYERI','AMBAR','TALEP_NO','CARI_UNVANI'];
  const empty = keys.reduce((s,k)=> s + (!(r[k]||'').toString().trim()),0);
  if (empty >= Math.ceil(keys.length/2)) return true;
  return false;
}
const bad = data.filter(isBad);
const good = data.filter(r=>!isBad(r));
const outObj = { meta: Object.assign({}, obj.meta||{}, { cleanedAt: new Date().toISOString(), originalCount: data.length, cleanedCount: good.length }), records: good };
fs.writeFileSync(out, JSON.stringify(outObj, null, 2), 'utf8');
console.log('Original:', data.length, 'Kept:', good.length, 'Removed:', bad.length);
if (bad.length) console.log('Sample removed record:', JSON.stringify(bad[0], null, 2));
