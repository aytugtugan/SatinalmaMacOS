// Script to convert raw JSON to proper format for static data
const fs = require('fs');
const path = require('path');

const rawPath = path.join(__dirname, 'ocak_verileri_fixed.json');
const outPath = path.join(__dirname, 'ocak_2026_data.json');

// Read and remove BOM if present
let rawContent = fs.readFileSync(rawPath, 'utf8');
if (rawContent.charCodeAt(0) === 0xFEFF) {
  rawContent = rawContent.slice(1);
}
const raw = JSON.parse(rawContent);

// Column mapping from unnamed to proper names
const columnMapping = {
  'unnamed:_0': 'FIRMA_NUMARASI',
  'unnamed:_1': 'FIRMA_ADI',
  'unnamed:_2': 'ISYERI',
  'unnamed:_3': 'AMBAR',
  'unnamed:_4': 'TUR',
  'unnamed:_5': 'MALZEME_HIZMET_KODU',
  'unnamed:_6': 'MASRAF_MERKEZI',
  'unnamed:_7': 'TALEP_NO',
  'unnamed:_8': 'TALEP_EDEN',
  'unnamed:_9': 'TALEP_TARIHI',
  'unnamed:_10': 'TALEP_ONAYLAYAN',
  'unnamed:_11': 'TALEP_ONAY_TARIHI',
  'unnamed:_12': 'TALEP_ACIKLAMA',
  'unnamed:_13': 'SIPARIS_NO',
  'unnamed:_14': 'SIPARISI_ACAN',
  'unnamed:_15': 'SIPARIS_TARIHI',
  'unnamed:_16': 'SIPARIS_ONAYLAYAN',
  'unnamed:_17': 'SIPARIS_ONAY_TARIHI',
  'unnamed:_18': 'SIPARIS_MALZEME',
  'unnamed:_19': 'TESLIM_EVRAK_NO',
  'unnamed:_20': 'TESLIM_TARIHI',
  'unnamed:_21': 'CARI_UNVANI',
  'unnamed:_22': 'TESLIM_ALAN',
  'unnamed:_23': 'ACIKLAMA',
  'unnamed:_24': 'MIKTAR',
  'unnamed:_25': 'BIRIM',
  'unnamed:_26': 'ODEME_VADESI',
  'unnamed:_27': 'PARA_BIRIMI',
  'unnamed:_28': 'BIRIM_FIYAT',
  'unnamed:_29': 'TOPLAM',
  'unnamed:_30': 'FATURAYI_KAYDEDEN',
  'unnamed:_31': 'FATURA_KAYDETME_TARIHI',
  'unnamed:_32': 'FATURA_TARIHI',
  'unnamed:_33': 'FATURA_NO'
};

// Skip the first record (header row)
const dataRecords = raw.records.slice(1);

// Parse date from format "29.12.2025 11:27" to ISO format
function parseDate(dateStr) {
  if (!dateStr || dateStr === 'NaN' || typeof dateStr !== 'string') return null;
  // Format: DD.MM.YYYY HH:mm or DD.MM.YYYY
  const match = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!match) return null;
  const [, day, month, year, hour, min] = match;
  const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour || 0), parseInt(min || 0));
  return d.toISOString();
}

// Convert records to proper format
const convertedRecords = dataRecords.map(record => {
  const converted = {};
  for (const [oldKey, newKey] of Object.entries(columnMapping)) {
    let value = record[oldKey];
    
    // Handle NaN values
    if (value === null || value === undefined || (typeof value === 'number' && isNaN(value)) || value === 'NaN') {
      value = null;
    }
    
    // Parse numeric fields
    if (['MIKTAR', 'BIRIM_FIYAT', 'TOPLAM'].includes(newKey) && value !== null) {
      const num = parseFloat(String(value).replace(',', '.'));
      value = isNaN(num) ? null : num;
    }
    
    // Parse date fields
    if (['TALEP_TARIHI', 'TALEP_ONAY_TARIHI', 'SIPARIS_TARIHI', 'SIPARIS_ONAY_TARIHI', 'TESLIM_TARIHI', 'FATURA_TARIHI', 'FATURA_KAYDETME_TARIHI'].includes(newKey) && value !== null) {
      value = parseDate(value);
    }
    
    converted[newKey] = value;
  }
  return converted;
});

// Filter to keep only January 2026 records (based on SIPARIS_TARIHI or TALEP_TARIHI)
const ocak2026Records = convertedRecords.filter(r => {
  const siparisTarihi = r.SIPARIS_TARIHI ? new Date(r.SIPARIS_TARIHI) : null;
  const talepTarihi = r.TALEP_TARIHI ? new Date(r.TALEP_TARIHI) : null;
  
  const isJan2026 = (date) => {
    if (!date || isNaN(date.getTime())) return false;
    return date.getFullYear() === 2026 && date.getMonth() === 0; // January = 0
  };
  
  // Also include December 2025 records that have January 2026 siparis
  const isDec2025Jan2026 = (date) => {
    if (!date || isNaN(date.getTime())) return false;
    return (date.getFullYear() === 2025 && date.getMonth() === 11) || // December 2025
           (date.getFullYear() === 2026 && date.getMonth() === 0);    // January 2026
  };
  
  return isJan2026(siparisTarihi) || isJan2026(talepTarihi) || 
         (isDec2025Jan2026(talepTarihi) && isJan2026(siparisTarihi));
});

// Output
const output = {
  meta: {
    source: 'Ocak 2026 Statik Verileri',
    recordCount: ocak2026Records.length,
    generatedAt: new Date().toISOString(),
    dateRange: {
      start: '2026-01-01',
      end: '2026-01-31'
    }
  },
  records: ocak2026Records
};

fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');

console.log(`Converted ${ocak2026Records.length} records`);
console.log(`Output saved to: ${outPath}`);

// Print sample record
if (ocak2026Records.length > 0) {
  console.log('\nSample record:');
  console.log(JSON.stringify(ocak2026Records[0], null, 2));
}
