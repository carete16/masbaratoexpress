const express = require('express');
const axios = require('axios');
const path = require('path');
const { db } = require('./src/database/db');
const LinkTransformer = require('./src/utils/LinkTransformer');
const CoreProcessor = require('./src/core/CoreProcessor');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static('public')); // Servir estáticos principal
app.use(express.static(path.join(__dirname, 'src/web/public'))); // Fallback
app.use(express.json());

// --- MIDDLEWARE DE ADMIN ---
// --- MIDDLEWARE DE ADMIN ---
const authMiddleware = (req, res, next) => {
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  const headerPass = req.headers['x-admin-password'];

  // Aceptamos la pass del entorno O la maestra de recuperación
  if (headerPass === adminPass || headerPass === 'Masbarato2026') {
    next();
  } else {
    res.status(403).json({ error: 'Acceso denegado' });
  }
};

// 1. OBTENER OFERTAS (PÚBLICO)
app.get('/api/deals', (req, res) => {
  try {
    // Solo últimas 100 ofertas de la última semana
    const deals = db.prepare(`
            SELECT * FROM published_deals 
            WHERE posted_at > datetime('now', '-7 days') 
            ORDER BY posted_at DESC 
            LIMIT 100
        `).all();
    res.json(deals);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 2. REDIRECTOR INTELIGENTE (PÚBLICO)
app.get('/go/:id', (req, res) => {
  try {
    const deal = db.prepare('SELECT link FROM published_deals WHERE id = ?').get(req.params.id);
    if (deal) {
      db.prepare("UPDATE published_deals SET clicks = clicks + 1 WHERE id = ?").run(req.params.id);
      res.redirect(deal.link);
    } else {
      res.redirect('/');
    }
  } catch (e) { res.redirect('/'); }
});

// 3. ANALIZADOR DE LINKS (ADMIN)
app.post('/api/analyze-deal', async (req, res) => {
  try {
    let { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL requerida' });

    // 💰 PRE-MONETIZACIÓN (Opcional, para ver link final)
    const monetizedLink = await LinkTransformer.transform(url);
    const link = monetizedLink || url;

    // Detectar tienda
    let store = 'Otros';
    if (/amazon/i.test(link)) store = 'Amazon';
    else if (/ebay/i.test(link)) store = 'eBay';
    else if (/walmart/i.test(link)) store = 'Walmart';
    else if (/bestbuy/i.test(link)) store = 'Best Buy';

    let title = "";
    let img = "";
    let price = "";

    // --- ESTRATEGIA AMAZON (Anti-Bloqueo) ---
    const amazonAsinMatch = link.match(/\/([A-Z0-9]{10})(?:[/?]|$)/i);
    if (store === 'Amazon' && amazonAsinMatch) {
      const asin = amazonAsinMatch[1];
      // Usar imagen oficial de API de Widgets (100% fiable)
      img = `https://ws-na.amazon-adsystem.com/widgets/q?_encoding=UTF8&Format=_SL500_&ASIN=${asin}&MarketPlace=US`;
      title = `Producto Amazon (ASIN: ${asin})`; // Fallback title
    }

    // Scraping Genérico (o para obtener título real de Amazon si deja)
    try {
      const response = await axios.get(link, {
        timeout: 4000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        }
      });

      if (response && response.data) {
        const html = response.data;

        // Título
        const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/i);
        if (ogTitle) title = ogTitle[1].replace('Amazon.com: ', '').substring(0, 100);
        else {
          const titleTag = html.match(/<title>([^<]*)<\/title>/i);
          if (titleTag) title = titleTag[1].replace('Amazon.com: ', '').substring(0, 100);
        }

        // Imagen (Si no tenemos la de Amazon Widget)
        if (!img) {
          const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/i);
          if (ogImage) img = ogImage[1];
        }

        // Precio
        const priceMatch = html.match(/(\$[\d,]+\.\d{2})/);
        if (priceMatch) price = parseFloat(priceMatch[1].replace('$', '').replace(',', ''));
      }
    } catch (e) {
      console.log("Scraping simple falló (normal en Amazon), usando datos base.");
    }

    res.json({ success: true, title, price, store, img, link });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ENDPOINTS PROTEGIDOS ---

app.post('/api/submit-deal', authMiddleware, async (req, res) => {
  try {
    let { title, price, price_official, link, image, store, category, description, coupon } = req.body;

    // 💰 MONETIZACIÓN FORZOSA AUTOMÁTICA 💰
    // Antes de guardar, transformamos el link para asegurar que lleve el código de afiliado.
    const originalLink = link;
    try {
      link = await LinkTransformer.transform(link);
      console.log(`[MONETIZACIÓN] Manual: ${originalLink} -> ${link}`);
    } catch (errTransform) {
      console.error("Error transformando link:", errTransform);
      link = null;
    }

    // SAFETY NET: Si falla la monetización, usamos el link original (Admin manda)
    if (!link) {
      console.warn(`⚠️ Fallo monetización para ${originalLink}, guardando sin monetizar.`);
      link = originalLink;
    }

    const uuid = Math.random().toString(36).substring(2, 11);
    const stmt = db.prepare(`
            INSERT INTO published_deals (id, title, price_offer, price_official, link, image, tienda, categoria, description, coupon, posted_at, score)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 100)
        `);
    stmt.run(uuid, title, price, price_official || 0, link, image, store, category, description || '', coupon || null);

    // Notificar al canal Telegram
    try {
      const Telegram = require('./src/notifiers/TelegramNotifier');
      Telegram.sendManualDeal({ title, price_offer: price, price_official, link, image, description, coupon });
    } catch (e) { console.error("Error notificando TG:", e); }

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/update-deal', authMiddleware, async (req, res) => {
  try {
    let { id, title, price, price_official, link, image, store, category, description, coupon } = req.body;

    // 💰 MONETIZACIÓN FORZOSA EN EDICIÓN TAMBIÉN 💰
    const originalLink = link;
    try {
      const mLink = await LinkTransformer.transform(link);
      if (mLink) link = mLink;
    } catch (e) {
      console.warn("Fallo monetizando update, conservando original");
    }

    const stmt = db.prepare(`
            UPDATE published_deals 
            SET title=?, price_offer=?, price_official=?, link=?, image=?, tienda=?, categoria=?, description=?, coupon=?
            WHERE id=?
        `);
    stmt.run(title, price, price_official || 0, link, image, store, category, description || '', coupon || null, id);
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
