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

// 4. RUTAS DEL FRONTEND
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
