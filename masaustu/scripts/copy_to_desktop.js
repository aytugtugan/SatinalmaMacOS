const fs = require('fs');
const path = require('path');

(async ()=>{
  try{
    const src = path.resolve(__dirname, '..', 'release', 'win-unpacked');
    const dest = path.resolve(process.env.USERPROFILE, 'Desktop', 'Satinalma-Setup');
    if(fs.existsSync(dest)){
      console.log('Removing existing', dest);
      fs.rmSync(dest, { recursive: true, force: true });
    }
    console.log('Copying', src, 'to', dest);
    await fs.promises.cp(src, dest, { recursive: true });
    console.log('Copy finished.');
    process.exit(0);
  }catch(e){
    console.error('ERR', e);
    process.exit(1);
  }
})();
