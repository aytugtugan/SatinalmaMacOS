const { executeQuery, getConnection, sql } = require('../db');
const path = require('path');
const fs = require('fs');
const { getAppRoot } = require('../config');

/**
 * Sipariş numarasına bağlı dosyaları getir
 */
async function getDosyalar(siparisNo) {
  const conn = await getConnection();
  const result = await conn.request()
    .input('siparisNo', sql.NVarChar(17), siparisNo)
    .query(`
      SELECT Id, SiparisNo, DosyaAdi, OrijinalDosyaAdi, Format, Boyut, Aciklama, YukleyenKullanici, Tarih
      FROM AR_SATINALMA_DOSYA
      WHERE SiparisNo = @siparisNo
      ORDER BY Tarih DESC
    `);
  return result.recordset;
}

/**
 * Birden fazla siparişin dosya sayısını getir (toplu sorgu)
 * { "S.032.000.000123": 3, "S.032.000.000124": 1 }
 */
async function getDosyaSayilari(siparisNolar) {
  if (!siparisNolar || siparisNolar.length === 0) return {};

  // SQL IN clause için güvenli parametre
  const conn = await getConnection();
  const request = conn.request();

  const placeholders = siparisNolar.map((no, i) => {
    request.input(`s${i}`, sql.NVarChar(17), no);
    return `@s${i}`;
  });

  const result = await request.query(`
    SELECT SiparisNo, COUNT(*) as DosyaSayisi
    FROM AR_SATINALMA_DOSYA
    WHERE SiparisNo IN (${placeholders.join(',')})
    GROUP BY SiparisNo
  `);

  const map = {};
  for (const row of result.recordset) {
    map[row.SiparisNo] = row.DosyaSayisi;
  }
  return map;
}

/**
 * Dosya kaydını veritabanına ekle
 */
async function dosyaKaydet({ siparisNo, dosyaAdi, orijinalDosyaAdi, format, boyut, filePath, aciklama, yukleyenKullanici }) {
  const conn = await getConnection();
  const result = await conn.request()
    .input('siparisNo', sql.NVarChar(17), siparisNo)
    .input('dosyaAdi', sql.NVarChar(255), dosyaAdi)
    .input('orijinalDosyaAdi', sql.NVarChar(255), orijinalDosyaAdi)
    .input('format', sql.NVarChar(50), format)
    .input('boyut', sql.BigInt, boyut)
    .input('path', sql.NVarChar(500), filePath)
    .input('aciklama', sql.NVarChar(sql.MAX), aciklama || null)
    .input('yukleyenKullanici', sql.NVarChar(100), yukleyenKullanici || null)
    .query(`
      INSERT INTO AR_SATINALMA_DOSYA (SiparisNo, DosyaAdi, OrijinalDosyaAdi, Format, Boyut, Path, Aciklama, YukleyenKullanici, Tarih)
      OUTPUT INSERTED.*
      VALUES (@siparisNo, @dosyaAdi, @orijinalDosyaAdi, @format, @boyut, @path, @aciklama, @yukleyenKullanici, GETDATE())
    `);
  return result.recordset[0];
}

/**
 * Dosya kaydını ID'ye göre getir
 * Path'i her zaman güncel getAppRoot() ile resolve eder
 */
async function getDosyaById(id) {
  const conn = await getConnection();
  const result = await conn.request()
    .input('id', sql.Int, id)
    .query('SELECT * FROM AR_SATINALMA_DOSYA WHERE Id = @id');
  const row = result.recordset[0] || null;
  if (row && row.Path) {
    // DB'deki path absolute ise relative'e çevir
    // Sonra her zaman getAppRoot() ile resolve et
    row.ResolvedPath = resolveFilePath(row.Path);
  }
  return row;
}

/**
 * DB'deki path'i dosya sistemi path'ine resolve et
 * Hem eski absolute path'leri hem yeni relative path'leri destekler
 */
function resolveFilePath(dbPath) {
  if (!dbPath) return dbPath;
  // Zaten absolute path ise ve varsa direkt dön
  if (path.isAbsolute(dbPath) && fs.existsSync(dbPath)) {
    return dbPath;
  }
  // Relative path ise getAppRoot() ile resolve et
  if (!path.isAbsolute(dbPath)) {
    return path.join(getAppRoot(), dbPath);
  }
  // Absolute ama dosya yoksa — eski path olabilir, relative kısmını çıkar
  // uploads/satinalma/... kısmını bul ve resolve et
  const uploadsIdx = dbPath.indexOf('uploads');
  if (uploadsIdx !== -1) {
    const relativePart = dbPath.substring(uploadsIdx);
    return path.join(getAppRoot(), relativePart);
  }
  return dbPath;
}

/**
 * Dosya kaydını sil (DB + dosya sistemi)
 */
async function dosyaSil(id) {
  const dosya = await getDosyaById(id);
  if (!dosya) return null;

  // Dosyayı dosya sisteminden sil
  const resolvedPath = dosya.ResolvedPath || resolveFilePath(dosya.Path);
  try {
    if (fs.existsSync(resolvedPath)) {
      fs.unlinkSync(resolvedPath);
    }
  } catch (e) {
    console.error(`[Dosya] Dosya silinemedi: ${resolvedPath}`, e.message);
  }

  // DB kaydını sil
  const conn = await getConnection();
  await conn.request()
    .input('id', sql.Int, id)
    .query('DELETE FROM AR_SATINALMA_DOSYA WHERE Id = @id');

  return dosya;
}

module.exports = {
  getDosyalar,
  getDosyaSayilari,
  dosyaKaydet,
  getDosyaById,
  dosyaSil,
};
