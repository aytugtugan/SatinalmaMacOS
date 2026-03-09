const sql = require('mssql');
(async () => {
  const cfg = {
    server: '10.35.20.15\\SQLSRV',
    database: 'SNCG',
    user: 'ozgur.copkur',
    password: 'Oz2025!!',
    options: { encrypt: false, trustServerCertificate: true }
  };
  try {
    await sql.connect(cfg);
    const r = await sql.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='YLZ_TALEP_SIPARIS' ORDER BY ORDINAL_POSITION");
    console.log('COLUMNS:', r.recordset.map(x => x.COLUMN_NAME));
    process.exit(0);
  } catch (e) {
    console.error('ERR', e.message);
    process.exit(1);
  }
})();
