// SQL'den Ocak siparişlerinin masraf merkezlerini çek
const sql = require('mssql');
const fs = require('fs');
const path = require('path');

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
};

async function main() {
  const pool = await sql.connect(config);
  
  // Ocak JSON'daki sipariş numaraları
  const ocakData = JSON.parse(fs.readFileSync(path.join(__dirname, 'masaustu/mobile/src/data/ocak_2026_data.json'), 'utf-8'));
  const siparisNos = [...new Set(ocakData.map(r => r.SIPARIS_NO).filter(Boolean))];
  
  console.log('Ocak sipariş sayısı:', siparisNos.length);
  
  // SQL'den bu siparişlerin masraf merkezi, talep no, talep eden, sipariş malzeme, açıklama vs bilgilerini çek
  // IN clause için parametre oluştur
  const params = siparisNos.map((s, i) => `@p${i}`).join(', ');
  const request = pool.request();
  siparisNos.forEach((s, i) => request.input(`p${i}`, sql.NVarChar, s));
  
  const query = `
    SELECT DISTINCT
      [SİPARİŞ NUMARASI] as SIPARIS_NO,
      [MASRAF MERKEZİ] as MASRAF_MERKEZI,
      [TALEP NUMARASI] as TALEP_NO,
      [TALEP EDEN] as TALEP_EDEN,
      [SİPARİŞ MALZEME] as SIPARIS_MALZEME,
      [AÇIKLAMA] as ACIKLAMA,
      [SİPARİŞ ONAYLAYAN] as SIPARIS_ONAYLAYAN,
      [TALEP ONAYLAYAN] as TALEP_ONAYLAYAN,
      [AMBAR] as AMBAR_SQL,
      [İŞ YERİ] as ISYERI_SQL,
      [MALZEME/HİZMET KODU] as MALZEME_HIZMET_KODU,
      [MİKTAR] as MIKTAR,
      [BİRİM] as BIRIM,
      [BİRİM FİYAT] as BIRIM_FIYAT,
      [TOPLAM] as TOPLAM
    FROM YLZ_TALEP_SIPARIS
    WHERE [SİPARİŞ NUMARASI] IN (${params})
  `;
  
  const result = await request.query(query);
  console.log('SQL sonuç sayısı:', result.recordset.length);
  
  // Sipariş no bazında grupla
  const sqlMap = new Map();
  for (const row of result.recordset) {
    const sipNo = row.SIPARIS_NO;
    if (!sqlMap.has(sipNo)) {
      sqlMap.set(sipNo, []);
    }
    sqlMap.get(sipNo).push(row);
  }
  
  console.log('\nSQL\'de bulunan unique sipariş:', sqlMap.size);
  console.log('Bulunamayan siparişler:', siparisNos.filter(s => !sqlMap.has(s)));
  
  // Masraf merkezi dağılımı
  const mmDist = {};
  for (const [sipNo, rows] of sqlMap) {
    const mms = [...new Set(rows.map(r => r.MASRAF_MERKEZI).filter(Boolean))];
    for (const mm of mms) {
      mmDist[mm] = (mmDist[mm] || 0) + 1;
    }
  }
  console.log('\nMasraf Merkezi dağılımı (SQL):', JSON.stringify(mmDist, null, 2));
  
  // Tire siparişi detay
  const tireRows = sqlMap.get('S.ACM.GKÇ.000070') || [];
  console.log('\nTire siparişi (S.ACM.GKÇ.000070) SQL detay:');
  console.log('Satır sayısı:', tireRows.length);
  if (tireRows.length > 0) {
    console.log('İlk satır:', JSON.stringify(tireRows[0], null, 2));
  }
  
  // Şimdi JSON'u güncelle - SQL'den gelen ek bilgileri ekle
  // Her sipariş için SQL'deki ilk satırdan masraf merkezi ve diğer bilgileri al
  let updatedCount = 0;
  for (const record of ocakData) {
    const sipNo = record.SIPARIS_NO;
    if (!sipNo || !sqlMap.has(sipNo)) continue;
    
    const sqlRows = sqlMap.get(sipNo);
    // İlk satırdan genel bilgileri al
    const firstRow = sqlRows[0];
    
    // Masraf merkezi
    if (!record.MASRAF_MERKEZI && firstRow.MASRAF_MERKEZI) {
      record.MASRAF_MERKEZI = firstRow.MASRAF_MERKEZI;
    }
    
    // Talep no
    if (!record.TALEP_NO && firstRow.TALEP_NO) {
      record.TALEP_NO = firstRow.TALEP_NO;
    }
    
    // Sipariş malzeme
    if (!record.SIPARIS_MALZEME && firstRow.SIPARIS_MALZEME) {
      record.SIPARIS_MALZEME = firstRow.SIPARIS_MALZEME;
    }
    
    // Açıklama
    if (!record.ACIKLAMA && firstRow.ACIKLAMA) {
      record.ACIKLAMA = firstRow.ACIKLAMA;
    }
    
    // Sipariş onaylayan
    if (!record.SIPARIS_ONAYLAYAN && firstRow.SIPARIS_ONAYLAYAN) {
      record.SIPARIS_ONAYLAYAN = firstRow.SIPARIS_ONAYLAYAN;
    }
    
    // Talep onaylayan
    if (!record.TALEP_ONAYLAYAN && firstRow.TALEP_ONAYLAYAN) {
      record.TALEP_ONAYLAYAN = firstRow.TALEP_ONAYLAYAN;
    }
    
    // Malzeme/Hizmet kodu
    if (!record.MALZEME_HIZMET_KODU && firstRow.MALZEME_HIZMET_KODU) {
      record.MALZEME_HIZMET_KODU = firstRow.MALZEME_HIZMET_KODU;
    }
    
    updatedCount++;
  }
  
  console.log('\nGüncellenen kayıt sayısı:', updatedCount);
  
  // Güncellenen masraf merkezi dağılımı
  const mmAfter = {};
  for (const r of ocakData) {
    const mm = r.MASRAF_MERKEZI || 'BOŞ';
    mmAfter[mm] = (mmAfter[mm] || 0) + 1;
  }
  console.log('Güncel Masraf Merkezi dağılımı:', JSON.stringify(mmAfter, null, 2));
  
  // Kaydet
  const mobileOut = path.join(__dirname, 'masaustu/mobile/src/data/ocak_2026_data.json');
  const desktopOut = path.join(__dirname, 'GuncelDesktop/ocak_2026_data.json');
  
  fs.writeFileSync(mobileOut, JSON.stringify(ocakData, null, 2), 'utf-8');
  fs.writeFileSync(desktopOut, JSON.stringify(ocakData, null, 2), 'utf-8');
  
  console.log('\n✅ Mobile JSON kaydedildi:', mobileOut);
  console.log('✅ Desktop JSON kaydedildi:', desktopOut);
  
  await pool.close();
}

main().catch(err => {
  console.error('HATA:', err.message);
  process.exit(1);
});
