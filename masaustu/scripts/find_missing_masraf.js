const http = require('http');
const https = require('https');
const url = require('url');
const SATINALMA_API = 'http://10.35.20.17:5055';

function fetchJson(u) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(u);
    const lib = parsed.protocol === 'https:' ? https : http;
    const opts = { hostname: parsed.hostname, port: parsed.port, path: parsed.path, method: 'GET', headers: { Accept: 'application/json' } };
    const req = lib.request(opts, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const j = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(j);
          else reject(new Error('HTTP ' + res.statusCode + ' - ' + (j && j.message ? j.message : body)));
        } catch (e) {
          reject(new Error('Invalid JSON response: ' + e.message));
        }
      });
    });
    req.on('error', (err) => reject(err));
    req.end();
  });
}

function normalizeField(obj, keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return '';
}

async function run() {
  try {
    const json = await fetchJson(SATINALMA_API + '/api/Satinalma/veriler');
    const data = Array.isArray(json) ? json : (json.data || json.records || json || []);
    const mapped = (data || []).map(r => {
      return {
        SIPARIS_NO: normalizeField(r, ['S\u0130PAR\u0130\u015e NUMARASI','SIPARIS_NO','siparis_no','sipsno']) || r.SIPARIS_NO || r.siparis_no || r.siparisNumara || null,
        TALEP_NO: normalizeField(r, ['TALEP NUMARASI','TALEP_NO','talep_no','talepNumara']) || r.TALEP_NO || r.talep_no || null,
        TOPLAM: normalizeField(r, ['TOPLAM','toplam']) || r.TOPLAM || r.toplam || null,
        MASRAF_MERKEZI: normalizeField(r, ['MASRAF MERKEZ\u0130','MASRAF_MERKEZI','masraf_merkezi','masrafMerkezi'])
      };
    });

    const missing = mapped.filter(r => { const v = (r.MASRAF_MERKEZI || '').toString().trim(); return !v; })
      .map(r => ({ siparis_no: r.SIPARIS_NO || null, talep_no: r.TALEP_NO || null, toplam: r.TOPLAM || null }));

    console.log('Total records (Satinalma/veriler):', mapped.length);
    console.log('Missing MASRAF_MERKEZI count:', missing.length);
    if (missing.length) console.log('Missing records (sample 50):', missing.slice(0,50));
  } catch (e) {
    console.error('Error:', e.message || e);
    process.exit(1);
  }
}

run();
