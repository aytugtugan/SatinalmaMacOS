const { executeQuery } = require('../db');

// YLZ_TALEP_SIPARIS tablosundaki kolon adları (Türkçe karakterli)
// API response'da bu isimlerle döner - mobil uygulama bu isimleri bekliyor
const COLUMNS = {
  FIRMA_NUMARASI: 'FİRMA NUMARASI',
  FIRMA_ADI: 'FİRMA ADI',
  ISYERI: 'İŞ YERİ',
  AMBAR: 'AMBAR',
  TUR: 'TÜR',
  MALZEME_HIZMET_KODU: 'MALZEME/HİZMET KODU',
  MASRAF_MERKEZI: 'MASRAF MERKEZİ',
  TALEP_NUMARASI: 'TALEP NUMARASI',
  TALEP_EDEN: 'TALEP EDEN',
  TALEP_TARIHI: 'TALEP TARİHİ',
  TALEP_ONAYLAYAN: 'TALEP ONAYLAYAN',
  TALEP_ONAY_TARIHI: 'TALEP ONAY TARİHİ',
  TALEP_ACIKLAMA: 'TALEP AÇIKLAMA',
  SIPARIS_NUMARASI: 'SİPARİŞ NUMARASI',
  SIPARISI_ACAN: 'SİPARİŞİ AÇAN',
  SIPARIS_TARIHI: 'SİPARİŞ TARİHİ',
  SIPARIS_ONAYLAYAN: 'SİPARİŞ ONAYLAYAN',
  SIPARIS_ONAY_TARIHI: 'SİPARİŞ ONAY TARİHİ',
  SIPARIS_MALZEME: 'SİPARİŞ MALZEME',
  TESLIM_EVRAK_NO: 'TESLİM EVRAK NO',
  TESLIM_TARIHI: 'TESLİM TARİHİ',
  CARI_UNVANI: 'CARİ ÜNVANI',
  TESLIM_ALAN: 'TESLİM ALAN',
  ACIKLAMA: 'AÇIKLAMA',
  MIKTAR: 'MİKTAR',
  BIRIM: 'BİRİM',
  ODEME_VADESI: 'ÖDEME VADESİ',
  PARA_BIRIMI: 'PARA BİRİMİ',
  BIRIM_FIYAT: 'BİRİM FİYAT',
  TOPLAM: 'TOPLAM',
  FATURAYI_KAYDEDEN: 'FATURAYI KAYDEDEN',
  FATURA_KAYDETME_TARIHI: 'FATURA KAYDETME TARİHİ',
  FATURA_TARIHI: 'FATURA TARİHİ',
  FATURA_NO: 'FATURA NO',
};

// SQL kolon adını güvenli şekilde wrap et
function q(col) {
  return '[' + String(col).replace(/]/g, ']]') + ']';
}

/**
 * Tüm satın alma verilerini getir
 * Mobil uygulama bu endpoint'i kullanıyor
 * Response: Array of objects with Turkish field names
 */
async function getVeriler() {
  const selectFields = Object.values(COLUMNS).map(col => q(col)).join(', ');

  // Duplikasyonu engelle: SIPARIS_NO + SIPARIS_MALZEME + MIKTAR + BIRIM_FIYAT bazinda tekil satirlar
  // View'daki LEFT JOIN (STLINE, DEMANDPEGGING) fan-out'u ROW_NUMBER ile engellenir
  const query = `
    SELECT ${selectFields}
    FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY [SİPARİŞ NUMARASI], [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT]
        ORDER BY (SELECT NULL)
      ) as _rn
      FROM YLZ_TALEP_SIPARIS
      WHERE ([TÜR] IS NOT NULL AND [TÜR] <> '')
        AND [SİPARİŞ TARİHİ] >= '2026-02-01'
    ) dd
    WHERE dd._rn = 1
    ORDER BY [SİPARİŞ TARİHİ] DESC
  `;

  const records = await executeQuery(query);
  return records;
}

module.exports = {
  getVeriler,
  COLUMNS,
};
