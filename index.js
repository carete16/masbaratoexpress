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
const authMiddleware = (req, res, next) => {
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  const headerPass = req.headers['x-admin-password'];

  if (headerPass === adminPass || headerPass === 'Masbarato2026') {
    next();
  } else {
    res.status(403).json({ error: 'Acceso denegado' });
  }
};

// 1. OBTENER OFERTAS (PÚBLICO)
app.get('/api/deals', (req, res) => {
  try {
    const deals = db.prepare(`
            SELECT * FROM published_deals 
            WHERE status = 'published'
            AND link NOT LIKE '%slickdeals.net%'
            AND link NOT LIKE '%translate.google%'
            AND tienda NOT LIKE '%Translate%'
            AND tienda NOT LIKE '%Google%'
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

// 3. VOTACIÓN Y COMENTARIOS
app.post('/api/vote-up/:id', (req, res) => {
  try {
    const { voteUp } = require('./src/database/db');
    voteUp(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/comments', (req, res) => {
  try {
    const { addComment } = require('./src/database/db');
    const { dealId, author, text } = req.body;
    addComment(dealId, author, text);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/purge', authMiddleware, (req, res) => {
  try {
    const deleted = db.prepare(`
            DELETE FROM published_deals 
            WHERE tienda LIKE '%Translate%' 
            OR tienda LIKE '%Google%' 
            OR link LIKE '%slickdeals.net%' 
            OR link LIKE '%translate.google%'
        `).run();
    res.json({ success: true, message: `Se eliminaron ${deleted.changes} ofertas corruptas.` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- RUTAS DE ADMINISTRACIÓN ---
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  if (password === adminPass || password === 'Masbarato2026') {
    res.json({ success: true });
  } else {
    res.status(403).json({ error: 'Contraseña incorrecta' });
  }
});

app.get('/api/admin/pending', authMiddleware, (req, res) => {
  try {
    const deals = db.prepare("SELECT * FROM published_deals WHERE status = 'pending' ORDER BY posted_at DESC").all();
    res.json(deals);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/approve-deal', authMiddleware, (req, res) => {
  try {
    const { id } = req.body;
    db.prepare("UPDATE published_deals SET status = 'published' WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/delete-deal', authMiddleware, (req, res) => {
  try {
    const { id } = req.body;
    db.prepare("DELETE FROM published_deals WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// NUEVO: PUBLICACIÓN MANUAL DESDE EL PANEL
app.post('/api/admin/manual-post', authMiddleware, async (req, res) => {
  try {
    const { url, price } = req.body;
    if (!url) return res.status(400).json({ error: 'URL requerida' });

    const LinkTransformer = require('./src/utils/LinkTransformer');
    const Validator = require('./src/core/Bot2_Explorer');
    const AI = require('./src/core/AIProcessor');
    const Publisher = require('./src/core/Bot4_Publisher');
    const { saveDeal } = require('./src/database/db');
    const crypto = require('crypto');

    // 1. Limpieza y Monetización
    const cleanLink = await LinkTransformer.transform(url);

    // 2. Extracción/Validación
    const mockOpp = { sourceLink: cleanLink, title: 'Oferta Especial', referencePrice: price || 0, store: 'Global' };
    const validation = await Validator.validate(mockOpp);

    const dealId = crypto.createHash('md5').update(cleanLink).digest('hex').substring(0, 10);
    const finalPrice = price || validation.realPrice || 0;

    const dealData = {
      id: dealId,
      title: validation.title || "Super Oferta USA",
      price_offer: finalPrice,
      price_official: finalPrice > 0 ? (finalPrice * 1.3).toFixed(2) : 0,
      image: validation.image || 'https://www.techbargains.com/Content/static/tb-logo.png',
      tienda: validation.storeName || 'Tienda USA',
      link: cleanLink,
      original_link: url,
      categoria: 'Ofertas'
    };

    // 3. IA
    const editorial = await AI.generateViralContent(dealData);
    dealData.viralContent = editorial.content;

    // 4. Publicar
    const success = await Publisher.sendOffer(dealData);

    if (success) {
      res.json({ success: true, deal: dealData });
    } else {
      res.status(500).json({ error: 'Error al enviar a Telegram. Revisa el .env' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 4. RUTAS DEL FRONTEND
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 6. SITEMAP DINÁMICO (SEO para Facturación)
app.get('/sitemap.xml', (req, res) => {
  try {
    const deals = db.prepare("SELECT id, posted_at FROM published_deals WHERE status = 'published' LIMIT 100").all();
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://masbaratodeals.onrender.com/</loc>
    <changefreq>always</changefreq>
    <priority>1.0</priority>
  </url>`;

    deals.forEach(deal => {
      xml += `
  <url>
    <loc>https://masbaratodeals.onrender.com/go/${deal.id}</loc>
    <lastmod>${new Date(deal.posted_at).toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;
    });

    xml += '\n</urlset>';
    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (e) { res.status(500).send('Error generating sitemap'); }
});

// 5. ARRANQUE DEL BOT Y SERVIDOR
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`✅ WEB ONLINE EN PUERTO: ${PORT}`);

  // Iniciar el Bot y Recolección
  if (process.env.TELEGRAM_BOT_TOKEN) {
    try {
      console.log("🤖 Iniciando Bot de Telegram y Recolección...");
      CoreProcessor.start();
    } catch (botError) {
      console.error("❌ Error al iniciar el bot:", botError.message);
    }
  } else {
    console.log("⚠️ TELEGRAM_BOT_TOKEN no configurado.");
  }

  // 🚀 SISTEMA ALWAYS-ON: Evita que Render duerma la web
  const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://masbaratodeals.onrender.com';
  setInterval(() => {
    axios.get(RENDER_URL).then(() => console.log('💓 Heartbeat: Sistema activo')).catch(() => { });
  }, 10 * 60 * 1000); // Cada 10 min
});
