const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const swaggerSpec = require('./swagger');
const config = require('./config');
const { closeConnection } = require('./db');

const app = express();

// ─── Middleware ──────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));
app.use(morgan('short'));

// ─── Routes ─────────────────────────────────────────────

// Swagger static dosyaları (CSS, JS) - swagger-ui-dist
// pkg EXE modunda: exe'nin yanındaki swagger-ui klasörü
// Geliştirme modunda: node_modules/swagger-ui-dist
const { getAppRoot } = require('./config');
let swaggerUiDistPath;
if (process.pkg) {
  swaggerUiDistPath = path.join(path.dirname(process.execPath), 'swagger-ui');
} else {
  swaggerUiDistPath = path.dirname(require.resolve('swagger-ui-dist/package.json'));
}
app.use('/swagger-assets', express.static(swaggerUiDistPath));

// Swagger JSON endpoint
app.get('/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Swagger UI - .NET Swagger ile birebir aynı görünüm
app.get('/swagger', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!-- HTML for static distribution bundle build -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Swagger UI</title>
    <link rel="stylesheet" type="text/css" href="/swagger-assets/swagger-ui.css">
    <link rel="icon" type="image/png" href="/swagger-assets/favicon-32x32.png" sizes="32x32" />
    <link rel="icon" type="image/png" href="/swagger-assets/favicon-16x16.png" sizes="16x16" />
    <style>
        html {
            box-sizing: border-box;
            overflow: -moz-scrollbars-vertical;
            overflow-y: scroll;
        }
        *, *:before, *:after {
            box-sizing: inherit;
        }
        body {
            margin: 0;
            background: #fafafa;
        }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="/swagger-assets/swagger-ui-bundle.js"></script>
    <script src="/swagger-assets/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function () {
            var configObject = {
                urls: [{url: "/swagger.json", name: "SatinAlma API v1"}],
                deepLinking: false,
                persistAuthorization: false,
                displayOperationId: false,
                defaultModelsExpandDepth: 1,
                defaultModelExpandDepth: 1,
                defaultModelRendering: "example",
                displayRequestDuration: false,
                docExpansion: "list",
                showExtensions: false,
                showCommonExtensions: false,
                supportedSubmitMethods: ["get","put","post","delete","options","head","patch","trace"],
                tryItOutEnabled: false
            };

            configObject.validatorUrl = null;
            configObject.dom_id = "#swagger-ui";
            configObject.presets = [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset];
            configObject.layout = "StandaloneLayout";

            const ui = SwaggerUIBundle(configObject);
            window.ui = ui;
        };
    </script>
</body>
</html>`);
});

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: API sağlık kontrolü
 *     responses:
 *       200:
 *         description: API çalışıyor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 service:
 *                   type: string
 *                   example: SatinAlmaApi
 *                 timestamp:
 *                   type: string
 *                   example: "2026-02-23T13:00:00.000Z"
 */
// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'SatinAlmaApi',
    timestamp: new Date().toISOString(),
  });
});

// Satınalma endpoint'leri
const satinalmaRoutes = require('./routes/satinalma');
app.use('/api/Satinalma', satinalmaRoutes);

// Dosya yükleme/indirme endpoint'leri
const dosyaRoutes = require('./routes/dosya');
app.use('/api/Dosya', dosyaRoutes);

// ─── 404 handler ────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint bulunamadı', path: req.originalUrl });
});

// ─── Error handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Server] Hata:', err.message);
  res.status(500).json({ error: 'Sunucu hatası', message: err.message });
});

// ─── Start ──────────────────────────────────────────────
const { port, host } = config.server;

app.listen(port, host, () => {
  console.log(`\n🚀 SatinAlmaApi çalışıyor: http://${host}:${port}`);
  console.log(`   Health: http://${host}:${port}/health`);
  console.log(`   Veriler: http://${host}:${port}/api/Satinalma/veriler\n`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[Server] Kapatılıyor...');
  await closeConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeConnection();
  process.exit(0);
});
