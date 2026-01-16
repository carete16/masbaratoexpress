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

// Middleware de Autenticación
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminMasbarato2026!'; // CLAVE MAESTRA
const authMiddleware = (req, res, next) => {
  const pwd = req.headers['x-admin-password'];
  if (pwd !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Acceso denegado. Contraseña incorrecta.' });
  next();
};

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) res.json({ success: true, token: 'session_ok' });
  else res.status(401).json({ error: 'Contraseña incorrecta' });
});

app.post('/api/analyze-deal', async (req, res) => {
  try {
    const { link } = req.body;
    if (!link) return res.status(400).json({ error: 'Falta el enlace' });
    const monetizedLink = await LinkTransformer.transform(link);

    // Auto-detect store
    let store = 'Oferta';
    if (/amazon/i.test(link)) store = 'Amazon';
    else if (/walmart/i.test(link)) store = 'Walmart';
    else if (/ebay/i.test(link)) store = 'eBay';
    else if (/bestbuy/i.test(link)) store = 'Best Buy';
    else if (/target/i.test(link)) store = 'Target';
    else if (/nike/i.test(link)) store = 'Nike';

    // Scraping simple
    const axios = require('axios');
    const response = await axios.get(link, {
      timeout: 5000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
    }).catch(() => null);

    let title = "";
    let img = "";
    let price = "";

    if (response) {
      const html = response.data;
      const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/i);
      if (ogTitle) title = ogTitle[1];

      const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/i);
      if (ogImage) img = ogImage[1];

      // Intentar extraer precio (muy básico)
      const priceMatch = html.match(/\$[\d,]+\.\d{2}/);
      if (priceMatch) price = parseFloat(priceMatch[0].replace('$', '').replace(',', ''));
    }

    res.json({ success: true, title, price, store, img, link: monetizedLink || link });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ENDPOINTS PROTEGIDOS ---

app.post('/api/submit-deal', authMiddleware, async (req, res) => {
  try {
    let { title, price, price_official, link, image, store, category, description } = req.body;

    // 💰 MONETIZACIÓN FORZOSA AUTOMÁTICA 💰
    // Antes de guardar, transformamos el link para asegurar que lleve el código de afiliado.
    const originalLink = link;
    link = await LinkTransformer.transform(link);
    console.log(`[MONETIZACIÓN] Manual: ${originalLink} -> ${link}`);

    if (!link) return res.status(400).json({ error: 'Enlace no válido o no monetizable' });

    const uuid = Math.random().toString(36).substring(2, 11);
    const stmt = db.prepare(`
            INSERT INTO published_deals (id, title, price_offer, price_official, link, image, tienda, categoria, description, posted_at, score)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 100)
        `);
    stmt.run(uuid, title, price, price_official || 0, link, image, store, category, description || '');

    // Notificar al canal Telegram
    try {
      const Telegram = require('./src/notifiers/TelegramNotifier');
      Telegram.sendManualDeal({ title, price_offer: price, price_official, link, image, description });
    } catch (e) { console.error("Error notificando TG:", e); }

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/update-deal', authMiddleware, async (req, res) => {
  try {
    let { id, title, price, price_official, link, image, store, category, description } = req.body;

    // 💰 MONETIZACIÓN FORZOSA EN EDICIÓN TAMBIÉN 💰
    link = await LinkTransformer.transform(link);

    const stmt = db.prepare(`
            UPDATE published_deals 
            SET title=?, price_offer=?, price_official=?, link=?, image=?, tienda=?, categoria=?, description=?
            WHERE id=?
        `);
    stmt.run(title, price, price_official || 0, link, image, store, category, description || '', id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/delete-deal', authMiddleware, (req, res) => {
  try {
    const { id } = req.body;
    db.prepare('DELETE FROM published_deals WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 4. RUTAS DEL FRONTEND
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Wildcard para SPA (Debe ser la última ruta)
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
