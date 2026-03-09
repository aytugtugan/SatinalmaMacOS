const express = require('express');
const cors = require('cors');
const database = require('../database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/health', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.get('/api/ambar-list', async (req, res) => {
  try {
    const result = await database.getAmbarList();
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Ambar list error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/dashboard-stats', async (req, res) => {
  try {
    const ambar = req.query.ambar || 'all';
    const result = await database.getDashboardStats(ambar);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/all-data', async (req, res) => {
  try {
    const result = await database.getAllData();
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('All data error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Sipariş analizi verileri - masaüstü ile birebir aynı
app.get('/api/siparis-analiz', async (req, res) => {
  try {
    const ambar = req.query.ambar || 'all';
    const result = await database.getDashboardStats(ambar);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Sipariş analiz error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Talep analizi verileri
app.get('/api/talep-analiz', async (req, res) => {
  try {
    const ambar = req.query.ambar || 'all';
    const result = await database.getDashboardStats(ambar);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Talep analiz error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Tedarikçi analizi verileri
app.get('/api/tedarikci-analiz', async (req, res) => {
  try {
    const ambar = req.query.ambar || 'all';
    const result = await database.getDashboardStats(ambar);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Tedarikçi analiz error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Finansal analiz verileri
app.get('/api/finansal-analiz', async (req, res) => {
  try {
    const ambar = req.query.ambar || 'all';
    const result = await database.getDashboardStats(ambar);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Finansal analiz error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Detaylı rapor verileri
app.get('/api/detayli-rapor', async (req, res) => {
  try {
    const result = await database.getAllData();
    res.json({ success: true, data: result.data || [] });
  } catch (error) {
    console.error('Detaylı rapor error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API server running on http://0.0.0.0:${PORT}`);
  console.log(`Accessible from mobile at http://<your-local-ip>:${PORT}`);
});
