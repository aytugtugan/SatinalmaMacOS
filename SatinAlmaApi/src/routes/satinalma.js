const express = require('express');
const router = express.Router();
const satinalmaService = require('../services/satinalmaService');

/**
 * @swagger
 * /api/Satinalma/veriler:
 *   get:
 *     tags: [Satinalma]
 *     summary: Tüm satın alma verilerini getir
 *     description: MSSQL veritabanındaki YLZ_TALEP_SIPARIS tablosundan tüm satın alma verilerini döndürür
 *     responses:
 *       200:
 *         description: Başarılı - Satın alma verileri listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   SİPARİŞ NUMARASI:
 *                     type: string
 *                     example: "S.032.000.000123"
 *                   SİPARİŞ TARİHİ:
 *                     type: string
 *                     example: "2026-02-15T00:00:00.000Z"
 *                   TÜR:
 *                     type: string
 *                     example: "Mal"
 *                   AMBAR:
 *                     type: string
 *                   ÜRÜN KODU:
 *                     type: string
 *                   ÜRÜN ADI:
 *                     type: string
 *                   MİKTAR:
 *                     type: number
 *                   BİRİM:
 *                     type: string
 *                   BİRİM FİYAT:
 *                     type: number
 *                   TUTAR:
 *                     type: number
 *                   PARA BİRİMİ:
 *                     type: string
 *                   FİRMA:
 *                     type: string
 *                   TESLİM TARİHİ:
 *                     type: string
 *                     nullable: true
 *       500:
 *         description: Sunucu hatası
 */
router.get('/veriler', async (req, res) => {
  try {
    const data = await satinalmaService.getVeriler();
    console.log(`[Satinalma] /veriler -> ${data.length} kayıt döndürüldü`);
    res.json(data);
  } catch (error) {
    console.error('[Satinalma] /veriler hatası:', error.message);
    res.status(500).json({
      error: 'Veriler alınırken hata oluştu',
      message: error.message,
    });
  }
});

module.exports = router;
