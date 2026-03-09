const fs = require('fs');
const path = require('path');

// Read TSV file
const tsvPath = path.join(__dirname, 'Veriler.txt');
const outputPath = path.join(__dirname, 'ocak_2026_data.json');

console.log('Reading Veriler.txt...');
const tsvContent = fs.readFileSync(tsvPath, 'utf-8');

// Split by lines and remove empty lines
const lines = tsvContent.split('\n').filter(line => line.trim());

if (lines.length < 2) {
  console.error('Error: No data found in file');
  process.exit(1);
}

// Parse header (skip first character if BOM)
let headerLine = lines[0];
if (headerLine.charCodeAt(0) === 0xFEFF) {
  headerLine = headerLine.slice(1);
}
const headers = headerLine.split('\t').map(h => h.trim()).filter(h => h);

console.log(`Found ${headers.length} columns:`);
console.log(headers.join(', '));

// Column mapping - original Turkish names to normalized JSON keys
const columnMap = {
  'FİRMA NUMARASI': 'FIRMA_NUMARASI',
  'FİRMA ADI': 'FIRMA_ADI',
  'İŞ YERİ': 'ISYERI',
  'AMBAR': 'AMBAR',
  'TÜR': 'TUR',
  'MALZEME/HİZMET KODU': 'MALZEME_HIZMET_KODU',
  'MASRAF MERKEZİ': 'MASRAF_MERKEZI',
  'TALEP NUMARASI': 'TALEP_NO',
  'TALEP EDEN': 'TALEP_EDEN',
  'TALEP TARİHİ': 'TALEP_TARIHI',
  'TALEP ONAYLAYAN': 'TALEP_ONAYLAYAN',
  'TALEP ONAY TARİHİ': 'TALEP_ONAY_TARIHI',
  'TALEP AÇIKLAMA': 'TALEP_ACIKLAMA',
  'SİPARİŞ NUMARASI': 'SIPARIS_NO',
  'SİPARİŞİ AÇAN': 'SIPARISI_ACAN',
  'SİPARİŞ TARİHİ': 'SIPARIS_TARIHI',
  'SİPARİŞ ONAYLAYAN': 'SIPARIS_ONAYLAYAN',
  'SİPARİŞ ONAY TARİHİ': 'SIPARIS_ONAY_TARIHI',
  'SİPARİŞ MALZEME': 'SIPARIS_MALZEME',
  'TESLİM EVRAK NO': 'TESLIM_EVRAK_NO',
  'TESLİM TARİHİ': 'TESLIM_TARIHI',
  'CARİ ÜNVANI': 'CARI_UNVANI',
  'TESLİM ALAN': 'TESLIM_ALAN',
  'AÇIKLAMA': 'ACIKLAMA',
  'MİKTAR': 'MIKTAR',
  'BİRİM': 'BIRIM',
  'ÖDEME VADESİ': 'ODEME_VADESI',
  'PARA BİRİMİ': 'PARA_BIRIMI',
  'BİRİM FİYAT': 'BIRIM_FIYAT',
  'TOPLAM': 'TOPLAM',
  'FATURAYI KAYDEDEN': 'FATURAYI_KAYDEDEN',
  'FATURA KAYDETME TARİHİ': 'FATURA_KAYDETME_TARIHI',
  'FATURA TARİHİ': 'FATURA_TARIHI',
  'FATURA NO': 'FATURA_NO'
};

// Parse Turkish date format to ISO
function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '' || dateStr === '*') return null;
  
  try {
    // Format: "29.12.2025 17:10" or "16.01.2026 00:00"
    const parts = dateStr.trim().split(' ');
    if (parts.length < 1) return null;
    
    const dateParts = parts[0].split('.');
    if (dateParts.length !== 3) return null;
    
    const day = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1;
    const year = parseInt(dateParts[2]);
    
    let hours = 0, minutes = 0;
    if (parts.length > 1 && parts[1]) {
      const timeParts = parts[1].split(':');
      hours = parseInt(timeParts[0]) || 0;
      minutes = parseInt(timeParts[1]) || 0;
    }
    
    const date = new Date(year, month, day, hours, minutes);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  } catch (e) {
    // Return original string if parsing fails
  }
  
  return null;
}

// Parse number with Turkish decimal format
function parseNumber(str) {
  if (!str || str.trim() === '' || str === '*') return null;
  
  // Turkish: 1.234,56 -> English: 1234.56
  let normalized = str.trim();
  // Remove thousand separators (dots before the comma)
  // If there's a comma, treat dots as thousand separators
  if (normalized.includes(',')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  }
  
  const num = parseFloat(normalized);
  return isNaN(num) ? null : num;
}

// Decide if a parsed field contains meaningful data (exclude lone '2')
function isMeaningfulField(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') {
    const t = v.trim();
    if (t === '' || t === '2') return false;
    return true;
  }
  if (typeof v === 'number') {
    return v !== 2;
  }
  return true;
}

// Parse records
const records = [];
console.log(`\nProcessing ${lines.length - 1} data rows...`);

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  
  const values = line.split('\t');
  const record = {};
  
  for (let j = 0; j < headers.length; j++) {
    const originalHeader = headers[j];
    const mappedKey = columnMap[originalHeader] || originalHeader.replace(/[\/\s]/g, '_').toUpperCase();
    const value = values[j] ? values[j].trim() : '';
    
    // FATURAYI_KAYDEDEN için * bile olsa değeri sakla (teslim edildi anlamına gelir)
    if (mappedKey === 'FATURAYI_KAYDEDEN') {
      record[mappedKey] = value || null;
      continue;
    }
    
    if (!value || value === '*') {
      record[mappedKey] = null;
      continue;
    }
    
    // Apply type conversions based on field
    if (mappedKey.includes('TARIHI') || mappedKey.includes('_TARIHI')) {
      record[mappedKey] = parseDate(value);
    } else if (['MIKTAR', 'BIRIM_FIYAT', 'TOPLAM', 'ODEME_VADESI'].includes(mappedKey)) {
      record[mappedKey] = parseNumber(value);
    } else {
      record[mappedKey] = value;
    }
  }
  
  // Only add records with actual data (ignore stray '2' values)
  if (isMeaningfulField(record.SIPARIS_NO) || isMeaningfulField(record.TALEP_NO) || isMeaningfulField(record.CARI_UNVANI)) {
    records.push(record);
  }
}

// Append static Ocak records (sabit veriler) so output is auto-generated
const staticRows = [
  {
    'FİRMA NUMARASI': '32',
    'FİRMA ADI': '2022-2026 ACEMOĞLU GIDA SAN. VE TİC. A.Ş.',
    'İŞ YERİ': 'Gaziantep',
    'AMBAR': 'Gaziantep',
    'TÜR': 'MALZEME',
    'MALZEME/HİZMET KODU': '150.03.220',
    'MASRAF MERKEZİ': 'PET ŞİŞE',
    'TALEP NUMARASI': 'T.032.000.000182',
    'TALEP EDEN': 'ANTEPDEPO',
    'TALEP TARİHİ': '2026-01-25 17:56:43.157',
    'TALEP ONAYLAYAN': 'ANTEPDEPO',
    'TALEP ONAY TARİHİ': '2026-02-03 09:36:14.090',
    'TALEP AÇIKLAMA': 'PET ŞİŞE 250 cc',
    'SİPARİŞ NUMARASI': 'S.ACM.GAN.000081',
    'SİPARİŞİ AÇAN': 'okkes.yilmaz',
    'SİPARİŞ TARİHİ': '2026-01-25 09:39:12.657',
    'SİPARİŞ ONAYLAYAN': 'irmak.kozlu',
    'SİPARİŞ ONAY TARİHİ': '2026-02-03 09:39:41.597',
    'SİPARİŞ MALZEME': 'PET ŞİŞE 250 cc',
    'TESLİM EVRAK NO': '',
    'TESLİM TARİHİ': '',
    'CARİ ÜNVANI': 'CEMRE PET VE PLASTİK AMBALAJ SAN TİC LTD ŞTİ',
    'TESLİM ALAN': '',
    'AÇIKLAMA': '',
    'MİKTAR': '100000',
    'BİRİM': 'AD',
    'ÖDEME VADESİ': '30',
    'PARA BİRİMİ': 'USD',
    'BİRİM FİYAT': '2,04059',
    'TOPLAM': '204059',
    'FATURAYI KAYDEDEN': '',
    'FATURA KAYDETME TARİHİ': '',
    'FATURA TARİHİ': '',
    'FATURA NO': ''
  },
  {
    'FİRMA NUMARASI': '32',
    'FİRMA ADI': '2022-2026 ACEMOĞLU GIDA SAN. VE TİC. A.Ş.',
    'İŞ YERİ': 'Gaziantep',
    'AMBAR': 'Gaziantep',
    'TÜR': 'MALZEME',
    'MALZEME/HİZMET KODU': '150.03.221',
    'MASRAF MERKEZİ': 'PET ŞİŞE',
    'TALEP NUMARASI': 'T.032.000.000182',
    'TALEP EDEN': 'ANTEPDEPO',
    'TALEP TARİHİ': '2026-01-25 17:56:43.157',
    'TALEP ONAYLAYAN': 'ANTEPDEPO',
    'TALEP ONAY TARİHİ': '2026-02-03 09:36:14.090',
    'TALEP AÇIKLAMA': 'PET ŞİŞE 500 cc',
    'SİPARİŞ NUMARASI': 'S.ACM.GAN.000081',
    'SİPARİŞİ AÇAN': 'okkes.yilmaz',
    'SİPARİŞ TARİHİ': '2026-01-25 09:39:12.657',
    'SİPARİŞ ONAYLAYAN': 'irmak.kozlu',
    'SİPARİŞ ONAY TARİHİ': '2026-02-03 09:39:41.597',
    'SİPARİŞ MALZEME': 'PET ŞİŞE 500 cc',
    'TESLİM EVRAK NO': '',
    'TESLİM TARİHİ': '',
    'CARİ ÜNVANI': 'CEMRE PET VE PLASTİK AMBALAJ SAN TİC LTD ŞTİ',
    'TESLİM ALAN': '',
    'AÇIKLAMA': '',
    'MİKTAR': '250000',
    'BİRİM': 'AD',
    'ÖDEME VADESİ': '30',
    'PARA BİRİMİ': 'USD',
    'BİRİM FİYAT': '2,387924',
    'TOPLAM': '596981',
    'FATURAYI KAYDEDEN': '',
    'FATURA KAYDETME TARİHİ': '',
    'FATURA TARİHİ': '',
    'FATURA NO': ''
  },
  {
    'FİRMA NUMARASI': '32',
    'FİRMA ADI': '2022-2026 ACEMOĞLU GIDA SAN. VE TİC. A.Ş.',
    'İŞ YERİ': 'Gaziantep',
    'AMBAR': 'Gaziantep',
    'TÜR': 'MALZEME',
    'MALZEME/HİZMET KODU': '150.03.222',
    'MASRAF MERKEZİ': 'PET ŞİŞE',
    'TALEP NUMARASI': 'T.032.000.000182',
    'TALEP EDEN': 'ANTEPDEPO',
    'TALEP TARİHİ': '2026-01-25 17:56:43.157',
    'TALEP ONAYLAYAN': 'ANTEPDEPO',
    'TALEP ONAY TARİHİ': '2026-02-03 09:36:14.090',
    'TALEP AÇIKLAMA': 'PET ŞİŞE 750 cc',
    'SİPARİŞ NUMARASI': 'S.ACM.GAN.000081',
    'SİPARİŞİ AÇAN': 'okkes.yilmaz',
    'SİPARİŞ TARİHİ': '2026-01-25 09:39:12.657',
    'SİPARİŞ ONAYLAYAN': 'irmak.kozlu',
    'SİPARİŞ ONAY TARİHİ': '2026-02-03 09:39:41.597',
    'SİPARİŞ MALZEME': 'PET ŞİŞE 750 cc',
    'TESLİM EVRAK NO': '',
    'TESLİM TARİHİ': '',
    'CARİ ÜNVANI': 'CEMRE PET VE PLASTİK AMBALAJ SAN TİC LTD ŞTİ',
    'TESLİM ALAN': '',
    'AÇIKLAMA': '',
    'MİKTAR': '250000',
    'BİRİM': 'AD',
    'ÖDEME VADESİ': '30',
    'PARA BİRİMİ': 'USD',
    'BİRİM FİYAT': '2,387924',
    'TOPLAM': '596981',
    'FATURAYI KAYDEDEN': '',
    'FATURA KAYDETME TARİHİ': '',
    'FATURA TARİHİ': '',
    'FATURA NO': ''
  },
  {
    'FİRMA NUMARASI': '32',
    'FİRMA ADI': '2022-2026 ACEMOĞLU GIDA SAN. VE TİC. A.Ş.',
    'İŞ YERİ': 'Gaziantep',
    'AMBAR': 'Gaziantep',
    'TÜR': 'MALZEME',
    'MALZEME/HİZMET KODU': '150.03.223',
    'MASRAF MERKEZİ': 'PET ŞİŞE',
    'TALEP NUMARASI': 'T.032.000.000182',
    'TALEP EDEN': 'ANTEPDEPO',
    'TALEP TARİHİ': '2026-01-25 17:56:43.157',
    'TALEP ONAYLAYAN': 'ANTEPDEPO',
    'TALEP ONAY TARİHİ': '2026-02-03 09:36:14.090',
    'TALEP AÇIKLAMA': 'PET ŞİŞE 4000 cc',
    'SİPARİŞ NUMARASI': 'S.ACM.GAN.000081',
    'SİPARİŞİ AÇAN': 'okkes.yilmaz',
    'SİPARİŞ TARİHİ': '2026-01-25 09:39:12.657',
    'SİPARİŞ ONAYLAYAN': 'irmak.kozlu',
    'SİPARİŞ ONAY TARİHİ': '2026-02-03 09:39:41.597',
    'SİPARİŞ MALZEME': 'PET ŞİŞE 4000 cc',
    'TESLİM EVRAK NO': '',
    'TESLİM TARİHİ': '',
    'CARİ ÜNVANI': 'CEMRE PET VE PLASTİK AMBALAJ SAN TİC LTD ŞTİ',
    'TESLİM ALAN': '',
    'AÇIKLAMA': '',
    'MİKTAR': '10000',
    'BİRİM': 'AD',
    'ÖDEME VADESİ': '30',
    'PARA BİRİMİ': 'USD',
    'BİRİM FİYAT': '6,51252',
    'TOPLAM': '65125,2',
    'FATURAYI KAYDEDEN': '',
    'FATURA KAYDETME TARİHİ': '',
    'FATURA TARİHİ': '',
    'FATURA NO': ''
  }
];

staticRows.forEach(raw => {
  const record = {};
  for (const [hdr, val] of Object.entries(raw)) {
    const mappedKey = columnMap[hdr] || hdr.replace(/[\/\s]/g, '_').toUpperCase();
    if (!val || val === '*') {
      record[mappedKey] = null;
      continue;
    }

    if (mappedKey.includes('TARIHI') || mappedKey.includes('_TARIHI')) {
      let parsed = parseDate(val);
      if (!parsed) {
        const d = new Date(val.replace(' ', 'T'));
        record[mappedKey] = isNaN(d.getTime()) ? null : d.toISOString();
      } else {
        record[mappedKey] = parsed;
      }
    } else if (['MIKTAR', 'BIRIM_FIYAT', 'TOPLAM', 'ODEME_VADESI'].includes(mappedKey)) {
      record[mappedKey] = parseNumber(val);
    } else {
      record[mappedKey] = val;
    }
  }

  if (isMeaningfulField(record.SIPARIS_NO) || isMeaningfulField(record.TALEP_NO) || isMeaningfulField(record.CARI_UNVANI)) {
    records.push(record);
  }
});
// Create output JSON
const output = {
  meta: {
    source: 'Ocak 2026 Veriler - Yeni Import',
    recordCount: records.length,
    generatedAt: new Date().toISOString(),
    dateRange: {
      start: '2026-01-01',
      end: '2026-01-31'
    }
  },
  records: records
};

// Write to file
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');

console.log(`\n✓ Import başarılı!`);
console.log(`✓ Toplam kayıt: ${records.length}`);
console.log(`✓ Dosya: ${outputPath}`);
