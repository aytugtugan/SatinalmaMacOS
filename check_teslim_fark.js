/**
 * FATURAYI_KAYDEDEN vs TESLIM_EVRAK_NO farkını analiz eder
 * Dashboard -> FATURAYI_KAYDEDEN kullanıyor
 * DetayliRapor -> TESLIM_EVRAK_NO kullanıyor
 * Bu yüzden 13 sipariş fark çıkıyor
 */

const rawData = require('./GuncelDesktop/ocak_2026_data.json');
const records = rawData.records || [];

// TUR filtresi (boş olmayanlar)
const filteredData = records.filter(r => r.TUR && r.TUR !== '');

console.log(`Toplam kayıt: ${records.length}`);
console.log(`TUR filtreli kayıt: ${filteredData.length}`);
console.log('');

// YÖNTEM 1: FATURAYI_KAYDEDEN ile sayım (Dashboard/Mobile kullanıyor)
const siparisDeliveryFK = new Map();
for (const r of filteredData) {
  if (!r.SIPARIS_NO) continue;
  const hasDelivery = r.FATURAYI_KAYDEDEN && r.FATURAYI_KAYDEDEN !== '';
  if (!siparisDeliveryFK.has(r.SIPARIS_NO) || hasDelivery) {
    siparisDeliveryFK.set(r.SIPARIS_NO, hasDelivery || siparisDeliveryFK.get(r.SIPARIS_NO) || false);
  }
}
const teslimFK = Array.from(siparisDeliveryFK.values()).filter(v => v).length;
const bekleyenFK = Array.from(siparisDeliveryFK.values()).filter(v => !v).length;

// YÖNTEM 2: TESLIM_EVRAK_NO ile sayım (DetayliRapor kullanıyor)
const siparisDeliveryTE = new Map();
for (const r of filteredData) {
  if (!r.SIPARIS_NO) continue;
  const evrakNo = r.TESLIM_EVRAK_NO;
  const delivered = evrakNo && String(evrakNo).trim() !== '';
  const prev = siparisDeliveryTE.get(r.SIPARIS_NO) || { delivered: false };
  siparisDeliveryTE.set(r.SIPARIS_NO, { delivered: prev.delivered || delivered });
}
const teslimTE = Array.from(siparisDeliveryTE.values()).filter(v => v.delivered).length;
const bekleyenTE = Array.from(siparisDeliveryTE.values()).filter(v => !v.delivered).length;

console.log('====== KARŞILAŞTIRMA ======');
console.log(`FATURAYI_KAYDEDEN ile:  Teslim=${teslimFK}, Bekleyen=${bekleyenFK}, Toplam=${teslimFK + bekleyenFK}`);
console.log(`TESLIM_EVRAK_NO ile:   Teslim=${teslimTE}, Bekleyen=${bekleyenTE}, Toplam=${teslimTE + bekleyenTE}`);
console.log(`\nFARK: ${Math.abs(teslimFK - teslimTE)} sipariş\n`);

// Farkı oluşturan siparişleri bul
console.log('====== FARK DETAYI ======');

// FATURAYI_KAYDEDEN ile teslim ama TESLIM_EVRAK_NO ile bekleyen
const fkTeslimTeBekleyen = [];
for (const [sipNo, hasDel] of siparisDeliveryFK.entries()) {
  const teStatus = siparisDeliveryTE.get(sipNo);
  if (hasDel && teStatus && !teStatus.delivered) {
    fkTeslimTeBekleyen.push(sipNo);
  }
}

// TESLIM_EVRAK_NO ile teslim ama FATURAYI_KAYDEDEN ile bekleyen
const teTeslimFkBekleyen = [];
for (const [sipNo, status] of siparisDeliveryTE.entries()) {
  const fkHasDel = siparisDeliveryFK.get(sipNo);
  if (status.delivered && !fkHasDel) {
    teTeslimFkBekleyen.push(sipNo);
  }
}

if (fkTeslimTeBekleyen.length > 0) {
  console.log(`\nFATURAYI_KAYDEDEN=dolu ama TESLIM_EVRAK_NO=boş olan siparişler (${fkTeslimTeBekleyen.length} adet):`);
  fkTeslimTeBekleyen.forEach(sip => {
    const rows = filteredData.filter(r => r.SIPARIS_NO === sip);
    const fk = rows.find(r => r.FATURAYI_KAYDEDEN && r.FATURAYI_KAYDEDEN !== '');
    console.log(`  Sipariş: ${sip} | Firma: ${rows[0]?.CARI_UNVANI || '-'} | FATURAYI_KAYDEDEN: ${fk?.FATURAYI_KAYDEDEN}`);
  });
}

if (teTeslimFkBekleyen.length > 0) {
  console.log(`\nTESLIM_EVRAK_NO=dolu ama FATURAYI_KAYDEDEN=boş olan siparişler (${teTeslimFkBekleyen.length} adet):`);
  teTeslimFkBekleyen.forEach(sip => {
    const rows = filteredData.filter(r => r.SIPARIS_NO === sip);
    const te = rows.find(r => r.TESLIM_EVRAK_NO && String(r.TESLIM_EVRAK_NO).trim() !== '');
    console.log(`  Sipariş: ${sip} | Firma: ${rows[0]?.CARI_UNVANI || '-'} | TESLIM_EVRAK_NO: ${te?.TESLIM_EVRAK_NO}`);
  });
}

if (fkTeslimTeBekleyen.length === 0 && teTeslimFkBekleyen.length === 0) {
  console.log('İki yöntem arasında fark yok!');
}
