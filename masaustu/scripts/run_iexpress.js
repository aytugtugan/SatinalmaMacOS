const { execFileSync } = require('child_process');
const path = require('path');
const ie = 'C:\\Windows\\System32\\iexpress.exe';
const sed = path.resolve(__dirname, 'iexpress_autos.sed');
try{
  console.log('Running', ie, '/N', sed);
  execFileSync(ie, ['/N', sed], { stdio: 'pipe' });
  console.log('IExpress finished');
}catch(e){
  console.error('IExpress error', e && e.message);
  if (e.status) console.error('Exit code', e.status);
  if (e.stderr) console.error('stderr:', e.stderr.toString());
  if (e.stdout) console.error('stdout:', e.stdout.toString());
  process.exit(1);
}
