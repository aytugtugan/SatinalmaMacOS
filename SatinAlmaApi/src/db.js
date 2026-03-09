const sql = require('mssql');
const config = require('./config');

let pool = null;

/**
 * MSSQL bağlantı havuzu oluştur / mevcut olanı döndür
 */
async function getConnection() {
  if (!pool) {
    pool = await sql.connect(config.db);
    console.log(`[DB] MSSQL bağlantısı kuruldu: ${config.db.server}/${config.db.database}`);
  }
  return pool;
}

/**
 * SQL sorgusu çalıştır
 * @param {string} query - SQL sorgu metni
 * @returns {Promise<Array>} Sorgu sonuçları
 */
async function executeQuery(query) {
  const conn = await getConnection();
  const result = await conn.request().query(query);
  return result.recordset;
}

/**
 * Bağlantıyı kapat
 */
async function closeConnection() {
  if (pool) {
    await pool.close();
    pool = null;
    console.log('[DB] MSSQL bağlantısı kapatıldı');
  }
}

module.exports = {
  getConnection,
  executeQuery,
  closeConnection,
  sql, // mssql modülünü dışa aktar (tip kullanımları için)
};
