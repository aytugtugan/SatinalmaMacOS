/**
 * Mobile vs GuncelDesktop - Potansiyel Fark Kaynakları Analizi
 * 
 * Bu dosya, iki platform arasındaki olası farkları analiz eder.
 */

console.log('=' .repeat(80));
console.log('📊 POTANSİYEL FARK KAYNAKLARI ANALİZİ');
console.log('=' .repeat(80));

console.log(`
┌─────────────────────────────────────────────────────────────────────────────┐
│                           VERİ AKIŞ DİYAGRAMI                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  GuncelDesktop (Electron):                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  1. Statik JSON (Ocak 2026)  ─►  389 kayıt                         │    │
│  │     /GuncelDesktop/ocak_2026_data.json                             │    │
│  │                                                                     │    │
│  │  2. MSSQL Sorgusu (Şubat+ 2026)  ─►  ?? kayıt                     │    │
│  │     Server: 10.35.20.15\\SQLSRV                                     │    │
│  │     Database: SNCG                                                 │    │
│  │     Tablo: YLZ_TALEP_SIPARIS                                       │    │
│  │     Filtre: TALEP_TARIHI >= '2026-02-01' OR SIPARIS_TARIHI >=...  │    │
│  │                                                                     │    │
│  │  3. Birleştirme: statik + SQL = Toplam                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  Mobile (React Native):                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  1. Statik JSON (Ocak 2026)  ─►  389 kayıt                         │    │
│  │     /mobile/src/data/ocak_2026_data.json                           │    │
│  │                                                                     │    │
│  │  2. API İsteği (Şubat+ 2026)  ─►  ?? kayıt                        │    │
│  │     URL: http://10.35.20.17:5050/api/Satinalma/veriler             │    │
│  │                                                                     │    │
│  │  3. Birleştirme: Aynı key varsa API verisini kullan               │    │
│  │     Key: TALEP_NO_SIPARIS_NO_MALZEME_HIZMET_KODU_MIKTAR            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         OLASI FARK KAYNAKLARI                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ❶ API BAĞLANTISI                                                           │
│     Mobile uygulama şu anda API'ye bağlanamıyor olabilir.                  │
│     Bu durumda SADECE statik JSON verisi gösterilir (389 kayıt).           │
│                                                                             │
│  ❷ API VERİSİ FARKLI OLABİLİR                                              │
│     http://10.35.20.17:5050 adresi, MSSQL'den farklı veriler               │
│     dönüyor olabilir (farklı veritabanı, farklı sorgu vb.)                 │
│                                                                             │
│  ❸ VERİ SENKRONİZASYONU                                                    │
│     GuncelDesktop MSSQL'e doğrudan bağlanıyor,                             │
│     Mobile ise bir API aracılığıyla bağlanıyor.                            │
│     Bu iki kaynak senkronize olmayabilir.                                  │
│                                                                             │
│  ❹ AMBAR FİLTRESİ                                                          │
│     Kullanıcı farklı ambar filtresi seçmiş olabilir.                       │
│     "Tüm Fabrikalar" yerine tek fabrika seçiliyse veriler farklı görünür.  │
│                                                                             │
│  ❺ CACHE / ESKİ VERİ                                                        │
│     Mobile uygulama önbellekte eski veri tutuyor olabilir.                 │
│     Aşağı çekerek yenileme (pull-to-refresh) yapılmalı.                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         ÇÖZÜM ÖNERİLERİ                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Mobile uygulamada "Aşağı çekerek yenile" yapın                         │
│                                                                             │
│  2. API bağlantı durumunu kontrol edin:                                    │
│     - Ekranın üst kısmında veri kaynağı bilgisi görünüyor olmalı          │
│     - "📊 Ocak (389) + Şubat+ (X) = Y kayıt" şeklinde                      │
│     - Eğer sadece "📦 Statik veri • 389 kayıt" görünüyorsa API bağlı değil │
│                                                                             │
│  3. Aynı ambar filtresi seçili olduğundan emin olun                        │
│     - Her iki platformda "Tüm Fabrikalar" seçili olmalı                    │
│                                                                             │
│  4. Arkadaşınızın gördüğü verilerin ekran görüntüsünü isteyin              │
│     - Hangi değerler farklı?                                               │
│     - Ambar filtresi ne seçili?                                            │
│     - Veri kaynağı bilgisi ne gösteriyor?                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
`);

// JSON dosyalarını karşılaştıralım
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const files = [
  { name: 'GuncelDesktop', path: '/Users/aytugtugan/PROJELER/SatinAlma/GuncelDesktop/ocak_2026_data.json' },
  { name: 'masaustu', path: '/Users/aytugtugan/PROJELER/SatinAlma/masaustu/ocak_2026_data.json' },
  { name: 'Mobile', path: '/Users/aytugtugan/PROJELER/SatinAlma/masaustu/mobile/src/data/ocak_2026_data.json' }
];

console.log('\n📋 JSON DOSYALARI MD5 KONTROLÜ:');
console.log('-'.repeat(60));

for (const file of files) {
  if (fs.existsSync(file.path)) {
    const content = fs.readFileSync(file.path);
    const hash = crypto.createHash('md5').update(content).digest('hex');
    console.log(`${file.name.padEnd(15)}: ${hash}`);
  } else {
    console.log(`${file.name.padEnd(15)}: DOSYA BULUNAMADI`);
  }
}

// Statik veri özeti
const data = JSON.parse(fs.readFileSync(files[0].path, 'utf8'));
const records = (data.records || []).filter(r => r.TUR && r.TUR !== '');
const toplam = records.reduce((sum, r) => sum + (Number(r.TOPLAM) || 0), 0);
const uniqueSiparis = new Set(records.map(r => r.SIPARIS_NO).filter(Boolean)).size;

console.log(`
┌─────────────────────────────────────────────────────────────────────────────┐
│                         STATIK VERİ ÖZETİ (Ocak 2026)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Toplam Kayıt:     ${records.length.toString().padEnd(54)}│
│  Unique Sipariş:   ${uniqueSiparis.toString().padEnd(54)}│
│  Toplam Tutar:     ${toplam.toLocaleString('tr-TR', {minimumFractionDigits: 2}).padEnd(43)} TL │
└─────────────────────────────────────────────────────────────────────────────┘

NOT: Yukarıdaki değerler SADECE statik Ocak 2026 verilerini gösteriyor.
     Şubat ve sonrası veriler API/MSSQL'den geliyor.

ARKADAŞINIZIN GÖRDÜKLERİ:
- Eğer toplam tutar ${toplam.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL ise: API bağlı değil, sadece Ocak verisi
- Eğer toplam tutar bundan farklıysa: Ya API verisi eklenmiş, ya da ambar filtresi seçili
`);
