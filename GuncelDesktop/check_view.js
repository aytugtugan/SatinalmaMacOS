const sql = require('mssql');
const config = {
  server: '10.35.20.15\\SQLSRV',
  database: 'SNCG',
  user: 'ozgur.copkur',
  password: 'Oz2025!!',
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true }
};

(async () => {
  const pool = await sql.connect(config);

  // 1) INFORMATION_SCHEMA
  const r1 = await pool.request().query(
    "SELECT TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'YLZ_TALEP_SIPARIS'"
  );
  console.log('TABLE_TYPE:', JSON.stringify(r1.recordset));

  // 2) sys.objects
  const r2 = await pool.request().query(
    "SELECT name, type, type_desc FROM sys.objects WHERE name = 'YLZ_TALEP_SIPARIS'"
  );
  console.log('sys.objects:', JSON.stringify(r2.recordset));

  // 3) If VIEW, get definition
  if (r2.recordset.length > 0 && r2.recordset[0].type_desc.trim() === 'VIEW') {
    const r3 = await pool.request().query(
      "SELECT definition FROM sys.sql_modules WHERE object_id = OBJECT_ID('YLZ_TALEP_SIPARIS')"
    );
    console.log('\n=== VIEW DEFINITION ===');
    console.log(r3.recordset[0]?.definition);
  }

  pool.close();
})().catch(e => { console.error(e.message); process.exit(1); });
