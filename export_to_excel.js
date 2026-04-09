const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// Config
const INPUT_JSON = process.argv[2] || 'masaustu/ocak_2026_data.json';
const OUT_DIR = process.argv[3] || 'masaustu/out';
const OUT_XLSX = path.join(OUT_DIR, 'ocak_2026_export.xlsx');
const OUT_ISSUES = path.join(OUT_DIR, 'ocak_2026_birimfiyat_issues.csv');

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}

function parseNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (s === '') return null;
  // Handle Turkish number formats like 1.234.567,89 or plain 1234.56
  // Remove currency symbols and letters
  const cleaned = s.replace(/[^\n0-9,.-]/g, '')
    .replace(/\.(?=\d{3}(?:[,.]|$))/g, '') // remove thousand dots
    .replace(/,/g, '.'); // comma as decimal -> dot
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function toSheetRows(items) {
  return items.map(it => {
    return {
      SIPARIS_NO: it.SIPARIS_NO || '',
      SIPARIS_TARIHI: it.SIPARIS_TARIHI || '',
      CARI_UNVANI: it.CARI_UNVANI || '',
      MASRAF_MERKEZI: it.MASRAF_MERKEZI || '',
      ACIKLAMA: it.ACIKLAMA || '',
      MIKTAR: it.MIKTAR == null ? null : Number(it.MIKTAR),
      BIRIM: it.BIRIM || '',
      BIRIM_FIYAT: it.BIRIM_FIYAT == null ? null : parseNumber(it.BIRIM_FIYAT),
      TOPLAM: it.TOPLAM == null ? null : parseNumber(it.TOPLAM),
      PARA_BIRIMI: it.PARA_BIRIMI || '',
      FATURA_NO: it.FATURA_NO || '',
      FATURA_TARIHI: it.FATURA_TARIHI || ''
    };
  });
}

function validateAndFix(rows) {
  const issues = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const idx = i + 2; // excel row hint (header=1)

    // Try to compute missing BIRIM_FIYAT from TOPLAM/MIKTAR
    if ((r.BIRIM_FIYAT === null || !Number.isFinite(r.BIRIM_FIYAT)) && Number.isFinite(r.TOPLAM) && Number.isFinite(r.MIKTAR) && r.MIKTAR !== 0) {
      r.BIRIM_FIYAT = r.TOPLAM / r.MIKTAR;
      issues.push({ row: idx, field: 'BIRIM_FIYAT', action: 'computed_from_toplam_miktar', value: r.BIRIM_FIYAT });
    }

    // If TOPLAM missing but BIRIM_FIYAT and MIKTAR present, compute TOPLAM
    if ((r.TOPLAM === null || !Number.isFinite(r.TOPLAM)) && Number.isFinite(r.BIRIM_FIYAT) && Number.isFinite(r.MIKTAR)) {
      r.TOPLAM = r.BIRIM_FIYAT * r.MIKTAR;
      issues.push({ row: idx, field: 'TOPLAM', action: 'computed_from_birimfiyat_miktar', value: r.TOPLAM });
    }

    // Check consistency: TOPLAM vs MIKTAR * BIRIM_FIYAT
    if (Number.isFinite(r.MIKTAR) && Number.isFinite(r.BIRIM_FIYAT) && Number.isFinite(r.TOPLAM)) {
      const expected = r.MIKTAR * r.BIRIM_FIYAT;
      const diff = Math.abs(expected - r.TOPLAM);
      // allow small rounding diff
      if (diff > Math.max(0.01, Math.abs(expected) * 0.0005)) {
        issues.push({ row: idx, field: 'TOPLAM_MISMATCH', action: 'mismatch', expected: expected, actual: r.TOPLAM, diff });
      }
    } else {
      // If still missing numeric fields, record
      if (!Number.isFinite(r.BIRIM_FIYAT) || !Number.isFinite(r.MIKTAR) || !Number.isFinite(r.TOPLAM)) {
        issues.push({ row: idx, field: 'MISSING_NUMERIC', action: 'incomplete', BIRIM_FIYAT: r.BIRIM_FIYAT, MIKTAR: r.MIKTAR, TOPLAM: r.TOPLAM });
      }
    }
  }
  return issues;
}

function writeIssuesCsv(issues) {
  if (!issues || issues.length === 0) {
    fs.writeFileSync(OUT_ISSUES, 'row,field,action,details\n');
    return;
  }
  const lines = ['row,field,action,details'];
  for (const it of issues) {
    const details = JSON.stringify(Object.assign({}, it));
    lines.push(`${it.row},${it.field},${it.action},"${details.replace(/"/g, '""')}"`);
  }
  fs.writeFileSync(OUT_ISSUES, lines.join('\n'));
}

function setNumericFormats(ws, headers) {
  const range = xlsx.utils.decode_range(ws['!ref']);
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const header = headers[C];
    if (['MIKTAR', 'BIRIM_FIYAT', 'TOPLAM'].includes(header)) {
      for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        const cell_address = { c: C, r: R };
        const cell_ref = xlsx.utils.encode_cell(cell_address);
        const cell = ws[cell_ref];
        if (cell && (cell.t === 'n' || typeof cell.v === 'number')) {
          cell.t = 'n';
          cell.z = '#,##0.00';
        }
      }
    }
  }
}

function main() {
  if (!fs.existsSync(INPUT_JSON)) {
    console.error('Girdi JSON bulunamadı:', INPUT_JSON);
    process.exit(1);
  }
  ensureOutDir();
  const raw = fs.readFileSync(INPUT_JSON, 'utf8');
  const items = JSON.parse(raw);
  const rows = toSheetRows(items);
  const issues = validateAndFix(rows);
  writeIssuesCsv(issues);

  // Build sheet
  const ws = xlsx.utils.json_to_sheet(rows, { dateNF: 'yyyy-mm-dd' });
  const headers = xlsx.utils.sheet_to_json(ws, { header: 1 })[0];
  setNumericFormats(ws, headers);

  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Ocak2026');
  xlsx.writeFile(wb, OUT_XLSX);

  console.log('Yazıldı:', OUT_XLSX);
  console.log('Hata raporu:', OUT_ISSUES, 'satır sayısı:', items.length, 'bulunan sorun:', issues.length);
}

main();
