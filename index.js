require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

// Configuración básica
const app = express();
const PORT = process.env.PORT || 10000;

console.log("-----------------------------------------");
console.log("🚀 MASBARATODEALS - MOTOR DINÁMICO ACTIVADO");
console.log("-----------------------------------------");

// 1. BASE DE DATOS E IMPORTACIONES
let db;
try {
  const { db: database } = require('./src/database/db');
  db = database;
  console.log("✅ Base de datos conectada correctamente.");
} catch (e) {
  console.error("⚠️ Error conectando a DB, usando modo limitado:", e.message);
}

const LinkTransformer = require('./src/utils/LinkTransformer');
const CoreProcessor = require('./src/core/CoreProcessor');

// 2. MIDDLEWARE
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 3. API ENDPOINTS (Restaurados de server.js)
app.get('/api/deals', (req, res) => {
  try {
    if (!db) return res.json([]);
    const deals = db.prepare('SELECT * FROM published_deals ORDER BY posted_at DESC LIMIT 24').all();
    res.json(deals || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/go/:id', (req, res) => {
  try {
    if (!db) return res.status(404).send('DB no disponible');
    const deal = db.prepare('SELECT link FROM published_deals WHERE id = ?').get(req.params.id);
    if (deal) {
      db.prepare('UPDATE published_deals SET clicks = clicks + 1 WHERE id = ?').run(req.params.id);
      return res.redirect(deal.link);
    }
    res.status(404).send('Oferta expirada');
  } catch (e) { res.status(500).send('Error'); }
});

app.post('/api/analyze-deal', async (req, res) => {
  try {
    const { link } = req.body;
    if (!link) return res.status(400).json({ error: 'Falta el enlace' });
    const monetizedLink = await LinkTransformer.transform(link);
    if (!monetizedLink) return res.status(400).json({ error: 'Enlace no válido.' });

    let store = 'Oferta';
    if (monetizedLink.includes('amazon')) store = 'Amazon';
    else if (monetizedLink.includes('walmart')) store = 'Walmart';
    else if (monetizedLink.includes('ebay')) store = 'eBay';

    // Scraping simple
    const axios = require('axios');
    const response = await axios.get(link, { timeout: 5000 }).catch(() => null);
    let title = "Nueva Oferta";
    let img = "https://placehold.co/400x400/18181b/ffffff?text=Oferta+USA";

    if (response) {
      const html = response.data;
      const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/i);
      if (ogTitle) title = ogTitle[1];
      const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/i);
      if (ogImage) img = ogImage[1];
    }

    res.json({ success: true, title, store, img, link: monetizedLink });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/submit-deal', (req, res) => {
  try {
    const { title, price, price_official, link, image, store, category, description } = req.body;
    const uuid = Math.random().toString(36).substring(2, 11);
    const stmt = db.prepare(`
            INSERT INTO published_deals (id, title, price_offer, price_official, link, image, tienda, categoria, description, posted_at, score)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 100)
        `);
    stmt.run(uuid, title, price, price_official || 0, link, image, store, category, description || '');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 4. RUTA MAESTRA (Frontend)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 5. ARRANQUE DEL BOT Y SERVIDOR
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`✅ WEB ONLINE EN PUERTO: ${PORT}`);

  // Iniciar el Bot solo si tenemos el Token
  if (process.env.TELEGRAM_BOT_TOKEN) {
    try {
      console.log("🤖 Iniciando Bot de Telegram y Recolección...");
      CoreProcessor.start();
    } catch (botError) {
      console.error("❌ Error al iniciar el bot:", botError.message);
    }
  } else {
    console.log("⚠️ TELEGRAM_BOT_TOKEN no configurado. El bot no arrancará.");
  }
});
