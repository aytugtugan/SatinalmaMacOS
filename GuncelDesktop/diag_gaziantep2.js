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

(async () => {
  const pool = await sql.connect(config);
  const colRes = await pool.request().query('SELECT TOP 1 * FROM YLZ_TALEP_SIPARIS');
  const cols = Object.keys(colRes.recordset[0] || {});
  const findCol = (candidates) => {
    for (const c of candidates) {
      const found = cols.find(k => k.replace(/\s+/g,'').toUpperCase() === c.replace(/\s+/g,'').toUpperCase());
      if (found) return found;
    }
    return null;
  };
  const C = {
    AMBAR: findCol(['AMBAR']),
    SIPARIS_NO: findCol(['SİPARİŞ NUMARASI']),
    SIPARIS_MALZEME: findCol(['SİPARİŞ MALZEME']),
    SIPARIS_TARIHI: findCol(['SİPARİŞ TARİHİ']),
    TALEP_TARIHI: findCol(['TALEP TARİHİ']),
    TUR: findCol(['TÜR']),
    TOPLAM: findCol(['TOPLAM']),
    MIKTAR: findCol(['MİKTAR']),
    BIRIM_FIYAT: findCol(['BİRİM FİYAT']),
    FATURAYI_KAYDEDEN: findCol(['FATURAYI KAYDEDEN']),
    TESLIM_EVRAK_NO: findCol(['TESLİM EVRAK NO']),
    TALEP_NO: findCol(['TALEP NUMARASI']),
    ACIKLAMA: findCol(['AÇIKLAMA']),
  };
  const q = (c) => '[' + c.replace(/]/g, ']]') + ']';

  // 1) SQL'den doğrudan OCAK GAZİANTEP verisi çek (statik dosya yerine)
  console.log('=== 1) SQL OCAK GAZİANTEP (doğrudan DB) ===');
  const ocakSqlQuery = `
    SELECT ${q(C.SIPARIS_NO)} as SIPARIS_NO,
           ${q(C.SIPARIS_MALZEME)} as SIPARIS_MALZEME,
           ${q(C.SIPARIS_TARIHI)} as SIPARIS_TARIHI,
           ${q(C.TOPLAM)} as TOPLAM,
           ${q(C.MIKTAR)} as MIKTAR,
           ${q(C.BIRIM_FIYAT)} as BIRIM_FIYAT,
           ${q(C.FATURAYI_KAYDEDEN)} as FATURAYI_KAYDEDEN,
           ${q(C.TESLIM_EVRAK_NO)} as TESLIM_EVRAK_NO,
           ${q(C.ACIKLAMA)} as ACIKLAMA,
           ${q(C.TUR)} as TUR
    FROM YLZ_TALEP_SIPARIS
    WHERE UPPER(${q(C.AMBAR)}) = 'GAZİANTEP'
      AND ${q(C.TUR)} IS NOT NULL AND ${q(C.TUR)} <> ''
      AND ${q(C.SIPARIS_TARIHI)} >= '2026-01-01' AND ${q(C.SIPARIS_TARIHI)} < '2026-02-01'
  `;
  const ocakSql = (await pool.request().query(ocakSqlQuery)).recordset;
  const ocakSqlSiparis = new Set(ocakSql.map(r => r.SIPARIS_NO).filter(Boolean));
  console.log(`SQL Ocak: ${ocakSql.length} satır, ${ocakSqlSiparis.size} benzersiz sipariş`);

  // 2) Şubat SQL
  console.log('\n=== 2) SQL ŞUBAT GAZİANTEP (doğrudan DB) ===');
  const subatSqlQuery = `
    SELECT ${q(C.SIPARIS_NO)} as SIPARIS_NO,
           ${q(C.SIPARIS_MALZEME)} as SIPARIS_MALZEME,
           ${q(C.SIPARIS_TARIHI)} as SIPARIS_TARIHI,
           ${q(C.TOPLAM)} as TOPLAM,
           ${q(C.MIKTAR)} as MIKTAR,
           ${q(C.BIRIM_FIYAT)} as BIRIM_FIYAT,
           ${q(C.FATURAYI_KAYDEDEN)} as FATURAYI_KAYDEDEN,
           ${q(C.TESLIM_EVRAK_NO)} as TESLIM_EVRAK_NO,
           ${q(C.ACIKLAMA)} as ACIKLAMA,
           ${q(C.TUR)} as TUR
    FROM YLZ_TALEP_SIPARIS
    WHERE UPPER(${q(C.AMBAR)}) = 'GAZİANTEP'
      AND ${q(C.TUR)} IS NOT NULL AND ${q(C.TUR)} <> ''
      AND ${q(C.SIPARIS_TARIHI)} >= '2026-02-01'
  `;
  const subatSql = (await pool.request().query(subatSqlQuery)).recordset;
  const subatSqlSiparis = new Set(subatSql.map(r => r.SIPARIS_NO).filter(Boolean));
  console.log(`SQL Şubat: ${subatSql.length} satır, ${subatSqlSiparis.size} benzersiz sipariş`);

  // 3) Statik dosya Ocak
  console.log('\n=== 3) STATİK DOSYA OCAK GAZİANTEP ===');
  const staticJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'ocak_2026_data.json'), 'utf8'));
  const staticAll = (staticJson.records || []).filter(r => r.TUR && r.TUR !== '');
  const staticGaz = staticAll.filter(r => (r.AMBAR || '').toLocaleUpperCase('tr-TR') === 'GAZİANTEP');
  const staticSiparis = new Set(staticGaz.map(r => r.SIPARIS_NO).filter(Boolean));
  console.log(`Statik Ocak: ${staticGaz.length} satır, ${staticSiparis.size} benzersiz sipariş`);

  // 4) SQL Ocak vs Statik Ocak farkı
  console.log('\n=== 4) SQL OCAK vs STATİK OCAK FARKI ===');
  const sqlOnlyOcak = [...ocakSqlSiparis].filter(s => !staticSiparis.has(s));
  const staticOnlyOcak = [...staticSiparis].filter(s => !ocakSqlSiparis.has(s));
  console.log(`SQL'de olup statik'te olmayan: ${sqlOnlyOcak.length} -> ${sqlOnlyOcak.join(', ')}`);
  console.log(`Statik'te olup SQL'de olmayan: ${staticOnlyOcak.length} -> ${staticOnlyOcak.join(', ')}`);

  // 5) DOĞRU DEDUP: SIPARIS_NO + SIPARIS_MALZEME + TOPLAM + MIKTAR + BIRIM_FIYAT
  // (aynı sipariş satırının teslimat JOIN'i ile çoğalmasını engeller,
  //  ama farklı kalem satırlarını korur)
  console.log('\n=== 5) 3 FARKLI DEDUP STRATEJİSİ KARŞILAŞTIRMASI (BİRLEŞİK VERİ) ===');
  
  const combined = [
    ...staticGaz.map(r => ({ ...r, SOURCE: 'STATIC' })),
    ...subatSql.map(r => ({ ...r, SOURCE: 'SQL' }))
  ];
  console.log(`Birleşik (dedup yok): ${combined.length} satır`);

  // Strateji A: SIPARIS_NO + SIPARIS_MALZEME (mevcut - YANLIŞ)
  const seenA = new Set();
  const dedupA = combined.filter(r => {
    const key = `${r.SIPARIS_NO || ''}|${r.SIPARIS_MALZEME || ''}`;
    if (seenA.has(key)) return false;
    seenA.add(key);
    return true;
  });

  // Strateji B: SIPARIS_NO + SIPARIS_MALZEME + TOPLAM (daha iyi)
  const seenB = new Set();
  const dedupB = combined.filter(r => {
    const key = `${r.SIPARIS_NO || ''}|${r.SIPARIS_MALZEME || ''}|${r.TOPLAM || ''}`;
    if (seenB.has(key)) return false;
    seenB.add(key);
    return true;
  });

  // Strateji C: SIPARIS_NO + SIPARIS_MALZEME + MIKTAR + BIRIM_FIYAT (en güvenli)
  const seenC = new Set();
  const dedupC = combined.filter(r => {
    const key = `${r.SIPARIS_NO || ''}|${r.SIPARIS_MALZEME || ''}|${r.MIKTAR || ''}|${r.BIRIM_FIYAT || ''}`;
    if (seenC.has(key)) return false;
    seenC.add(key);
    return true;
  });

  console.log(`Strateji A (SIP+MAL - mevcut): ${dedupA.length} satır`);
  console.log(`Strateji B (SIP+MAL+TOPLAM):    ${dedupB.length} satır`);
  console.log(`Strateji C (SIP+MAL+MIK+BF):    ${dedupC.length} satır`);

  // 6) Aylık karşılaştırma her strateji için
  function analyzeMonthly(data, label) {
    const monthly = new Map();
    for (const r of data) {
      if (!r.SIPARIS_TARIHI) continue;
      const d = new Date(r.SIPARIS_TARIHI);
      const ay = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (!monthly.has(ay)) monthly.set(ay, { siparisSet: new Set(), toplam: 0, satir: 0 });
      const g = monthly.get(ay);
      if (r.SIPARIS_NO) g.siparisSet.add(r.SIPARIS_NO);
      g.toplam += Number(r.TOPLAM) || 0;
      g.satir++;
    }
    console.log(`\n  ${label}:`);
    for (const [ay, data] of [...monthly.entries()].sort()) {
      console.log(`    ${ay}: sipariş=${data.siparisSet.size}, tutar=${Math.round(data.toplam).toLocaleString('tr-TR')}, satır=${data.satir}`);
    }
    const totalSip = new Set([...data.map(r => r.SIPARIS_NO).filter(Boolean)]);
    const totalTutar = data.reduce((s, r) => s + (Number(r.TOPLAM) || 0), 0);
    console.log(`    TOPLAM: sipariş=${totalSip.size}, tutar=${Math.round(totalTutar).toLocaleString('tr-TR')}`);
  }

  console.log('\n=== 6) AYLIK KARŞILAŞTIRMA ===');
  analyzeMonthly(combined, 'DEDUP YOK');
  analyzeMonthly(dedupA, 'Strateji A (SIP+MAL) - mevcut');
  analyzeMonthly(dedupB, 'Strateji B (SIP+MAL+TOPLAM)');
  analyzeMonthly(dedupC, 'Strateji C (SIP+MAL+MIK+BF)');

  // 7) SQL doğrudan Ocak kontrol (duplike olmadan)
  console.log('\n=== 7) SQL DOĞRUDAN OCAK - DEDUP İLE ===');
  const ocakDedupQuery = `
    SELECT SIPARIS_NO, COUNT(*) as satirSayisi, 
           SUM(TOPLAM) as toplamTutar
    FROM (
      SELECT ${q(C.SIPARIS_NO)} as SIPARIS_NO,
             ${q(C.TOPLAM)} as TOPLAM,
             ROW_NUMBER() OVER (
               PARTITION BY ${q(C.SIPARIS_NO)}, ${q(C.SIPARIS_MALZEME)}, ${q(C.TOPLAM)}, ${q(C.MIKTAR)}, ${q(C.BIRIM_FIYAT)}
               ORDER BY (SELECT NULL)
             ) as rn
      FROM YLZ_TALEP_SIPARIS
      WHERE UPPER(${q(C.AMBAR)}) = 'GAZİANTEP'
        AND ${q(C.TUR)} IS NOT NULL AND ${q(C.TUR)} <> ''
        AND ${q(C.SIPARIS_TARIHI)} >= '2026-01-01' AND ${q(C.SIPARIS_TARIHI)} < '2026-02-01'
    ) d WHERE d.rn = 1
    GROUP BY SIPARIS_NO
    ORDER BY SIPARIS_NO
  `;
  const ocakDeduped = (await pool.request().query(ocakDedupQuery)).recordset;
  console.log(`Ocak benzersiz sipariş (SQL ROW_NUMBER dedup): ${ocakDeduped.length}`);
  const ocakToplamSQL = ocakDeduped.reduce((s, r) => s + (Number(r.toplamTutar) || 0), 0);
  console.log(`Ocak toplam tutar (SQL dedup): ${Math.round(ocakToplamSQL).toLocaleString('tr-TR')}`);

  // 8) Şubat SQL dedup
  const subatDedupQuery = `
    SELECT SIPARIS_NO, COUNT(*) as satirSayisi,
           SUM(TOPLAM) as toplamTutar
    FROM (
      SELECT ${q(C.SIPARIS_NO)} as SIPARIS_NO,
             ${q(C.TOPLAM)} as TOPLAM,
             ROW_NUMBER() OVER (
               PARTITION BY ${q(C.SIPARIS_NO)}, ${q(C.SIPARIS_MALZEME)}, ${q(C.TOPLAM)}, ${q(C.MIKTAR)}, ${q(C.BIRIM_FIYAT)}
               ORDER BY (SELECT NULL)
             ) as rn
      FROM YLZ_TALEP_SIPARIS
      WHERE UPPER(${q(C.AMBAR)}) = 'GAZİANTEP'
        AND ${q(C.TUR)} IS NOT NULL AND ${q(C.TUR)} <> ''
        AND ${q(C.SIPARIS_TARIHI)} >= '2026-02-01'
    ) d WHERE d.rn = 1
    GROUP BY SIPARIS_NO
    ORDER BY SIPARIS_NO
  `;
  const subatDeduped = (await pool.request().query(subatDedupQuery)).recordset;
  console.log(`\nŞubat benzersiz sipariş (SQL ROW_NUMBER dedup): ${subatDeduped.length}`);
  const subatToplamSQL = subatDeduped.reduce((s, r) => s + (Number(r.toplamTutar) || 0), 0);
  console.log(`Şubat toplam tutar (SQL dedup): ${Math.round(subatToplamSQL).toLocaleString('tr-TR')}`);

  // 9) S.ACM.GAN.000024 detay - farklı kalemler mi, duplike mi?
  console.log('\n=== 9) S.ACM.GAN.000024 DETAY (6 satır problem) ===');
  const detailQuery = `
    SELECT ${q(C.SIPARIS_NO)} as SIP, ${q(C.SIPARIS_MALZEME)} as MAL,
           ${q(C.TOPLAM)} as TOPLAM, ${q(C.MIKTAR)} as MIKTAR,
           ${q(C.BIRIM_FIYAT)} as BIRIM_FIYAT, ${q(C.ACIKLAMA)} as ACIKLAMA,
           ${q(C.TESLIM_EVRAK_NO)} as EVRAK
    FROM YLZ_TALEP_SIPARIS
    WHERE ${q(C.SIPARIS_NO)} = 'S.ACM.GAN.000024'
      AND UPPER(${q(C.AMBAR)}) = 'GAZİANTEP'
    ORDER BY ${q(C.TOPLAM)}
  `;
  const detail024 = (await pool.request().query(detailQuery)).recordset;
  console.log(`Toplam satır: ${detail024.length}`);
  for (const r of detail024) {
    console.log(`  MAL=${r.MAL} | MIKTAR=${r.MIKTAR} | BF=${r.BIRIM_FIYAT} | TOPLAM=${r.TOPLAM} | ACIKLAMA=${(r.ACIKLAMA||'').substring(0,40)} | EVRAK=${r.EVRAK||'-'}`);
  }

  // 10) Strateji C ile bilgi kaybı kontrolü
  console.log('\n=== 10) STRATEJİ C BİLGİ KAYBI KONTROLÜ ===');
  const keyCDetails = new Map();
  for (const r of combined) {
    const key = `${r.SIPARIS_NO || ''}|${r.SIPARIS_MALZEME || ''}|${r.MIKTAR || ''}|${r.BIRIM_FIYAT || ''}`;
    if (!keyCDetails.has(key)) keyCDetails.set(key, []);
    keyCDetails.get(key).push(r);
  }
  let lossC = 0;
  for (const [key, rows] of keyCDetails.entries()) {
    if (rows.length > 1) {
      const toplamlar = [...new Set(rows.map(r => String(Number(r.TOPLAM) || 0)))];
      if (toplamlar.length > 1) {
        lossC++;
        if (lossC <= 5) {
          console.log(`  KEY: ${key}`);
          console.log(`    TOPLAM değerleri: ${toplamlar.join(', ')}`);
        }
      }
    }
  }
  console.log(`Bilgi kaybı riski: ${lossC} key`);

  // 11) Teslimat durumu - dedup stratejilerine göre
  console.log('\n=== 11) TESLİMAT DURUMU KARŞILAŞTIRMASI ===');
  function teslimAnaliz(data, label) {
    const sipMap = new Map();
    for (const r of data) {
      if (!r.SIPARIS_NO) continue;
      if (!sipMap.has(r.SIPARIS_NO)) sipMap.set(r.SIPARIS_NO, { fatura: false, evrak: false });
      const s = sipMap.get(r.SIPARIS_NO);
      if (r.FATURAYI_KAYDEDEN && r.FATURAYI_KAYDEDEN !== '') s.fatura = true;
      if (r.TESLIM_EVRAK_NO && r.TESLIM_EVRAK_NO !== '') s.evrak = true;
    }
    let tF = 0, bF = 0, tE = 0, bE = 0;
    for (const s of sipMap.values()) {
      if (s.fatura) tF++; else bF++;
      if (s.evrak) tE++; else bE++;
    }
    console.log(`  ${label}: FATURA[teslim=${tF}, bekleyen=${bF}] EVRAK[teslim=${tE}, bekleyen=${bE}]`);
  }
  teslimAnaliz(combined, 'Dedup yok  ');
  teslimAnaliz(dedupA, 'Strateji A ');
  teslimAnaliz(dedupB, 'Strateji B ');
  teslimAnaliz(dedupC, 'Strateji C ');

  // 12) Fark detayı: dedup A vs C
  console.log('\n=== 12) STRATEJİ A vs C TUTAR FARKI ===');
  function totalByMonth(data) {
    const m = new Map();
    for (const r of data) {
      if (!r.SIPARIS_TARIHI) continue;
      const d = new Date(r.SIPARIS_TARIHI);
      const ay = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      m.set(ay, (m.get(ay) || 0) + (Number(r.TOPLAM) || 0));
    }
    return m;
  }
  const mA = totalByMonth(dedupA);
  const mC = totalByMonth(dedupC);
  for (const ay of [...new Set([...mA.keys(), ...mC.keys()])].sort()) {
    const tA = Math.round(mA.get(ay) || 0);
    const tC = Math.round(mC.get(ay) || 0);
    const fark = tC - tA;
    console.log(`  ${ay}: A=${tA.toLocaleString('tr-TR')} | C=${tC.toLocaleString('tr-TR')} | Fark=${fark.toLocaleString('tr-TR')}`);
  }

  pool.close();
  console.log('\n=== BİTTİ ===');
})().catch(e => { console.error(e); process.exit(1); });
