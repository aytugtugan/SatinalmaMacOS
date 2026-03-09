const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const dosyaService = require('../services/dosyaService');
const { getAppRoot } = require('../config');

// Upload dizini - pkg EXE modunda exe'nin yanındaki uploads klasörü kullanılır
const UPLOAD_DIR = path.join(getAppRoot(), 'uploads', 'satinalma');

// Dizinin var olduğundan emin ol
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log(`[Dosya] Upload dizini oluşturuldu: ${UPLOAD_DIR}`);
}

// Multer ayarları
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Sipariş numarasına göre alt klasör oluştur
    const siparisNo = req.body.siparisNo || 'unknown';
    const safeDir = siparisNo.replace(/[^a-zA-Z0-9._-]/g, '_');
    const dir = path.join(UPLOAD_DIR, safeDir);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Benzersiz dosya adı: timestamp_originalname
    const uniqueName = `${Date.now()}_${file.originalname}`;
    cb(null, uniqueName);
  },
});

// Dosya filtresi - kabul edilen formatlar
const ALLOWED_TYPES = [
  // Görseller
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
  // Dökümanlar
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Diğer
  'text/plain',
  'text/csv',
  'application/zip',
  'application/x-rar-compressed',
];

const fileFilter = (req, file, cb) => {
  // React Native bazen farklı MIME type gönderir (örn. application/octet-stream)
  // Dosya uzantısına göre de kontrol et
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.txt', '.csv', '.zip', '.rar',
  ];
  if (ALLOWED_TYPES.includes(file.mimetype) || allowedExtensions.includes(ext) || file.mimetype === 'application/octet-stream') {
    cb(null, true);
  } else {
    cb(new Error(`Desteklenmeyen dosya formatı: ${file.mimetype} (${ext})`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB maks
  },
});

/**
 * @swagger
 * /api/Dosya/upload:
 *   post:
 *     tags: [Dosya]
 *     summary: Sipariş numarasına dosya yükle
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, siparisNo]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Yüklenecek dosya (maks 25MB)
 *               siparisNo:
 *                 type: string
 *                 example: "S.032.000.000123"
 *               aciklama:
 *                 type: string
 *               yukleyenKullanici:
 *                 type: string
 *     responses:
 *       200:
 *         description: Dosya başarıyla yüklendi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     siparisNo:
 *                       type: string
 *                     dosyaAdi:
 *                       type: string
 *                     format:
 *                       type: string
 *                     boyut:
 *                       type: integer
 *                     tarih:
 *                       type: string
 *       400:
 *         description: Dosya veya sipariş numarası eksik
 *       500:
 *         description: Sunucu hatası
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Dosya seçilmedi' });
    }

    const { siparisNo, aciklama, yukleyenKullanici } = req.body;
    if (!siparisNo) {
      // Dosyayı temizle
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, error: 'Sipariş numarası gerekli' });
    }

    // Dosya formatını belirle
    const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
    const formatMap = {
      jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', bmp: 'image',
      pdf: 'pdf',
      doc: 'word', docx: 'word',
      xls: 'excel', xlsx: 'excel',
      ppt: 'powerpoint', pptx: 'powerpoint',
      txt: 'text', csv: 'text',
      zip: 'archive', rar: 'archive',
    };

    const format = formatMap[ext] || 'other';

    // DB'ye relative path kaydet (uploads/satinalma/...)
    // Böylece farklı ortamlarda (dev/EXE) path uyumsuzluğu olmaz
    const appRoot = getAppRoot();
    let relativePath = req.file.path;
    if (req.file.path.startsWith(appRoot)) {
      relativePath = req.file.path.substring(appRoot.length);
      // Baştaki path separator'ı kaldır
      if (relativePath.startsWith(path.sep) || relativePath.startsWith('/')) {
        relativePath = relativePath.substring(1);
      }
    }

    const kayit = await dosyaService.dosyaKaydet({
      siparisNo,
      dosyaAdi: req.file.filename,
      orijinalDosyaAdi: req.file.originalname,
      format,
      boyut: req.file.size,
      filePath: relativePath,
      aciklama,
      yukleyenKullanici,
    });

    console.log(`[Dosya] Yüklendi: ${req.file.originalname} -> ${siparisNo}`);
    res.json({
      success: true,
      data: {
        id: kayit.Id,
        siparisNo: kayit.SiparisNo,
        dosyaAdi: kayit.OrijinalDosyaAdi,
        format: kayit.Format,
        boyut: kayit.Boyut,
        tarih: kayit.Tarih,
      },
    });
  } catch (error) {
    console.error('[Dosya] Upload hatası:', error.message);
    // Yüklenen dosyayı temizle
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/Dosya/upload-multi:
 *   post:
 *     tags: [Dosya]
 *     summary: Birden fazla dosya yükle (maks 10)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [files, siparisNo]
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               siparisNo:
 *                 type: string
 *               aciklama:
 *                 type: string
 *               yukleyenKullanici:
 *                 type: string
 *     responses:
 *       200:
 *         description: Dosyalar yüklendi
 *       400:
 *         description: Dosya veya sipariş numarası eksik
 */
router.post('/upload-multi', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'Dosya seçilmedi' });
    }

    const { siparisNo, aciklama, yukleyenKullanici } = req.body;
    if (!siparisNo) {
      req.files.forEach(f => fs.unlinkSync(f.path));
      return res.status(400).json({ success: false, error: 'Sipariş numarası gerekli' });
    }

    const ext2format = (ext) => {
      const map = {
        jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', bmp: 'image',
        pdf: 'pdf', doc: 'word', docx: 'word', xls: 'excel', xlsx: 'excel',
        ppt: 'powerpoint', pptx: 'powerpoint', txt: 'text', csv: 'text',
        zip: 'archive', rar: 'archive',
      };
      return map[ext] || 'other';
    };

    const results = [];
    const appRoot = getAppRoot();
    for (const file of req.files) {
      const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
      // Relative path hesapla
      let relativePath = file.path;
      if (file.path.startsWith(appRoot)) {
        relativePath = file.path.substring(appRoot.length);
        if (relativePath.startsWith(path.sep) || relativePath.startsWith('/')) {
          relativePath = relativePath.substring(1);
        }
      }
      const kayit = await dosyaService.dosyaKaydet({
        siparisNo,
        dosyaAdi: file.filename,
        orijinalDosyaAdi: file.originalname,
        format: ext2format(ext),
        boyut: file.size,
        filePath: relativePath,
        aciklama,
        yukleyenKullanici,
      });
      results.push({
        id: kayit.Id,
        dosyaAdi: kayit.OrijinalDosyaAdi,
        format: kayit.Format,
        boyut: kayit.Boyut,
      });
    }

    console.log(`[Dosya] ${results.length} dosya yüklendi -> ${siparisNo}`);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('[Dosya] Multi-upload hatası:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/Dosya/siparis/{siparisNo}:
 *   get:
 *     tags: [Dosya]
 *     summary: Sipariş numarasına ait dosyaları listele
 *     parameters:
 *       - in: path
 *         name: siparisNo
 *         required: true
 *         schema:
 *           type: string
 *         example: "S.032.000.000123"
 *     responses:
 *       200:
 *         description: Dosya listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       siparisNo:
 *                         type: string
 *                       dosyaAdi:
 *                         type: string
 *                       format:
 *                         type: string
 *                       boyut:
 *                         type: integer
 *                       tarih:
 *                         type: string
 */
router.get('/siparis/:siparisNo', async (req, res) => {
  try {
    const data = await dosyaService.getDosyalar(req.params.siparisNo);
    const mapped = data.map(d => ({
      id: d.Id,
      siparisNo: d.SiparisNo,
      dosyaAdi: d.OrijinalDosyaAdi,
      format: d.Format,
      boyut: d.Boyut,
      aciklama: d.Aciklama,
      yukleyenKullanici: d.YukleyenKullanici,
      tarih: d.Tarih,
    }));
    res.json({ success: true, data: mapped });
  } catch (error) {
    console.error('[Dosya] Liste hatası:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/Dosya/sayilar:
 *   post:
 *     tags: [Dosya]
 *     summary: Birden fazla siparişin dosya sayılarını getir
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               siparisNolar:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["S.032.000.000123", "S.032.000.000124"]
 *     responses:
 *       200:
 *         description: Sipariş başına dosya sayıları
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   additionalProperties:
 *                     type: integer
 */
router.post('/sayilar', async (req, res) => {
  try {
    const { siparisNolar } = req.body;
    if (!siparisNolar || !Array.isArray(siparisNolar)) {
      return res.status(400).json({ success: false, error: 'siparisNolar array gerekli' });
    }
    const data = await dosyaService.getDosyaSayilari(siparisNolar);
    res.json({ success: true, data });
  } catch (error) {
    console.error('[Dosya] Sayılar hatası:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/Dosya/download/{id}:
 *   get:
 *     tags: [Dosya]
 *     summary: Dosyayı indir
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Dosya ID
 *     responses:
 *       200:
 *         description: Dosya içeriği
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Dosya bulunamadı
 */
router.get('/download/:id', async (req, res) => {
  try {
    const dosya = await dosyaService.getDosyaById(parseInt(req.params.id));
    if (!dosya) {
      return res.status(404).json({ success: false, error: 'Dosya bulunamadı' });
    }

    if (!fs.existsSync(dosya.ResolvedPath)) {
      return res.status(404).json({ success: false, error: 'Dosya sunucuda bulunamadı' });
    }

    res.download(dosya.ResolvedPath, dosya.OrijinalDosyaAdi);
  } catch (error) {
    console.error('[Dosya] Download hatası:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/Dosya/goruntule/{id}:
 *   get:
 *     tags: [Dosya]
 *     summary: Dosyayı tarayıcıda görüntüle (resim, PDF)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Dosya ID
 *     responses:
 *       200:
 *         description: Dosya inline olarak döner
 *       404:
 *         description: Dosya bulunamadı
 */
router.get('/goruntule/:id', async (req, res) => {
  try {
    const dosya = await dosyaService.getDosyaById(parseInt(req.params.id));
    if (!dosya) {
      return res.status(404).json({ success: false, error: 'Dosya bulunamadı' });
    }

    if (!fs.existsSync(dosya.ResolvedPath)) {
      return res.status(404).json({ success: false, error: 'Dosya sunucuda bulunamadı' });
    }

    // MIME type belirle
    const ext = path.extname(dosya.OrijinalDosyaAdi).toLowerCase();
    const mimeMap = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
      '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain', '.csv': 'text/csv',
    };

    const contentType = mimeMap[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(dosya.OrijinalDosyaAdi)}"`);
    fs.createReadStream(dosya.ResolvedPath).pipe(res);
  } catch (error) {
    console.error('[Dosya] Görüntüleme hatası:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/Dosya/{id}:
 *   delete:
 *     tags: [Dosya]
 *     summary: Dosyayı sil (DB + dosya sistemi)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Silinecek dosya ID
 *     responses:
 *       200:
 *         description: Dosya silindi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: Dosya bulunamadı
 */
router.delete('/:id', async (req, res) => {
  try {
    const silinen = await dosyaService.dosyaSil(parseInt(req.params.id));
    if (!silinen) {
      return res.status(404).json({ success: false, error: 'Dosya bulunamadı' });
    }
    console.log(`[Dosya] Silindi: ${silinen.OrijinalDosyaAdi} (ID: ${silinen.Id})`);
    res.json({ success: true, message: 'Dosya silindi' });
  } catch (error) {
    console.error('[Dosya] Silme hatası:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Multer hata yakalama
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: 'Dosya boyutu çok büyük (maks 25MB)' });
    }
    return res.status(400).json({ success: false, error: err.message });
  }
  if (err.message && err.message.includes('Desteklenmeyen dosya formatı')) {
    return res.status(400).json({ success: false, error: err.message });
  }
  next(err);
});

module.exports = router;
