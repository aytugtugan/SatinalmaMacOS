const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Embed icon into Windows exe using rcedit
 * This modifies the exe to show the custom icon in explorer and taskbar
 */

const iconPath = path.join(__dirname, '..', 'assets', 'icon.ico');
const exePath = path.join(__dirname, '..', '..', '..', 'win-unpacked', 'Satin Alma Rapor.exe');
const resourcesDir = path.join(__dirname, '..', '..', '..', 'win-unpacked', 'resources');

if (!fs.existsSync(iconPath)) {
  console.error('Icon file not found:', iconPath);
  process.exit(1);
}

if (!fs.existsSync(exePath)) {
  console.error('Exe file not found:', exePath);
  process.exit(1);
}

try {
  // Copy icon to resources folder for shortcut creation
  const destIconPath = path.join(resourcesDir, 'icon.ico');
  if (!fs.existsSync(resourcesDir)) {
    fs.mkdirSync(resourcesDir, { recursive: true });
  }
  fs.copyFileSync(iconPath, destIconPath);
  console.log('Copied icon to resources folder');
} catch (err) {
  console.error('Failed to copy icon:', err.message);
}

try {
  // Try using rcedit from electron-winstaller (comes with electron-builder)
  const rcedtPath = require.resolve('electron-winstaller/vendor/rcedit.exe');
  if (fs.existsSync(rcedtPath)) {
    console.log('Using rcedit to embed icon...');
    execSync(`"${rcedtPath}" "${exePath}" --set-icon "${iconPath}"`);
    console.log('Icon embedded successfully!');
  } else {
    console.log('rcedit not available, trying alternative method...');
  }
} catch (err) {
  console.error('Failed to embed icon:', err.message);
  // Continue anyway - icon should still work from NSIS
}
