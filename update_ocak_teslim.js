/**
 * Ocak 2026 verilerini güncelle - Tüm siparişleri "Teslim Edildi" olarak işaretle
 * 
 * Bu script:
 * 1. FATURAYI_KAYDEDEN boş olanları doldurur (GuncelDesktop + Mobile teslim kriteri)
 * 2. TESLIM_EVRAK_NO boş olanları doldurur (masaustu teslim kriteri)
 * 3. TESLIM_TARIHI boş olanları doldurur
 * 4. TESLIM_ALAN boş olanları doldurur
 * 
 * 3 kopya JSON dosyasını günceller:
 * - GuncelDesktop/ocak_2026_data.json
 * - masaustu/ocak_2026_data.json
 * - masaustu/mobile/src/data/ocak_2026_data.json
 */

const fs = require('fs');
const path = require('path');

const files = [
  'GuncelDesktop/ocak_2026_data.json',
  'masaustu/ocak_2026_data.json',
  'masaustu/mobile/src/data/ocak_2026_data.json',
];

// Bugünün tarihi: 23 Şubat 2026 (tüm kayıtlar teslim edilmiş sayılacak)
const TESLIM_TARIHI_DEFAULT = '2026-01-31T17:00:00.000Z'; // Ocak sonu
const TESLIM_ALAN_DEFAULT = 'AMBAR';
const FATURAYI_KAYDEDEN_DEFAULT = 'sistem';
const TESLIM_EVRAK_NO_PREFIX = 'OTO-';

let totalUpdated = 0;

for (const filePath of files) {
  const fullPath = path.join(__dirname, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`ATLANIDI: ${filePath} bulunamadı`);
    continue;
  }
  
  const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  const records = data.records || [];
  
  let updated = 0;
  
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    let changed = false;
    
    // FATURAYI_KAYDEDEN boş ise doldur (GuncelDesktop + Mobile teslim kriteri)
    if (!r.FATURAYI_KAYDEDEN || r.FATURAYI_KAYDEDEN === '' || r.FATURAYI_KAYDEDEN === '*') {
      r.FATURAYI_KAYDEDEN = FATURAYI_KAYDEDEN_DEFAULT;
      changed = true;
    }
    
    // TESLIM_EVRAK_NO boş ise doldur (masaustu teslim kriteri)
    if (!r.TESLIM_EVRAK_NO || r.TESLIM_EVRAK_NO === '') {
      r.TESLIM_EVRAK_NO = TESLIM_EVRAK_NO_PREFIX + (r.SIPARIS_NO || `KAYIT-${i}`);
      changed = true;
    }
    
    // TESLIM_TARIHI boş ise, sipariş tarihinden 15 gün sonra veya Ocak sonu
    if (!r.TESLIM_TARIHI) {
      if (r.SIPARIS_TARIHI) {
        const sipTarihi = new Date(r.SIPARIS_TARIHI);
        const teslimTarihi = new Date(sipTarihi.getTime() + 15 * 24 * 60 * 60 * 1000);
        // Ocak sonundan sonraya gitmesin
        const ocakSonu = new Date('2026-01-31T17:00:00.000Z');
        r.TESLIM_TARIHI = (teslimTarihi > ocakSonu ? ocakSonu : teslimTarihi).toISOString();
      } else {
        r.TESLIM_TARIHI = TESLIM_TARIHI_DEFAULT;
      }
      changed = true;
    }
    
    // TESLIM_ALAN boş ise doldur
    if (!r.TESLIM_ALAN || r.TESLIM_ALAN === '') {
      r.TESLIM_ALAN = TESLIM_ALAN_DEFAULT;
      changed = true;
    }
    
    // FATURA_KAYDETME_TARIHI boş ise doldur
    if (!r.FATURA_KAYDETME_TARIHI || r.FATURA_KAYDETME_TARIHI === '') {
      r.FATURA_KAYDETME_TARIHI = r.TESLIM_TARIHI || TESLIM_TARIHI_DEFAULT;
      changed = true;
    }
    
    // FATURA_TARIHI boş ise doldur
    if (!r.FATURA_TARIHI || r.FATURA_TARIHI === '') {
      r.FATURA_TARIHI = r.TESLIM_TARIHI || TESLIM_TARIHI_DEFAULT;
      changed = true;
    }
    
    // FATURA_NO boş ise doldur
    if (!r.FATURA_NO || r.FATURA_NO === '') {
      r.FATURA_NO = 'OTO-' + (r.SIPARIS_NO || `F-${i}`);
      changed = true;
    }
    
    if (changed) updated++;
  }
  
  // Meta bilgisini güncelle
  data.meta = data.meta || {};
  data.meta.lastUpdated = new Date().toISOString();
  data.meta.note = 'Tüm Ocak 2026 siparişleri teslim edildi olarak güncellendi (23 Şubat 2026)';
  data.meta.recordCount = records.length;
  
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`✅ ${filePath}: ${updated}/${records.length} kayıt güncellendi`);
  totalUpdated += updated;
}

console.log(`\nToplam güncellenen kayıt: ${totalUpdated}`);

// Doğrulama
console.log('\n--- DOĞRULAMA ---');
for (const filePath of files) {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) continue;
  
  const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  const records = data.records || [];
  
  const emptyFaturayi = records.filter(r => !r.FATURAYI_KAYDEDEN || r.FATURAYI_KAYDEDEN === '' || r.FATURAYI_KAYDEDEN === '*').length;
  const emptyTeslimEvrak = records.filter(r => !r.TESLIM_EVRAK_NO || r.TESLIM_EVRAK_NO === '').length;
  const emptyTeslimTarihi = records.filter(r => !r.TESLIM_TARIHI).length;
  const emptyTeslimAlan = records.filter(r => !r.TESLIM_ALAN || r.TESLIM_ALAN === '').length;
  
  console.log(`${filePath}:`);
  console.log(`  Boş FATURAYI_KAYDEDEN: ${emptyFaturayi}`);
  console.log(`  Boş TESLIM_EVRAK_NO: ${emptyTeslimEvrak}`);
  console.log(`  Boş TESLIM_TARIHI: ${emptyTeslimTarihi}`);
  console.log(`  Boş TESLIM_ALAN: ${emptyTeslimAlan}`);
}
