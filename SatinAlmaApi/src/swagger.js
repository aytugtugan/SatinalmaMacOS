// Statik Swagger spec - swagger-jsdoc yerine doğrudan tanımlı
// (pkg EXE içinde glob tabanlı dosya tarama çalışmadığı için)
const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'SatinAlma API',
    version: '1.0.0',
    description: 'Satın Alma Rapor REST API - MSSQL veritabanından satın alma verilerini sunan ve dosya yönetimi sağlayan API',
    contact: { name: 'Aytug Tugan' },
  },
  servers: [
    { url: 'http://10.35.20.17:5055', description: 'Windows Server (Production)' },
    { url: 'http://10.35.55.3:5055', description: 'Mac (Development)' },
  ],
  tags: [
    { name: 'Health', description: 'Sağlık kontrolü' },
    { name: 'Satinalma', description: 'Satın alma verileri' },
    { name: 'Dosya', description: 'Dosya yükleme, indirme ve yönetimi' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'API sağlık kontrolü',
        responses: {
          200: {
            description: 'API çalışıyor',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    service: { type: 'string', example: 'SatinAlmaApi' },
                    timestamp: { type: 'string', example: '2026-02-23T13:00:00.000Z' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/Satinalma/veriler': {
      get: {
        tags: ['Satinalma'],
        summary: 'Tüm satın alma verilerini getir',
        description: 'MSSQL veritabanındaki YLZ_TALEP_SIPARIS tablosundan tüm satın alma verilerini döndürür',
        responses: {
          200: {
            description: 'Başarılı - Satın alma verileri listesi',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      'SİPARİŞ NUMARASI': { type: 'string', example: 'S.032.000.000123' },
                      'SİPARİŞ TARİHİ': { type: 'string', example: '2026-02-15T00:00:00.000Z' },
                      'TÜR': { type: 'string', example: 'Mal' },
                      'AMBAR': { type: 'string' },
                      'ÜRÜN KODU': { type: 'string' },
                      'ÜRÜN ADI': { type: 'string' },
                      'MİKTAR': { type: 'number' },
                      'BİRİM': { type: 'string' },
                      'BİRİM FİYAT': { type: 'number' },
                      'TUTAR': { type: 'number' },
                      'PARA BİRİMİ': { type: 'string' },
                      'FİRMA': { type: 'string' },
                      'TESLİM TARİHİ': { type: 'string', nullable: true },
                    },
                  },
                },
              },
            },
          },
          500: { description: 'Sunucu hatası' },
        },
      },
    },
    '/api/Dosya/upload': {
      post: {
        tags: ['Dosya'],
        summary: 'Sipariş numarasına dosya yükle',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file', 'siparisNo'],
                properties: {
                  file: { type: 'string', format: 'binary', description: 'Yüklenecek dosya (maks 25MB)' },
                  siparisNo: { type: 'string', example: 'S.032.000.000123' },
                  aciklama: { type: 'string' },
                  yukleyenKullanici: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Dosya başarıyla yüklendi',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                        siparisNo: { type: 'string' },
                        dosyaAdi: { type: 'string' },
                        format: { type: 'string' },
                        boyut: { type: 'integer' },
                        tarih: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Dosya veya sipariş numarası eksik' },
          500: { description: 'Sunucu hatası' },
        },
      },
    },
    '/api/Dosya/upload-multi': {
      post: {
        tags: ['Dosya'],
        summary: 'Birden fazla dosya yükle (maks 10)',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['files', 'siparisNo'],
                properties: {
                  files: { type: 'array', items: { type: 'string', format: 'binary' } },
                  siparisNo: { type: 'string' },
                  aciklama: { type: 'string' },
                  yukleyenKullanici: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Dosyalar yüklendi' },
          400: { description: 'Dosya veya sipariş numarası eksik' },
        },
      },
    },
    '/api/Dosya/siparis/{siparisNo}': {
      get: {
        tags: ['Dosya'],
        summary: 'Sipariş numarasına ait dosyaları listele',
        parameters: [
          { in: 'path', name: 'siparisNo', required: true, schema: { type: 'string' }, example: 'S.032.000.000123' },
        ],
        responses: {
          200: {
            description: 'Dosya listesi',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'integer' },
                          siparisNo: { type: 'string' },
                          dosyaAdi: { type: 'string' },
                          format: { type: 'string' },
                          boyut: { type: 'integer' },
                          tarih: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/Dosya/sayilar': {
      post: {
        tags: ['Dosya'],
        summary: 'Birden fazla siparişin dosya sayılarını getir',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  siparisNolar: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['S.032.000.000123', 'S.032.000.000124'],
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Sipariş başına dosya sayıları',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'object', additionalProperties: { type: 'integer' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/Dosya/download/{id}': {
      get: {
        tags: ['Dosya'],
        summary: 'Dosyayı indir',
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'integer' }, description: 'Dosya ID' },
        ],
        responses: {
          200: {
            description: 'Dosya içeriği',
            content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
          },
          404: { description: 'Dosya bulunamadı' },
        },
      },
    },
    '/api/Dosya/goruntule/{id}': {
      get: {
        tags: ['Dosya'],
        summary: 'Dosyayı tarayıcıda görüntüle (resim, PDF)',
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'integer' }, description: 'Dosya ID' },
        ],
        responses: {
          200: { description: 'Dosya inline olarak döner' },
          404: { description: 'Dosya bulunamadı' },
        },
      },
    },
    '/api/Dosya/{id}': {
      delete: {
        tags: ['Dosya'],
        summary: 'Dosyayı sil (DB + dosya sistemi)',
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'integer' }, description: 'Silinecek dosya ID' },
        ],
        responses: {
          200: {
            description: 'Dosya silindi',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
          404: { description: 'Dosya bulunamadı' },
        },
      },
    },
  },
  components: {},
};

module.exports = swaggerSpec;
