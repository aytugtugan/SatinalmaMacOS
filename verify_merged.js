const http = require('http');
const ocakData = require('./masaustu/mobile/src/data/ocak_2026_data.json');

// Simulate dataProcessor merge
function normalizeAmbarName(ambar) {
  if (!ambar) return '';
  return ambar.toLocaleUpperCase('tr-TR');
}

const EXCLUDED_FACTORIES = ['TİRE'];

http.get('http://10.35.20.17:5055/api/Satinalma/veriler', {timeout: 10000}, (res) => {
  let d = '';
  res.on('data', c => { d += c; });
  res.on('end', () => {
    const apiRecords = JSON.parse(d);
    
    // Normalize API records (same as dataProcessor)
    const normalizedApi = apiRecords.map(r => ({
      SIPARIS_NO: r['SİPARİŞ NUMARASI'],
      SIPARIS_MALZEME: r['SİPARİŞ MALZEME'],
      MIKTAR: r['MİKTAR'],
      BIRIM_FIYAT: r['BİRİM FİYAT'],
      TOPLAM: r['TOPLAM'],
      AMBAR: r['AMBAR'],
      CARI_UNVANI: r['CARİ ÜNVANI'],
      TUR: r['TÜR'],
      FATURAYI_KAYDEDEN: r['FATURAYI KAYDEDEN'],
    }));
    
    // Merge
    const combined = [...ocakData, ...normalizedApi];
    
    // Dedup + filter
    const seen = new Set();
    const merged = combined.filter(r => {
      if (r.AMBAR && EXCLUDED_FACTORIES.includes(normalizeAmbarName(r.AMBAR))) return false;
      const key = (r.SIPARIS_NO||'') + '|' + (r.SIPARIS_MALZEME||'') + '|' + (r.MIKTAR||'') + '|' + (r.BIRIM_FIYAT||'');
      if (!key || key === '|||') return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    console.log('Ocak kayit:', ocakData.length);
    console.log('API kayit:', apiRecords.length);
    console.log('Merged (dedup + Tire haric):', merged.length);
    
    // Ambar dagilimi
    const ambarMap = {};
    merged.forEach(r => {
      const a = normalizeAmbarName(r.AMBAR) || 'BOS';
      ambarMap[a] = (ambarMap[a] || 0) + 1;
    });
    console.log('\nAmbar dagilimi:');
    Object.entries(ambarMap).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(' ', k, ':', v));
    
    // Cemre Pet Gaziantep toplam
    const cemreGaz = merged.filter(r => {
      const cari = (r.CARI_UNVANI||'').toUpperCase();
      const ambar = normalizeAmbarName(r.AMBAR);
      return cari.includes('CEMRE') && ambar.includes('GAZ');
    });
    let cemreTotal = 0;
    cemreGaz.forEach(r => {
      cemreTotal += (Number(r.TOPLAM) || 0);
      console.log('\nCemre:', r.SIPARIS_NO, '|', r.TOPLAM);
    });
    console.log('\nCemre Pet Gaziantep TOPLAM:', cemreTotal);
    console.log('Beklenen: 2926292');
    console.log('Fark:', Math.abs(cemreTotal - 2926292));
    
    // 082 ve 083
    const r082 = merged.filter(r => (r.SIPARIS_NO||'').includes('000082'));
    const r083 = merged.filter(r => (r.SIPARIS_NO||'').includes('000083'));
    console.log('\n082 kayit:', r082.length);
    console.log('083 kayit:', r083.length);
    
    // Benzersiz siparis sayisi
    const siparisSet = new Set(merged.map(r => r.SIPARIS_NO).filter(Boolean));
    console.log('\nBenzersiz siparis:', siparisSet.size);
    
    // Toplam tutar
    const toplamTutar = merged.reduce((sum, r) => sum + (Number(r.TOPLAM) || 0), 0);
    console.log('Toplam tutar:', toplamTutar.toFixed(2));
    
    // Duplicate check
    const dupCheck = {};
    merged.forEach(r => {
      const key = (r.SIPARIS_NO||'') + '|' + (r.SIPARIS_MALZEME||'') + '|' + (r.MIKTAR||'') + '|' + (r.BIRIM_FIYAT||'');
      dupCheck[key] = (dupCheck[key] || 0) + 1;
    });
    const dups = Object.entries(dupCheck).filter(([k,v]) => v > 1);
    console.log('\nDuplicate key:', dups.length);
    if (dups.length > 0) {
      dups.forEach(([k,v]) => console.log('  DUP:', k, 'x' + v));
    }
  });
}).on('error', e => console.error(e.message));
