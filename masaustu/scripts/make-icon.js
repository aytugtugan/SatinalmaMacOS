const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const toIco = require('to-ico');

async function makeIco() {
  const src = path.join(__dirname, '..', 'assets', 'logo.jpg');
  const out = path.join(__dirname, '..', 'assets', 'app.ico');
  const out2 = path.join(__dirname, '..', 'assets', 'icon.ico');

  const sizes = [16, 32, 48, 256];
  const buffers = [];

  const img = await Jimp.read(src);

  for (const size of sizes) {
    const clone = img.clone();
    clone.resize(size, size, Jimp.RESIZE_BICUBIC);
    const pngBuffer = await clone.getBufferAsync(Jimp.MIME_PNG);
    buffers.push(pngBuffer);
  }

  const icoBuffer = await toIco(buffers);
  fs.writeFileSync(out, icoBuffer);
  fs.writeFileSync(out2, icoBuffer);
  console.log('Wrote', out, 'and', out2);
}

makeIco().catch(err => {
  console.error(err);
  process.exit(1);
});
