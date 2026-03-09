// Check Cemre Pet values directly from the SQL database
const sql = require('mssql');

const config = {
  server: '10.35.20.15\\SQLSRV',
  database: 'SNCG',
  user: 'ozgur.copkur',
  password: 'Oz2025!!',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
  requestTimeout: 30000,
  connectionTimeout: 15000
};

async function main() {
  try {
    console.log('SQL veritabanina baglaniliyor...');
    const pool = await sql.connect(config);
    
    // 1. Get column names first
    const colResult = await pool.request().query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'YLZ_TALEP_SIPARIS' ORDER BY ORDINAL_POSITION"
    );
    const cols = colResult.recordset.map(r => r.COLUMN_NAME);
    
    // Find relevant columns
    const normalize = (s) => s.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 ]/g, '').toUpperCase();
    const findCol = (candidates) => {
      for (const cand of candidates) {
        const nc = normalize(cand);
        const found = cols.find(c => normalize(c).includes(nc));
        if (found) return found;
      }
      return null;
    };
    
    const CARI = findCol(['CARI UNVANI', 'CARİ ÜNVANI']);
    const TOPLAM = findCol(['TOPLAM']);
    const SIPARIS_NO = findCol(['SIPARIS NUMARASI', 'SİPARİŞ NUMARASI']);
    const SIPARIS_TARIHI = findCol(['SIPARIS TARIHI', 'SİPARİŞ TARİHİ']);
    const TALEP_TARIHI = findCol(['TALEP TARIHI', 'TALEP TARİHİ']);
    const PARA_BIRIMI = findCol(['PARA BIRIMI', 'PARA BİRİMİ']);
    const BIRIM_FIYAT = findCol(['BIRIM FIYAT', 'BİRİM FİYAT']);
    const MIKTAR = findCol(['MIKTAR', 'MİKTAR']);
    const SIPARIS_MALZEME = findCol(['SIPARIS MALZEME', 'SİPARİŞ MALZEME']);
    const TUR = findCol(['TUR', 'TÜR']);
    
    const q = (col) => '[' + String(col).replace(/]/g, ']]') + ']';
    
    console.log('\nKullanilan kolonlar:');
    console.log('  CARI:', CARI);
    console.log('  TOPLAM:', TOPLAM);
    console.log('  SIPARIS_NO:', SIPARIS_NO);
    console.log('  PARA_BIRIMI:', PARA_BIRIMI);
    
    // 2. Query ALL Cemre Pet records from SQL database (no date filter)
    console.log('\n=== TUM CEMRE PET KAYITLARI (SQL DB - tarih filtresi yok) ===');
    const cemreAll = await pool.request().query(
      `SELECT ${q(SIPARIS_NO)} as SIPARIS_NO, ${q(SIPARIS_MALZEME)} as MALZEME, ${q(MIKTAR)} as MIKTAR, ${q(BIRIM_FIYAT)} as BIRIM_FIYAT, ${q(TOPLAM)} as TOPLAM, ${q(PARA_BIRIMI)} as PARA_BIRIMI, ${q(SIPARIS_TARIHI)} as SIPARIS_TARIHI, ${q(TALEP_TARIHI)} as TALEP_TARIHI FROM YLZ_TALEP_SIPARIS WHERE ${q(CARI)} LIKE '%CEMRE%' ORDER BY ${q(SIPARIS_TARIHI)}`
    );
    
    let totalAll = 0;
    cemreAll.recordset.forEach((r, i) => {
      const toplam = Number(r.TOPLAM) || 0;
      totalAll += toplam;
      console.log(`  [${i+1}] SIP: ${r.SIPARIS_NO} | MAL: ${(r.MALZEME||'').substring(0,25)} | MIKTAR: ${r.MIKTAR} | BF: ${r.BIRIM_FIYAT} | TOPLAM: ${toplam} | ${r.PARA_BIRIMI} | SIP_TAR: ${r.SIPARIS_TARIHI ? new Date(r.SIPARIS_TARIHI).toISOString().substring(0,10) : 'null'} | TALEP_TAR: ${r.TALEP_TARIHI ? new Date(r.TALEP_TARIHI).toISOString().substring(0,10) : 'null'}`);
    });
    console.log(`  TOPLAM (tum kayitlar): ${totalAll}`);
    console.log(`  Kayit sayisi: ${cemreAll.recordset.length}`);
    
    // 3. Query Cemre Pet with date filter (>= 2026-02-01)
    console.log('\n=== CEMRE PET SUBAT 2026+ (SQL sorgusu) ===');
    const cemreFeb = await pool.request().query(
      `SELECT ${q(SIPARIS_NO)} as SIPARIS_NO, ${q(SIPARIS_MALZEME)} as MALZEME, ${q(TOPLAM)} as TOPLAM, ${q(PARA_BIRIMI)} as PARA_BIRIMI, ${q(SIPARIS_TARIHI)} as SIPARIS_TARIHI, ${q(TALEP_TARIHI)} as TALEP_TARIHI FROM YLZ_TALEP_SIPARIS WHERE ${q(CARI)} LIKE '%CEMRE%' AND (${q(TALEP_TARIHI)} >= '2026-02-01' OR ${q(SIPARIS_TARIHI)} >= '2026-02-01')`
    );
    
    let totalFeb = 0;
    cemreFeb.recordset.forEach((r, i) => {
      const toplam = Number(r.TOPLAM) || 0;
      totalFeb += toplam;
      console.log(`  [${i+1}] SIP: ${r.SIPARIS_NO} | TOPLAM: ${toplam} | ${r.PARA_BIRIMI}`);
    });
    console.log(`  TOPLAM (Subat+): ${totalFeb}`);
    
    // 4. Check SUM for tedarikci query
    console.log('\n=== CEMRE PET TOPLAM TUTAR (SUM) ===');
    const cemreSum = await pool.request().query(
      `SELECT ISNULL(SUM(${q(TOPLAM)}),0) as toplamTutar, COUNT(*) as kayitSayisi, COUNT(DISTINCT ${q(SIPARIS_NO)}) as siparisAdedi FROM YLZ_TALEP_SIPARIS WHERE ${q(CARI)} LIKE '%CEMRE%' AND ${q(TUR)} IS NOT NULL AND ${q(TUR)} <> ''`
    );
    console.log('  Tum zaman:', cemreSum.recordset[0]);
    
    const cemreSumFeb = await pool.request().query(
      `SELECT ISNULL(SUM(${q(TOPLAM)}),0) as toplamTutar, COUNT(*) as kayitSayisi FROM YLZ_TALEP_SIPARIS WHERE ${q(CARI)} LIKE '%CEMRE%' AND ${q(TUR)} IS NOT NULL AND ${q(TUR)} <> '' AND (${q(TALEP_TARIHI)} >= '2026-02-01' OR ${q(SIPARIS_TARIHI)} >= '2026-02-01')`
    );
    console.log('  Subat 2026+:', cemreSumFeb.recordset[0]);
    
    // 5. Check OCAK verisi explicitly
    console.log('\n=== CEMRE PET OCAK 2026 (SQL DB) ===');
    const cemreOcak = await pool.request().query(
      `SELECT ${q(SIPARIS_NO)} as SIPARIS_NO, ${q(SIPARIS_MALZEME)} as MALZEME, ${q(TOPLAM)} as TOPLAM, ${q(PARA_BIRIMI)} as PARA_BIRIMI, ${q(BIRIM_FIYAT)} as BIRIM_FIYAT, ${q(MIKTAR)} as MIKTAR FROM YLZ_TALEP_SIPARIS WHERE ${q(CARI)} LIKE '%CEMRE%' AND MONTH(${q(SIPARIS_TARIHI)}) = 1 AND YEAR(${q(SIPARIS_TARIHI)}) = 2026`
    );
    
    let totalOcak = 0;
    cemreOcak.recordset.forEach((r, i) => {
      const toplam = Number(r.TOPLAM) || 0;
      totalOcak += toplam;
      console.log(`  [${i+1}] SIP: ${r.SIPARIS_NO} | MAL: ${(r.MALZEME||'').substring(0,25)} | MIKTAR: ${r.MIKTAR} | BF: ${r.BIRIM_FIYAT} | TOPLAM: ${toplam} | ${r.PARA_BIRIMI}`);
    });
    console.log(`  TOPLAM (Ocak 2026): ${totalOcak}`);
    
    // Compare with static data
    console.log('\n=== KARSILASTIRMA ===');
    console.log(`  Statik JSON Toplam: 1463146.2`);
    console.log(`  SQL DB Ocak Toplam: ${totalOcak}`);
    console.log(`  SQL DB Subat+ Toplam: ${totalFeb}`);
    console.log(`  SQL DB Tum Zaman Toplam: ${totalAll}`);
    console.log(`  Beklenen tutar: 2926292`);
    console.log(`  Statik + Subat: ${1463146.2 + totalFeb}`);
    
    await pool.close();
  } catch (err) {
    console.error('Hata:', err.message);
  }
}

main();
