/**
 * hale API — Electron IPC üzerinden API çağrıları
 * preload.js'deki window.api.ihale* fonksiyonlarını kullanır
 */

function checkResult(result) {
  if (!result.success) throw new Error(result.error || 'API hatası');
  return result;
}

// ─── CRUD ───────────────────────────────────────────────

export async function getIhaleler(params = {}) {
  return checkResult(await window.api.ihaleList(params));
}

export async function getIhale(siraNo) {
  return checkResult(await window.api.ihaleGet(siraNo));
}

export async function createIhale(dto) {
  return checkResult(await window.api.ihaleCreate(dto));
}

export async function updateIhale(siraNo, dto) {
  return checkResult(await window.api.ihaleUpdate(siraNo, dto));
}

export async function deleteIhale(siraNo) {
  return checkResult(await window.api.ihaleDelete(siraNo));
}

export async function getLokasyonlar() {
  return checkResult(await window.api.ihaleLokasyonlar());
}

// ─── Raporlar ───────────────────────────────────────────

export async function getRaporOzet(params = {}) {
  return checkResult(await window.api.ihaleRaporOzet(params));
}

export async function getRaporLokasyon(params = {}) {
  return checkResult(await window.api.ihaleRaporLokasyon(params));
}

export async function getRaporTedarikci(params = {}) {
  return checkResult(await window.api.ihaleRaporTedarikci(params));
}

export async function getRaporRekabet(params = {}) {
  return checkResult(await window.api.ihaleRaporRekabet(params));
}

export async function getRaporTrend(params = {}) {
  return checkResult(await window.api.ihaleRaporTrend(params));
}

export async function getRaporTasarruf(params = {}) {
  return checkResult(await window.api.ihaleRaporTasarruf(params));
}
