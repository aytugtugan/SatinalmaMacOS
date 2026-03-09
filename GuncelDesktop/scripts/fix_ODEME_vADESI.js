const fs = require('fs');
const path = require('path');

const FILE = process.argv[2] || path.join(__dirname, '..', 'ocak_2026_data.json');
const BACKUP = FILE + '.backup.json';

function traverse(obj) {
  let count = 0;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      count += traverse(obj[i]);
    }
    return count;
  }
  if (obj && typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (key === 'ODEME_vADESI' || key === 'ODEME_VADESI') {
        // Numeric 1 değerini "01" string'ine dönüştür
        if (val === 1 || val === '1') {
          obj[key] = '01';
          count++;
        }
      } else if (val && (typeof val === 'object' || Array.isArray(val))) {
        count += traverse(val);
      }
    }
  }
  return count;
}

try {
  console.log('Reading', FILE);
  const raw = fs.readFileSync(FILE, 'utf8');
  const data = JSON.parse(raw);

  const modified = traverse(data);

  if (modified === 0) {
    console.log('No occurrences of value 1 found for key ODEME_VADESI/ODEME_vADESI. No changes made.');
    process.exit(0);
  }

  // backup
  fs.copyFileSync(FILE, BACKUP);
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');

  console.log(`Modified ${modified} field(s). Backup created at ${BACKUP}`);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(2);
}
