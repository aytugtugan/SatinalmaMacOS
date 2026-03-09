const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const config = {
  server: '10.35.20.15\\SQLSRV',
  database: 'SNCG',
  user: 'ozgur.copkur',
  password: 'Oz2025!!',
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true }
};

const DATE_FILTER = '2026-02-01';

(async () => {
  const pool = await sql.connect(config);

  // 1) Kolon isimlerini bul
  const colRes = await pool.request().query(`SELECT TOP 1 * FROM YLZ_TALEP_SIPARIS`);
  const cols = Object.keys(colRes.recordset[0] || {});
  const findCol = (candidates) => {
    for (const c of candidates) {
      const found = cols.find(k => k.replace(/\s+/g,'').toUpperCase() === c.replace(/\s+/g,'').toUpperCase());
      if (found) return found;
    }
    return null;
  };
  
  const C_AMBAR = findCol(['AMBAR']);
  const C_SIPARIS_NO = findCol(['SİPARİŞ NUMARASI', 'SIPARIS NUMARASI']);
  const C_SIPARIS_MALZEME = findCol(['SİPARİŞ MALZEME', 'SIPARIS MALZEME']);
  const C_SIPARIS_TARIHI = findCol(['SİPARİŞ TARİHİ', 'SIPARIS TARIHI']);
  const C_TALEP_TARIHI = findCol(['TALEP TARİHİ', 'TALEP TARIHI']);
  const C_TUR = findCol(['TÜR', 'TUR']);
  const C_TOPLAM = findCol(['TOPLAM']);
  const C_FATURAYI_KAYDEDEN = findCol(['FATURAYI KAYDEDEN']);
  const C_TESLIM_EVRAK_NO = findCol(['TESLİM EVRAK NO', 'TESLIM EVRAK NO']);
  const C_TALEP_NO = findCol(['TALEP NUMARASI', 'TALEP NO']);
  const C_CARI = findCol(['CARİ ÜNVANI', 'CARI UNVANI']);

  const q = (c) => '[' + c.replace(/]/g, ']]') + ']';

  console.log('=== KOLON ADLARI ===');
  console.log('AMBAR:', C_AMBAR);
  console.log('SIPARIS_NO:', C_SIPARIS_NO);
  console.log('SIPARIS_MALZEME:', C_SIPARIS_MALZEME);
  console.log('SIPARIS_TARIHI:', C_SIPARIS_TARIHI);
  console.log('TUR:', C_TUR);
  console.log('TOPLAM:', C_TOPLAM);

  // 2) SQL: GAZİANTEP + Şubat+ veriler (TUR filtreli)
  const sqlQuery = `
    SELECT ${q(C_SIPARIS_NO)} as SIPARIS_NO, 
           ${q(C_SIPARIS_MALZEME)} as SIPARIS_MALZEME,
           ${q(C_SIPARIS_TARIHI)} as SIPARIS_TARIHI,
           ${q(C_TOPLAM)} as TOPLAM,
           ${q(C_TUR)} as TUR,
           ${q(C_FATURAYI_KAYDEDEN)} as FATURAYI_KAYDEDEN,
           ${q(C_TESLIM_EVRAK_NO)} as TESLIM_EVRAK_NO,
           ${q(C_TALEP_NO)} as TALEP_NO,
           ${q(C_CARI)} as CARI_UNVANI,
           ${q(C_AMBAR)} as AMBAR
    FROM YLZ_TALEP_SIPARIS
    WHERE (${q(C_TALEP_TARIHI)} >= '${DATE_FILTER}' OR ${q(C_SIPARIS_TARIHI)} >= '${DATE_FILTER}')
      AND UPPER(${q(C_AMBAR)}) = 'GAZİANTEP'
      AND ${q(C_TUR)} IS NOT NULL AND ${q(C_TUR)} <> ''
  `;
  const sqlRaw = (await pool.request().query(sqlQuery)).recordset;
  console.log('\n=== SQL RAW (Şubat+, GAZİANTEP) ===');
  console.log('Toplam satır:', sqlRaw.length);

  // 3) Statik Ocak verisi
  const staticJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'ocak_2026_data.json'), 'utf8'));
  const staticAll = (staticJson.records || []).filter(r => r.TUR && r.TUR !== '');
  const staticGaz = staticAll.filter(r => {
    const ambar = (r.AMBAR || '').toLocaleUpperCase('tr-TR');
    return ambar === 'GAZİANTEP';
  });
  console.log('\n=== STATİK OCAK (GAZİANTEP) ===');
  console.log('Toplam satır:', staticGaz.length);

  // 4) DEDUP olmadan birleşik veri
  const combined = [
    ...staticGaz.map(r => ({
      SIPARIS_NO: r.SIPARIS_NO,
      SIPARIS_MALZEME: r.SIPARIS_MALZEME,
      SIPARIS_TARIHI: r.SIPARIS_TARIHI,
      TOPLAM: r.TOPLAM,
      TUR: r.TUR,
      FATURAYI_KAYDEDEN: r.FATURAYI_KAYDEDEN,
      TESLIM_EVRAK_NO: r.TESLIM_EVRAK_NO,
      TALEP_NO: r.TALEP_NO,
      CARI_UNVANI: r.CARI_UNVANI,
      SOURCE: 'STATIC'
    })),
    ...sqlRaw.map(r => ({
      SIPARIS_NO: r.SIPARIS_NO,
      SIPARIS_MALZEME: r.SIPARIS_MALZEME,
      SIPARIS_TARIHI: r.SIPARIS_TARIHI,
      TOPLAM: r.TOPLAM,
      TUR: r.TUR,
      FATURAYI_KAYDEDEN: r.FATURAYI_KAYDEDEN,
      TESLIM_EVRAK_NO: r.TESLIM_EVRAK_NO,
      TALEP_NO: r.TALEP_NO,
      CARI_UNVANI: r.CARI_UNVANI,
      SOURCE: 'SQL'
    }))
  ];
  console.log('\n=== BİRLEŞİK VERİ (DEDUP YOK) ===');
  console.log('Toplam satır:', combined.length);

  // 5) DEDUP: SIPARIS_NO + SIPARIS_MALZEME
  const seen1 = new Set();
  const deduped = combined.filter(r => {
    const key = `${r.SIPARIS_NO || ''}|${r.SIPARIS_MALZEME || ''}`;
    if (seen1.has(key)) return false;
    seen1.add(key);
    return true;
  });
  console.log('Dedup sonrası:', deduped.length);

  // 6) Aylık analiz - DEDUP olmadan
  console.log('\n=== AYLIK ANALİZ (DEDUP YOK) ===');
  const monthlyNoDedup = new Map();
  for (const r of combined) {
    if (!r.SIPARIS_TARIHI) continue;
    const d = new Date(r.SIPARIS_TARIHI);
    const ay = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if (!monthlyNoDedup.has(ay)) monthlyNoDedup.set(ay, { siparisSet: new Set(), toplam: 0, satirSayisi: 0 });
    const g = monthlyNoDedup.get(ay);
    if (r.SIPARIS_NO) g.siparisSet.add(r.SIPARIS_NO);
    g.toplam += Number(r.TOPLAM) || 0;
    g.satirSayisi++;
  }
  for (const [ay, data] of [...monthlyNoDedup.entries()].sort()) {
    console.log(`  ${ay}: sipariş=${data.siparisSet.size}, tutar=${data.toplam.toLocaleString('tr-TR')}, satır=${data.satirSayisi}`);
  }

  // 7) Aylık analiz - DEDUP ile
  console.log('\n=== AYLIK ANALİZ (DEDUP İLE) ===');
  const monthlyDedup = new Map();
  for (const r of deduped) {
    if (!r.SIPARIS_TARIHI) continue;
    const d = new Date(r.SIPARIS_TARIHI);
    const ay = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if (!monthlyDedup.has(ay)) monthlyDedup.set(ay, { siparisSet: new Set(), toplam: 0, satirSayisi: 0 });
    const g = monthlyDedup.get(ay);
    if (r.SIPARIS_NO) g.siparisSet.add(r.SIPARIS_NO);
    g.toplam += Number(r.TOPLAM) || 0;
    g.satirSayisi++;
  }
  for (const [ay, data] of [...monthlyDedup.entries()].sort()) {
    console.log(`  ${ay}: sipariş=${data.siparisSet.size}, tutar=${data.toplam.toLocaleString('tr-TR')}, satır=${data.satirSayisi}`);
  }

  // 8) Unique sipariş numaraları - sadece SIPARIS_NO bazında
  console.log('\n=== UNIQUE SİPARİŞ NO (tüm veri) ===');
  const allSiparisNo = new Set(combined.map(r => r.SIPARIS_NO).filter(Boolean));
  console.log('Toplam benzersiz sipariş no:', allSiparisNo.size);
  
  const allTalepNo = new Set(combined.map(r => r.TALEP_NO).filter(Boolean));
  console.log('Toplam benzersiz talep no:', allTalepNo.size);

  // 9) Teslimat durumu analizi
  console.log('\n=== TESLİMAT DURUMU (DEDUP YOK) ===');
  const sipDeliveryAll = new Map();
  for (const r of combined) {
    if (!r.SIPARIS_NO) continue;
    const hasE = r.FATURAYI_KAYDEDEN && r.FATURAYI_KAYDEDEN !== '';
    const hasEvrak = r.TESLIM_EVRAK_NO && r.TESLIM_EVRAK_NO !== '';
    if (!sipDeliveryAll.has(r.SIPARIS_NO)) {
      sipDeliveryAll.set(r.SIPARIS_NO, { hasFaturaKaydeden: false, hasEvrakNo: false });
    }
    const s = sipDeliveryAll.get(r.SIPARIS_NO);
    if (hasE) s.hasFaturaKaydeden = true;
    if (hasEvrak) s.hasEvrakNo = true;
  }
  let teslimByFatura = 0, bekleyenByFatura = 0;
  let teslimByEvrak = 0, bekleyenByEvrak = 0;
  for (const s of sipDeliveryAll.values()) {
    if (s.hasFaturaKaydeden) teslimByFatura++; else bekleyenByFatura++;
    if (s.hasEvrakNo) teslimByEvrak++; else bekleyenByEvrak++;
  }
  console.log(`  FATURAYI_KAYDEDEN bazlı: teslim=${teslimByFatura}, bekleyen=${bekleyenByFatura}`);
  console.log(`  TESLIM_EVRAK_NO bazlı: teslim=${teslimByEvrak}, bekleyen=${bekleyenByEvrak}`);

  console.log('\n=== TESLİMAT DURUMU (DEDUP İLE) ===');
  const sipDeliveryDedup = new Map();
  for (const r of deduped) {
    if (!r.SIPARIS_NO) continue;
    const hasE = r.FATURAYI_KAYDEDEN && r.FATURAYI_KAYDEDEN !== '';
    const hasEvrak = r.TESLIM_EVRAK_NO && r.TESLIM_EVRAK_NO !== '';
    if (!sipDeliveryDedup.has(r.SIPARIS_NO)) {
      sipDeliveryDedup.set(r.SIPARIS_NO, { hasFaturaKaydeden: false, hasEvrakNo: false });
    }
    const s = sipDeliveryDedup.get(r.SIPARIS_NO);
    if (hasE) s.hasFaturaKaydeden = true;
    if (hasEvrak) s.hasEvrakNo = true;
  }
  let teslimByFatura2 = 0, bekleyenByFatura2 = 0;
  let teslimByEvrak2 = 0, bekleyenByEvrak2 = 0;
  for (const s of sipDeliveryDedup.values()) {
    if (s.hasFaturaKaydeden) teslimByFatura2++; else bekleyenByFatura2++;
    if (s.hasEvrakNo) teslimByEvrak2++; else bekleyenByEvrak2++;
  }
  console.log(`  FATURAYI_KAYDEDEN bazlı: teslim=${teslimByFatura2}, bekleyen=${bekleyenByFatura2}`);
  console.log(`  TESLIM_EVRAK_NO bazlı: teslim=${teslimByEvrak2}, bekleyen=${bekleyenByEvrak2}`);

  // 10) Duplike satırları listele (hangi SIPARIS_NO + SIPARIS_MALZEME birden fazla)
  console.log('\n=== DUPLİKE SATIRLAR (BİRLEŞİK VERİ) ===');
  const keyCount = new Map();
  for (const r of combined) {
    const key = `${r.SIPARIS_NO || ''}|${r.SIPARIS_MALZEME || ''}`;
    keyCount.set(key, (keyCount.get(key) || 0) + 1);
  }
  let dupCount = 0;
  for (const [key, count] of keyCount.entries()) {
    if (count > 1) {
      dupCount++;
      if (dupCount <= 15) {
        console.log(`  ${key} -> ${count} kez`);
      }
    }
  }
  console.log(`  Toplam duplike key: ${dupCount}`);

  // 11) Duplike olan satırların detayını göster (SOURCE bilgisi ile)
  console.log('\n=== DUPLİKE DETAY (kaynak bilgisi ile) ===');
  let shown = 0;
  for (const [key, count] of keyCount.entries()) {
    if (count > 1 && shown < 5) {
      shown++;
      const matching = combined.filter(r => `${r.SIPARIS_NO || ''}|${r.SIPARIS_MALZEME || ''}` === key);
      console.log(`\n  KEY: ${key} (${count} kez)`);
      for (const m of matching) {
        console.log(`    SOURCE=${m.SOURCE}, TARIH=${m.SIPARIS_TARIHI}, TOPLAM=${m.TOPLAM}, EVRAK=${m.TESLIM_EVRAK_NO || '-'}, FATURA_KAYDEDEN=${m.FATURAYI_KAYDEDEN || '-'}`);
      }
    }
  }

  // 12) Ocak - duplike olan SIPARIS_NO'ları göster
  console.log('\n=== OCAK STATİK - SİPARİŞ DETAY ===');
  const ocakSiparisler = new Map();
  for (const r of staticGaz) {
    if (!ocakSiparisler.has(r.SIPARIS_NO)) ocakSiparisler.set(r.SIPARIS_NO, []);
    ocakSiparisler.get(r.SIPARIS_NO).push(r);
  }
  for (const [sipNo, rows] of ocakSiparisler.entries()) {
    const uniqueMalzeme = new Set(rows.map(r => r.SIPARIS_MALZEME));
    const toplam = rows.reduce((s, r) => s + (Number(r.TOPLAM) || 0), 0);
    console.log(`  ${sipNo}: ${rows.length} satır, ${uniqueMalzeme.size} benzersiz malzeme, toplam=${toplam.toLocaleString('tr-TR')}`);
  }

  // 13) ALL DATA kontrolü - getAllData simülasyonu
  console.log('\n=== getAllData SİMÜLASYONU ===');
  // SQL'den TÜM GAZİANTEP verisi (şubat+)
  const sqlAllQuery = `
    SELECT ${q(C_SIPARIS_NO)} as SIPARIS_NO, 
           ${q(C_SIPARIS_MALZEME)} as SIPARIS_MALZEME,
           ${q(C_SIPARIS_TARIHI)} as SIPARIS_TARIHI,
           ${q(C_TOPLAM)} as TOPLAM,
           ${q(C_FATURAYI_KAYDEDEN)} as FATURAYI_KAYDEDEN,
           ${q(C_TESLIM_EVRAK_NO)} as TESLIM_EVRAK_NO
    FROM YLZ_TALEP_SIPARIS
    WHERE (${q(C_TALEP_TARIHI)} >= '${DATE_FILTER}' OR ${q(C_SIPARIS_TARIHI)} >= '${DATE_FILTER}')
      AND UPPER(${q(C_AMBAR)}) = 'GAZİANTEP'
      AND ${q(C_TUR)} IS NOT NULL AND ${q(C_TUR)} <> ''
  `;
  const sqlAllData = (await pool.request().query(sqlAllQuery)).recordset;
  
  // SQL tarafında da duplike var mı?
  const sqlKeyCount = new Map();
  for (const r of sqlAllData) {
    const key = `${r.SIPARIS_NO || ''}|${r.SIPARIS_MALZEME || ''}`;
    sqlKeyCount.set(key, (sqlKeyCount.get(key) || 0) + 1);
  }
  let sqlDup = 0;
  for (const [key, count] of sqlKeyCount.entries()) {
    if (count > 1) sqlDup++;
  }
  console.log(`SQL (Şubat+) GAZİANTEP: ${sqlAllData.length} satır, ${sqlDup} duplike key`);
  
  // Statik tarafında duplike var mı?
  const staticKeyCount = new Map();
  for (const r of staticGaz) {
    const key = `${r.SIPARIS_NO || ''}|${r.SIPARIS_MALZEME || ''}`;
    staticKeyCount.set(key, (staticKeyCount.get(key) || 0) + 1);
  }
  let staticDup = 0;
  for (const [key, count] of staticKeyCount.entries()) {
    if (count > 1) staticDup++;
  }
  console.log(`Statik (Ocak) GAZİANTEP: ${staticGaz.length} satır, ${staticDup} duplike key`);

  // 14) CRITICAL: dedup ile bilgi kaybı var mı?
  // Aynı SIPARIS_NO + SIPARIS_MALZEME ama FARKLI TOPLAM değerleri
  console.log('\n=== DEDUP İLE BİLGİ KAYBI KONTROLÜ ===');
  const keyDetails = new Map();
  for (const r of combined) {
    const key = `${r.SIPARIS_NO || ''}|${r.SIPARIS_MALZEME || ''}`;
    if (!keyDetails.has(key)) keyDetails.set(key, []);
    keyDetails.get(key).push(r);
  }
  let infoLoss = 0;
  for (const [key, rows] of keyDetails.entries()) {
    if (rows.length > 1) {
      const toplamlar = [...new Set(rows.map(r => Number(r.TOPLAM) || 0))];
      const evraklar = [...new Set(rows.map(r => r.TESLIM_EVRAK_NO || ''))];
      const faturalar = [...new Set(rows.map(r => r.FATURAYI_KAYDEDEN || ''))];
      
      if (toplamlar.length > 1 || evraklar.length > 1 || faturalar.length > 1) {
        infoLoss++;
        if (infoLoss <= 10) {
          console.log(`  ${key}:`);
          console.log(`    TOPLAM değerleri: ${toplamlar.join(', ')}`);
          console.log(`    EVRAK NO değerleri: ${evraklar.join(', ')}`);
          console.log(`    FATURA KAYDEDEN: ${faturalar.join(', ')}`);
          for (const r of rows) {
            console.log(`      SOURCE=${r.SOURCE} TOPLAM=${r.TOPLAM} EVRAK=${r.TESLIM_EVRAK_NO||'-'} FATURA=${r.FATURAYI_KAYDEDEN||'-'}`);
          }
        }
      }
    }
  }
  console.log(`Toplam bilgi kaybı riski olan key: ${infoLoss}`);

  pool.close();
  console.log('\n=== BİTTİ ===');
})().catch(e => { console.error(e); process.exit(1); });
