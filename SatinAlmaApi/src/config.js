const path = require('path');

// pkg ile paketlendiğinde process.execPath exe'nin yolunu verir
// Geliştirme ortamında __dirname kullanılır
function getAppRoot() {
  // pkg snapshot içinde mi kontrol et
  if (process.pkg) {
    return path.dirname(process.execPath);
  }
  return path.join(__dirname, '..');
}

// Veritabanı bağlantı ayarları
// Ortam değişkenleri ile override edilebilir
module.exports = {
  db: {
    server: process.env.DB_SERVER || '10.35.20.15\\SQLSRV',
    database: process.env.DB_NAME || 'SNCG',
    user: process.env.DB_USER || 'ozgur.copkur',
    password: process.env.DB_PASS || 'Oz2025!!',
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  },
  server: {
    port: process.env.PORT || 5055,
    host: process.env.HOST || '0.0.0.0',
  },
  getAppRoot,
};
