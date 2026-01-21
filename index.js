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

// --- ROUTES PARA PÁGINAS ---
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin.html'));
});

// --- PROXY DE IMÁGENES (Bypass de bloqueos con Doble Capa) ---
app.get('/api/proxy-image', async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) return res.status(400).send('URL missing');

  const fetchImage = async (url) => {
    return axios({
      method: 'get',
      url: url,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Referer': 'https://www.google.com/'
      },
      timeout: 10000
    });
  };

  try {
    // Intento 1: Directo
    const response = await fetchImage(imageUrl);
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    response.data.pipe(res);
  } catch (error) {
    // Intento 2: Via Weserv (Bypass extremo)
    try {
      console.log(`⚠️ Proxy directo falló para ${imageUrl.substring(0, 40)}... reintentando vía Weserv`);
      const weservUrl = `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl)}`;
      const response = await fetchImage(weservUrl);
      res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
      response.data.pipe(res);
    } catch (e) {
      res.status(404).send('Image not found');
    }
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

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  if (password === adminPass || password === 'Masbarato2026') {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Contraseña incorrecta' });
  }
});

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
    const deal = db.prepare('SELECT link, title FROM published_deals WHERE id = ?').get(req.params.id);
    if (deal && deal.link) {
      db.prepare("UPDATE published_deals SET clicks = clicks + 1 WHERE id = ?").run(req.params.id);

      // Transformar el link en tiempo real usando el original si existe
      LinkTransformer.transform(deal.original_link || deal.link).then(finalUrl => {
        // SEGURIDAD: Nunca enviar a Slickdeals
        if (finalUrl.includes('slickdeals.net')) {
          console.log(`🔒 Intento de Resolución Profunda para: ${deal.title}`);
          const LinkResolver = require('./src/utils/LinkResolver');
          LinkResolver.resolve(finalUrl).then(resolved => {
            if (resolved && !resolved.includes('slickdeals.net')) {
              return res.redirect(resolved);
            }
            // Fallback final: Buscar en Amazon con nuestro tag
            const cleanTitle = deal.title.replace(/[^a-zA-Z0-9 ]/g, ' ').substring(0, 50);
            const fallbackUrl = `https://www.amazon.com/s?k=${encodeURIComponent(cleanTitle)}&tag=${process.env.AMAZON_TAG || 'masbaratodeal-20'}`;
            res.redirect(fallbackUrl);
          }).catch(() => {
            const cleanTitle = deal.title.replace(/[^a-zA-Z0-9 ]/g, ' ').substring(0, 50);
            const fallbackUrl = `https://www.amazon.com/s?k=${encodeURIComponent(cleanTitle)}&tag=${process.env.AMAZON_TAG || 'masbaratodeal-20'}`;
            res.redirect(fallbackUrl);
          });
          return;
        }

        // Asegurar protocolo
        if (!finalUrl.startsWith('http')) {
          finalUrl = 'https://' + finalUrl;
        }
        res.redirect(finalUrl);
      }).catch(err => {
        console.error('Transform error:', err);
        // En caso de error, si el link original es slickdeals, usar fallback también
        if (deal.link.includes('slickdeals.net')) {
          const cleanTitle = deal.title.replace(/[^a-zA-Z0-9 ]/g, ' ').substring(0, 50);
          res.redirect(`https://www.amazon.com/s?k=${encodeURIComponent(cleanTitle)}&tag=${process.env.AMAZON_TAG || 'masbaratodeal-20'}`);
        } else {
          res.redirect(deal.link);
        }
      });
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

// 4. ELIMINAR/RECHAZAR OFERTA (ADMIN)
app.post('/api/delete-deal', authMiddleware, (req, res) => {
  const { id } = req.body;
  try {
    db.prepare("DELETE FROM published_deals WHERE id = ?").run(id);
    db.prepare("DELETE FROM comments WHERE deal_id = ?").run(id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 5. APROBAR OFERTA (ADMIN)
app.post('/api/approve-deal', authMiddleware, (req, res) => {
  const { id } = req.body;
  try {
    db.prepare("UPDATE published_deals SET status = 'published' WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 6. OBTENER PENDIENTES (ADMIN)
app.get('/api/admin/pending', authMiddleware, (req, res) => {
  try {
    const deals = db.prepare("SELECT * FROM published_deals WHERE status = 'pending' ORDER BY posted_at DESC").all();
    res.json(deals);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 7. PUBLICACIÓN MANUAL (ADMIN)
app.post('/api/admin/manual-post', authMiddleware, async (req, res) => {
  const { url, price } = req.body;
  try {
    const success = await CoreProcessor.processDeal({
      sourceLink: url,
      title: 'Manual Order',
      price_offer: parseFloat(price) || 0
    });

    if (success) {
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'El bot rechazó la oferta (stock, precio o duplicado)' });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 8. PURGAR CORRUPTOS (ADMIN)
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
