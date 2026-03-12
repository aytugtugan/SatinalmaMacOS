/**
 * Tedarikçi Kategori API — Electron IPC üzerinden API çağrıları
 */

function checkResult(result) {
  if (!result.success) throw new Error(result.error || 'API hatası');
  return result;
}

// ─── CRUD ───────────────────────────────────────────────

export async function getTedarikciKategoriler(params = {}) {
  return checkResult(await window.api.tedarikciKategoriList(params));
}

export async function getTedarikciKategori(id) {
  return checkResult(await window.api.tedarikciKategoriGet(id));
}

export async function createTedarikciKategori(dto) {
  return checkResult(await window.api.tedarikciKategoriCreate(dto));
}

export async function updateTedarikciKategori(id, dto) {
  return checkResult(await window.api.tedarikciKategoriUpdate(id, dto));
}

export async function deleteTedarikciKategori(id) {
  return checkResult(await window.api.tedarikciKategoriDelete(id));
}

// ─── Raporlar ───────────────────────────────────────────

export async function getRaporIstatistik() {
  return checkResult(await window.api.tedarikciKategoriRaporIstatistik());
}

export async function getRaporKategoriOzet(params = {}) {
  return checkResult(await window.api.tedarikciKategoriRaporKategoriOzet(params));
}

export async function getRaporTipDagilimi() {
  return checkResult(await window.api.tedarikciKategoriRaporTipDagilimi());
}

export async function getRaporTedarikciProfil(params = {}) {
  return checkResult(await window.api.tedarikciKategoriRaporTedarikciProfil(params));
}

export async function getRaporEksikBilgi() {
  return checkResult(await window.api.tedarikciKategoriRaporEksikBilgi());
}

export async function getRaporCokluKategori() {
  return checkResult(await window.api.tedarikciKategoriRaporCokluKategori());
}

export async function getRaporKategoriKarsilastirma(params = {}) {
  return checkResult(await window.api.tedarikciKategoriRaporKategoriKarsilastirma(params));
}

export async function getRaporKategoriListesi() {
  return checkResult(await window.api.tedarikciKategoriRaporKategoriListesi());
}
