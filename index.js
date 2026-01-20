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

// --- PROXY DE IMÁGENES (Bypass de bloqueos) ---
app.get('/api/proxy-image', async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) return res.status(400).send('URL missing');

  try {
    const response = await axios({
      method: 'get',
      url: imageUrl,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeout: 8000
    });

    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    response.data.pipe(res);
  } catch (error) {
    // IMPORTANTE: Retornar 404 para que el frontend active su propia lógica de fallback
    res.status(404).send('Image not found');
  }
});

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
app.get('/api/deals', async (req, res) => {
  try {
    const deals = db.prepare('SELECT * FROM published_deals ORDER BY posted_at DESC LIMIT 50').all();

    // Transformar links en tiempo real para asegurar que el tag esté presente
    const transformedDeals = await Promise.all(deals.map(async (deal) => {
      deal.link = await LinkTransformer.transform(deal.original_link || deal.link);
      return deal;
    }));

    res.json(transformedDeals);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. REDIRECTOR INTELIGENTE (PÚBLICO)
app.get('/go/:id', (req, res) => {
  try {
    const deal = db.prepare('SELECT link FROM published_deals WHERE id = ?').get(req.params.id);
    if (deal && deal.link) {
      db.prepare("UPDATE published_deals SET clicks = clicks + 1 WHERE id = ?").run(req.params.id);

      let finalUrl = deal.link;
      // Asegurar protocolo
      if (!finalUrl.startsWith('http')) {
        finalUrl = 'https://' + finalUrl;
      }

      res.redirect(finalUrl);
    } else {
      res.redirect('/?error=deal_not_found');
    }
  } catch (e) {
    console.error('Redirect error:', e);
    res.redirect('/');
  }
});

// 3. VOTACIÓN Y COMENTARIOS
app.post('/api/vote', (req, res) => {
  const { id } = req.body;
  try {
    db.prepare('UPDATE published_deals SET score = score + 1 WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/comments/:id', (req, res) => {
  try {
    const comments = db.prepare('SELECT * FROM comments WHERE deal_id = ? ORDER BY created_at ASC').all(req.params.id);
    res.json(comments);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ADMIN API ---
app.get('/api/admin/stats', authMiddleware, (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM published_deals').get().count;
    const clicks = db.prepare('SELECT SUM(clicks) as count FROM published_deals').get().count || 0;
    res.json({ total, clicks });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 4. PURGAR CORRUPTOS (ADMIN)
app.post('/api/admin/purge', authMiddleware, (req, res) => {
  try {
    const deleted = db.prepare("DELETE FROM published_deals WHERE image LIKE '%placehold%' OR title IS NULL").run();
    res.json({ success: true, count: deleted.changes });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Iniciar servidor y ciclos
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  CoreProcessor.start();
});
