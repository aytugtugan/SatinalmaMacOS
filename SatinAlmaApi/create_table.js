const db = require('./src/db');

(async () => {
  try {
    // AR_SATINALMA_DOSYA tablosunu oluştur
    await db.executeQuery(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AR_SATINALMA_DOSYA')
      CREATE TABLE AR_SATINALMA_DOSYA (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SiparisNo NVARCHAR(17) NOT NULL,
        DosyaAdi NVARCHAR(255) NOT NULL,
        OrijinalDosyaAdi NVARCHAR(255) NOT NULL,
        Format NVARCHAR(50) NOT NULL,
        Boyut BIGINT NOT NULL DEFAULT 0,
        Path NVARCHAR(500) NOT NULL,
        Aciklama NVARCHAR(MAX) NULL,
        YukleyenKullanici NVARCHAR(100) NULL,
        Tarih DATETIME NOT NULL DEFAULT GETDATE()
      )
    `);

    // Tabloyu kontrol et
    const cols = await db.executeQuery(
      "SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='AR_SATINALMA_DOSYA' ORDER BY ORDINAL_POSITION"
    );
    console.log('AR_SATINALMA_DOSYA columns:');
    console.table(cols);

    await db.closeConnection();
    console.log('DONE - Tablo başarıyla oluşturuldu');
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }
})();
