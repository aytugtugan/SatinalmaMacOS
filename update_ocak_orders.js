// Ocak JSON'u güncelle:
// 1. TESTKURUMSOFT ve 00000001 siparişlerini kaldır
// 2. S.ACM.GAN.000017 ekle (SQL'den, TÜR=null -> HİZMET)
// 3. S.ACM.GAN.000050 ekle (SQL'den, TÜR=null -> HİZMET)
// 4. S.ACM.GAN.000055 güncelle (tarih Logo'da değişmiş olabilir)

const fs = require('fs');
const sql = require('mssql');

const config = {
  server: '10.35.20.15',
  port: 1433,
  database: 'SNCG',
  user: 'ozgur.copkur',
  password: 'Oz2025!!',
  options: { encrypt: false, trustServerCertificate: true, instanceName: 'SQLSRV' }
};

const OCAK_PATH = './masaustu/mobile/src/data/ocak_2026_data.json';
const OCAK_DESKTOP_PATH = './GuncelDesktop/ocak_2026_data.json';

function normalizeRecord(r) {
  return {
    FIRMA_NUMARASI: r['FİRMA NUMARASI'] || null,
    FIRMA_ADI: r['FİRMA ADI'] || null,
    ISYERI: r['İŞ YERİ'] || null,
    AMBAR: r['AMBAR'] || null,
    TUR: r['TÜR'] || 'HİZMET',  // null TÜR'ü HİZMET olarak ata
    MALZEME_HIZMET_KODU: r['MALZEME/HİZMET KODU'] || null,
    MASRAF_MERKEZI: r['MASRAF MERKEZİ'] || null,
    TALEP_NO: r['TALEP NUMARASI'] || null,
    TALEP_EDEN: r['TALEP EDEN'] || null,
    TALEP_TARIHI: r['TALEP TARİHİ'] || null,
    TALEP_ONAYLAYAN: r['TALEP ONAYLAYAN'] || null,
    TALEP_ONAY_TARIHI: r['TALEP ONAY TARİHİ'] || null,
    TALEP_ACIKLAMA: r['TALEP AÇIKLAMA'] || null,
    SIPARIS_NO: r['SİPARİŞ NUMARASI'] || null,
    SIPARISI_ACAN: r['SİPARİŞİ AÇAN'] || null,
    SIPARIS_TARIHI: r['SİPARİŞ TARİHİ'] || null,
    SIPARIS_ONAYLAYAN: r['SİPARİŞ ONAYLAYAN'] || null,
    SIPARIS_ONAY_TARIHI: r['SİPARİŞ ONAY TARİHİ'] || null,
    SIPARIS_MALZEME: r['SİPARİŞ MALZEME'] || null,
    TESLIM_EVRAK_NO: r['TESLİM EVRAK NO'] || null,
    TESLIM_TARIHI: r['TESLİM TARİHİ'] || null,
    CARI_UNVANI: r['CARİ ÜNVANI'] || null,
    TESLIM_ALAN: r['TESLİM ALAN'] || null,
    ACIKLAMA: r['AÇIKLAMA'] || null,
    MIKTAR: r['MİKTAR'] || null,
    BIRIM: r['BİRİM'] || null,
    ODEME_VADESI: r['ÖDEME VADESİ'] || null,
    PARA_BIRIMI: r['PARA BİRİMİ'] || 'TL',
    BIRIM_FIYAT: r['BİRİM FİYAT'] || null,
    TOPLAM: r['TOPLAM'] || null,
    FATURAYI_KAYDEDEN: r['FATURAYI KAYDEDEN'] || 'OCAK_TESLIM',
    FATURA_KAYDETME_TARIHI: r['FATURA KAYDETME TARİHİ'] || null,
    FATURA_TARIHI: r['FATURA TARİHİ'] || null,
    FATURA_NO: r['FATURA NO'] || null,
  };
}

async function main() {
  try {
    // Mevcut JSON'u oku
    const data = JSON.parse(fs.readFileSync(OCAK_PATH, 'utf8'));
    console.log('Mevcut Ocak kayıt sayısı:', data.length);

    // 1. TESTKURUMSOFT ve 00000001 kaldır
    const before = data.length;
    const filtered = data.filter(r => {
      const sipNo = (r.SIPARIS_NO || '').toUpperCase();
      if (sipNo === 'TESTKURUMSOFT' || sipNo === '00000001') return false;
      return true;
    });
    console.log(`TESTKURUMSOFT/00000001 kaldırıldı: ${before - filtered.length} kayıt`);

    // 2. SQL'den yeni kayıtları çek
    await sql.connect(config);
    
    // S.ACM.GAN.000017 - tüm kolonlar
    const r17 = await sql.query`
      SELECT * FROM (
        SELECT *, ROW_NUMBER() OVER (
          PARTITION BY [SİPARİŞ NUMARASI], [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT]
          ORDER BY (SELECT NULL)
        ) as _rn
        FROM YLZ_TALEP_SIPARIS
        WHERE [SİPARİŞ NUMARASI] = 'S.ACM.GAN.000017'
      ) dd WHERE dd._rn = 1
    `;
    console.log('\nS.ACM.GAN.000017 SQL rows (dedup):', r17.recordset.length);

    // S.ACM.GAN.000050  
    const r50 = await sql.query`
      SELECT * FROM (
        SELECT *, ROW_NUMBER() OVER (
          PARTITION BY [SİPARİŞ NUMARASI], [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT]
          ORDER BY (SELECT NULL)
        ) as _rn
        FROM YLZ_TALEP_SIPARIS
        WHERE [SİPARİŞ NUMARASI] = 'S.ACM.GAN.000050'
      ) dd WHERE dd._rn = 1
    `;
    console.log('S.ACM.GAN.000050 SQL rows (dedup):', r50.recordset.length);

    // S.ACM.GAN.000055 - tarih kontrol
    const r55 = await sql.query`
      SELECT * FROM (
        SELECT *, ROW_NUMBER() OVER (
          PARTITION BY [SİPARİŞ NUMARASI], [SİPARİŞ MALZEME], [MİKTAR], [BİRİM FİYAT]
          ORDER BY (SELECT NULL)
        ) as _rn
        FROM YLZ_TALEP_SIPARIS
        WHERE [SİPARİŞ NUMARASI] = 'S.ACM.GAN.000055'
      ) dd WHERE dd._rn = 1
    `;
    console.log('S.ACM.GAN.000055 SQL rows (dedup):', r55.recordset.length);
    r55.recordset.forEach(r => console.log('  Tarih:', r['SİPARİŞ TARİHİ'], 'TÜR:', r['TÜR'], 'Malzeme:', r['SİPARİŞ MALZEME']));

    // Yeni kayıtları normalize et
    const newRecords = [];
    for (const r of r17.recordset) {
      newRecords.push(normalizeRecord(r));
    }
    for (const r of r50.recordset) {
      newRecords.push(normalizeRecord(r));
    }
    console.log('\nEklenecek yeni kayıt:', newRecords.length);
    newRecords.forEach(r => console.log('  +', r.SIPARIS_NO, '|', r.SIPARIS_MALZEME, '|', r.TOPLAM));

    // S.ACM.GAN.000055 güncelle (mevcut JSON'daki veriyi SQL ile değiştir)
    const updated55 = r55.recordset.map(normalizeRecord);
    const result = filtered.filter(r => (r.SIPARIS_NO || '') !== 'S.ACM.GAN.000055');
    const removed55 = filtered.length - result.length;
    console.log(`S.ACM.GAN.000055 eski kayıt kaldırıldı: ${removed55}`);
    
    // Tüm kayıtları birleştir
    const final = [...result, ...newRecords, ...updated55];
    console.log('\nSonuç kayıt sayısı:', final.length);

    // Kaydet (mobile)
    fs.writeFileSync(OCAK_PATH, JSON.stringify(final, null, 2), 'utf8');
    console.log('Mobile Ocak JSON güncellendi:', OCAK_PATH);

    // Kaydet (desktop)
    fs.writeFileSync(OCAK_DESKTOP_PATH, JSON.stringify(final, null, 2), 'utf8');
    console.log('Desktop Ocak JSON güncellendi:', OCAK_DESKTOP_PATH);

    await sql.close();
  } catch(e) {
    console.error('HATA:', e.message);
    await sql.close();
  }
}

main();
