/**
 * generate-icns.js
 * icon_256.png → assets/icon.icns dönüşümü
 * Sadece macOS'ta çalışır (iconutil macOS built-in aracıdır)
 *
 * Kullanım: node scripts/generate-icns.js
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

if (process.platform !== 'darwin') {
  console.error('Bu script sadece macOS üzerinde çalışır.');
  process.exit(1);
}

const srcPng = path.join(__dirname, '..', 'assets', 'onculogo.png');
const iconsetDir = path.join(__dirname, '..', 'assets', 'icon.iconset');
const outIcns = path.join(__dirname, '..', 'assets', 'icon.icns');

if (!fs.existsSync(srcPng)) {
  console.error(`Kaynak PNG bulunamadı: ${srcPng}`);
  process.exit(1);
}

// iconset klasörünü oluştur
fs.mkdirSync(iconsetDir, { recursive: true });

// Gerekli boyutlar (Apple Human Interface Guidelines)
const sizes = [
  { size: 16,   name: 'icon_16x16.png' },
  { size: 32,   name: 'icon_16x16@2x.png' },
  { size: 32,   name: 'icon_32x32.png' },
  { size: 64,   name: 'icon_32x32@2x.png' },
  { size: 128,  name: 'icon_128x128.png' },
  { size: 256,  name: 'icon_128x128@2x.png' },
  { size: 256,  name: 'icon_256x256.png' },
  { size: 512,  name: 'icon_256x256@2x.png' },
  { size: 512,  name: 'icon_512x512.png' },
  { size: 1024, name: 'icon_512x512@2x.png' },
];

console.log('PNG boyutları oluşturuluyor...');
for (const { size, name } of sizes) {
  const outFile = path.join(iconsetDir, name);
  // sips: macOS built-in image tool
  execSync(`sips -z ${size} ${size} "${srcPng}" --out "${outFile}"`, { stdio: 'inherit' });
}

console.log('iconutil ile .icns dosyası oluşturuluyor...');
execSync(`iconutil -c icns "${iconsetDir}" -o "${outIcns}"`, { stdio: 'inherit' });

// Temizlik
fs.rmSync(iconsetDir, { recursive: true, force: true });

console.log(`✓ ${outIcns} başarıyla oluşturuldu.`);
