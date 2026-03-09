# SatinAlmaApi

Satın Alma Rapor uygulaması için REST API servisi.  
MSSQL veritabanından (`10.35.20.15\SQLSRV` / `SNCG`) satın alma verilerini sunar.

## Kurulum

```bash
cd SatinAlmaApi
npm install
```

## Çalıştırma

```bash
# Production
npm start

# Development (auto-reload)
npm run dev
```

Varsayılan port: **5050** (`.env` veya ortam değişkenleri ile değiştirilebilir)

## Endpoint'ler

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/health` | Servis durumu |
| GET | `/api/Satinalma/veriler` | Tüm satın alma verileri |

## Ortam Değişkenleri

| Değişken | Varsayılan | Açıklama |
|----------|-----------|----------|
| `PORT` | `5050` | API port numarası |
| `HOST` | `0.0.0.0` | Dinlenecek adres |
| `DB_SERVER` | `10.35.20.15\SQLSRV` | MSSQL sunucu adresi |
| `DB_NAME` | `SNCG` | Veritabanı adı |
| `DB_USER` | `ozgur.copkur` | DB kullanıcı adı |
| `DB_PASS` | `Oz2025!!` | DB şifresi |

## Proje Yapısı

```
SatinAlmaApi/
├── package.json
├── README.md
└── src/
    ├── server.js          # Express app & başlatma
    ├── config.js          # Konfigürasyon
    ├── db.js              # MSSQL bağlantı yönetimi
    ├── routes/
    │   └── satinalma.js   # /api/Satinalma/* route'ları
    └── services/
        └── satinalmaService.js  # Veritabanı sorguları
```

## Yeni Endpoint Ekleme

1. `src/services/` altına yeni service dosyası oluştur
2. `src/routes/` altına yeni route dosyası oluştur
3. `src/server.js` içinde route'u kaydet:

```js
const yeniRoutes = require('./routes/yeniRoute');
app.use('/api/YeniModul', yeniRoutes);
```
