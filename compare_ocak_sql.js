const sql = require('mssql');
const ocakData = require('./masaustu/mobile/src/data/ocak_2026_data.json');

const config = {
  server: '10.35.20.15\\SQLSRV',
  database: 'SNCG',
  user: 'ozgur.copkur',
  password: 'Oz2025!!',
  options: { encrypt: false, trustServerCertificate: true }
};

async function main() {
  const pool = await sql.connect(config);
  
  // Ocak JSON'daki tüm unique siparişler ve toplamları
  const ocakSiparis = {};
  ocakData.forEach(r => {
    const sip = r.SIPARIS_NO;
    if (!sip) return;
    if (!ocakSiparis[sip]) ocakSiparis[sip] = { items: [], toplam: 0, cari: r.CARI_UNVANI, ambar: r.AMBAR };
    ocakSiparis[sip].items.push(r);
    ocakSiparis[sip].toplam += (Number(r.TOPLAM) || 0);
  });
  
  console.log('Ocak JSON unique siparis:', Object.keys(ocakSiparis).length);
  console.log('Ocak JSON toplam kayit:', ocakData.length);
  
  // SQL'deki Ocak (Ocak 2026) siparişleri  
  const sqlOcak = await pool.request().query(`
    SELECT [SİPARİŞ NUMARASI] as SIP, [SİPARİŞ MALZEME] as MAL, [MİKTAR], [BİRİM FİYAT] as BF, [TOPLAM], [CARİ ÜNVANI] as CARI, [AMBAR]
    FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY [SİPARİŞ NUMARASI], [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT]
        ORDER BY (SELECT NULL)
      ) as _rn
      FROM YLZ_TALEP_SIPARIS
      WHERE ([TÜR] IS NOT NULL AND [TÜR] <> '')
        AND [SİPARİŞ TARİHİ] >= '2026-01-01' AND [SİPARİŞ TARİHİ] < '2026-02-01'
    ) dd WHERE dd._rn = 1
  `);
  
  const sqlSiparis = {};
  sqlOcak.recordset.forEach(r => {
    const sip = r.SIP;
    if (!sip) return;
    if (!sqlSiparis[sip]) sqlSiparis[sip] = { items: [], toplam: 0, cari: r.CARI, ambar: r.AMBAR };
    sqlSiparis[sip].items.push(r);
    sqlSiparis[sip].toplam += (Number(r.TOPLAM) || 0);
  });
  
  console.log('SQL Ocak unique siparis:', Object.keys(sqlSiparis).length);
  console.log('SQL Ocak toplam kayit:', sqlOcak.recordset.length);
  
  // Karsilastirma
  console.log('\n=== OCAK JSON vs SQL FARK ===');
  
  // JSON'da olup SQL'de olmayan
  const jsonOnly = Object.keys(ocakSiparis).filter(s => !sqlSiparis[s]);
  console.log('\nJSON-da olup SQL-de olmayan:', jsonOnly.length);
  jsonOnly.forEach(s => console.log(' ', s, '|', ocakSiparis[s].cari, '|', ocakSiparis[s].toplam));
  
  // SQL'de olup JSON'da olmayan
  const sqlOnly = Object.keys(sqlSiparis).filter(s => !ocakSiparis[s]);
  console.log('\nSQL-de olup JSON-da olmayan:', sqlOnly.length);
  sqlOnly.forEach(s => console.log(' ', s, '|', sqlSiparis[s].cari, '|', sqlSiparis[s].ambar, '|', sqlSiparis[s].toplam, '|', sqlSiparis[s].items.length, 'kalem'));
  
  // Toplam farkli olanlar
  console.log('\nToplam tutari farkli olanlar:');
  let farkSayisi = 0;
  for (const sip of Object.keys(ocakSiparis)) {
    if (!sqlSiparis[sip]) continue;
    const jsonToplam = Math.round(ocakSiparis[sip].toplam * 100) / 100;
    const sqlToplam = Math.round(sqlSiparis[sip].toplam * 100) / 100;
    if (Math.abs(jsonToplam - sqlToplam) > 1) {
      farkSayisi++;
      console.log(' ', sip, '| JSON:', jsonToplam, '| SQL:', sqlToplam, '| Fark:', Math.round((jsonToplam - sqlToplam) * 100) / 100);
      console.log('    JSON items:', ocakSiparis[sip].items.length, '| SQL items:', sqlSiparis[sip].items.length);
    }
  }
  console.log('Toplam farkli siparis sayisi:', farkSayisi);
  
  await pool.close();
}

main().catch(e => { console.error(e); process.exit(1); });
