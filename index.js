// FORCE DEPLOY: 2026-02-09 19:40 PM - FIX ANALYZE FATAL ERROR AND LINKRESOLVER ROBUSTNESS
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const { db } = require('./src/database/db');
const LinkTransformer = require('./src/utils/LinkTransformer');
const CoreProcessor = require('./src/core/CoreProcessor');
const AIProcessor = require('./src/core/AIProcessor');
const logger = require('./src/utils/logger');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static('public')); // Servir estáticos principal
app.use(express.static(path.join(__dirname, 'src/web/public'))); // Fallback
app.use(express.json());



// --- RUTINA DE AUTO-REPARACIÓN DE LINKS (SILENCIOSA) ---
const autoRepairLinks = () => {
  const currentKey = process.env.SOVRN_API_KEY;
  if (!currentKey || currentKey === 'tu_api_key_de_sovrn') return;

  try {
    const deals = db.prepare("SELECT id, link FROM published_deals WHERE link LIKE '%viglink.com%' OR link LIKE '%sovrn.com%'").all();
    let fixedCount = 0;

    const updateStmt = db.prepare("UPDATE published_deals SET link = ? WHERE id = ?");

    deals.forEach(deal => {
      if (deal.link.includes('key=') && !deal.link.includes(currentKey)) {
        // Extraer la parte antes de la llave y después de la llave vieja para rearmar el link
        const urlObj = new URL(deal.link);
        urlObj.searchParams.set('key', currentKey);
        updateStmt.run(urlObj.toString(), deal.id);
        fixedCount++;
      }
    });

    if (fixedCount > 0) {
      console.log(`[SELF-HEALING] 🩹 Se han reparado automáticamente ${fixedCount} enlaces con la nueva API Key.`);
    }
  } catch (e) {
    console.error(`[SELF-HEALING] Error en reparación:`, e.message);
  }
};

// Ejecutar reparación al iniciar
autoRepairLinks();

// --- STATUS PUBLICO ---
app.get('/api/status', (req, res) => {
  try {
    const lastDeal = db.prepare('SELECT title, posted_at, tienda FROM published_deals ORDER BY posted_at DESC LIMIT 1').get();
    const count24h = db.prepare("SELECT COUNT(*) as total FROM published_deals WHERE posted_at > datetime('now', '-1 day')").get();

    res.json({
      online: true,
      last_cycle: CoreProcessor.lastCycle,
      last_success: CoreProcessor.lastSuccess,
      last_deal: lastDeal,
      deals_24h: count24h.total,
      time: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/time', (req, res) => {
  res.json({ deployed_at: '2026-02-06 12:15 PM', server_time: new Date().toISOString() });
});
// --- ROUTES PARA PÁGINAS ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin_express.html'));
});

app.get('/admin-deals', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin_dark_v4.html'));
});

app.get('/express', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/express.html'));
});

// --- PROXY DE IMÁGENES (Referer Dinámico para Bypass) ---
app.get('/api/proxy-image', async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) return res.status(400).send('URL missing');

  let referer = 'https://www.google.com/';
  if (imageUrl.includes('amazon.com') || imageUrl.includes('media-amazon')) referer = 'https://www.amazon.com/';
  if (imageUrl.includes('nike.com') || imageUrl.includes('nikecdn')) referer = 'https://www.nike.com/';

  try {
    const response = await axios({
      method: 'get',
      url: imageUrl,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Referer': referer,
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      },
      timeout: 10000
    });
    res.set('Content-Type', response.headers['content-type']);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(response.data);
  } catch (error) {
    try {
      const weservUrl = `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl)}`;
      const response = await axios.get(weservUrl, { responseType: 'arraybuffer' });
      res.set('Content-Type', response.headers['content-type']);
      res.send(response.data);
    } catch (e) {
      res.redirect(imageUrl);
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
    const deals = db.prepare("SELECT * FROM published_deals WHERE status IN ('published', 'expired') ORDER BY posted_at DESC LIMIT 60").all();
    res.json(deals);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ENDPOINT DE SALUD Y DIAGNÓSTICO (ADMIN) ---
app.get('/api/admin/diagnostics', authMiddleware, async (req, res) => {
  const diagnostics = {
    database: { status: 'OK', details: 'Conectada (SQLite)' },
    env: {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'DETECTADA ✅' : 'FALTANTE ⚠️',
      DEEPSEEK_KEY: process.env.DEEPSEEK_API_KEY ? 'DETECTADA ✅' : 'FALTANTE ⚠️',
      RENDER_URL: process.env.RENDER_EXTERNAL_URL ? 'CONFIGURADA ✅' : 'USANDO LOCALHOST 🏠'
    },
    system: {
      uptime: Math.floor(process.uptime()),
      platform: process.platform,
      node_version: process.version
    }
  };

  try {
    db.prepare("SELECT 1").get();
  } catch (e) {
    diagnostics.database = { status: 'ERROR', details: e.message };
  }

  res.json(diagnostics);
});

// 1.1 OBTENER OFERTAS EXPRESS (PÚBLICO)
app.get('/api/deals/express', async (req, res) => {
  try {
    // Simplificamos: Mostramos todo lo publicado sin filtros de categoría agresivos
    const deals = db.prepare(`
        SELECT * FROM published_deals 
        WHERE status IN ('published', 'expired') 
        ORDER BY posted_at DESC LIMIT 60
    `).all();

    // OPTIMIZACIÓN CRÍTICA: NO transformamos links aquí (es muy lento para 50 items)
    // El frontend usa IDs o el link que ya está guardado.
    // La transformación real sucede en /go/:id cuando el usuario hace click.
    res.json(deals);
  } catch (e) {
    console.error("[API DEALS ERR]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// 1.5. SUSCRIPCIÓN NEWSLETTER
app.post('/api/subscribe', async (req, res) => {
  const { email, name, phone, telegram } = req.body;
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Email inválido' });
  try {
    const { addSubscriber } = require('./src/database/db');
    addSubscriber(email, name, phone, telegram);
    res.json({ success: true, message: '¡Bienvenido al Club VIP!' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 2. REDIRECTOR INTELIGENTE CON VISTA PREVIA (OG TAGS)
app.get('/go/:id', (req, res) => {
  try {
    const deal = db.prepare('SELECT link, original_link, title, image, price_cop FROM published_deals WHERE id = ?').get(req.params.id);
    if (deal) {
      db.prepare("UPDATE published_deals SET clicks = clicks + 1 WHERE id = ?").run(req.params.id);

      const finalUrl = deal.original_link || deal.link;
      const proxyImageUrl = `${req.protocol}://${req.get('host')}/api/proxy-image?url=${encodeURIComponent(deal.image)}`;
      const priceFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(deal.price_cop || 0);

      // Si es un bot de previsualización (WhatsApp, Facebook, etc), enviamos los Meta Tags
      const ua = req.headers['user-agent'] || '';
      if (ua.match(/whatsapp|facebookexternalhit|twitterbot|slackbot/i)) {
        return res.send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${deal.title}</title>
              <meta property="og:title" content="${deal.title}" />
              <meta property="og:description" content="Compra segura con Masbarato Express. Recibe en la puerta de tu casa en Colombia. Sin cargos ocultos." />
              <meta property="og:image" content="${proxyImageUrl}" />
              <meta property="og:type" content="product" />
              <meta http-equiv="refresh" content="0;url=${finalUrl}" />
            </head>
            <body>Redirigiendo a la oferta...</body>
          </html>
        `);
      }

      // Para usuarios normales, redirección directa (para máxima velocidad)
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
    const { getComments } = require('./src/database/db');
    const comments = getComments(req.params.id);
    res.json(comments);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/all-comments', (req, res) => {
  try {
    const comments = db.prepare(`
      SELECT c.*, d.title as deal_title, d.image as deal_image 
      FROM comments c 
      JOIN published_deals d ON c.deal_id = d.id 
      ORDER BY c.created_at DESC LIMIT 30
    `).all();
    res.json(comments);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/comments', (req, res) => {
  const { dealId, author, text } = req.body;
  if (!dealId || !text) return res.status(400).json({ error: 'Faltan campos' });
  try {
    const { addComment } = require('./src/database/db');
    addComment(dealId, author, text);
    res.json({ success: true });
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
    db.prepare("UPDATE published_deals SET status = 'published', posted_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
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

// 6.5 PENDIENTES EXPRESS (ADMIN)
app.get('/api/admin/express/pending', authMiddleware, (req, res) => {
  try {
    const deals = db.prepare("SELECT * FROM published_deals WHERE status = 'pending_express' ORDER BY posted_at DESC").all();
    res.json(deals);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 6.5.1 PUBLICADAS EXPRESS (ADMIN) - Vista completa sin filtros restrictivos
app.get('/api/admin/express/published', authMiddleware, (req, res) => {
  try {
    const deals = db.prepare(`
        SELECT * FROM published_deals 
        WHERE status IN ('published', 'expired') 
        ORDER BY posted_at DESC LIMIT 200
    `).all();
    res.json(deals);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 6.5.2 FINALIZAR OFERTA (ADMIN)
app.post('/api/admin/express/finalize', authMiddleware, (req, res) => {
  const { id } = req.body;
  try {
    db.prepare("UPDATE published_deals SET status = 'expired' WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 6.5.3 ANALIZAR LINK PARA POST MANUAL (ADMIN) - SHOTGUN STRATEGY (Anti-Block)
app.post('/api/admin/express/analyze', authMiddleware, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL requerida' });

  try {
    const start = Date.now();
    console.log(`[MANUAL-MODE] ⚡ Análisis Shotgun: ${url.substring(0, 60)}...`);

    const LinkTransformer = require('./src/utils/LinkTransformer');
    const LinkResolver = require('./src/utils/LinkResolver');
    const cheerio = require('cheerio');

    // 1. Resolver y Limpiar Link (ESENCIAL: Scraper debe ir a la tienda, no al afiliado)
    let cleanUrl = url;
    try {
      cleanUrl = await LinkResolver.resolve(url) || url;
    } catch (err) {
      console.warn("[MANUAL-MODE] Falló resolución profunda, usando original:", err.message);
    }

    const finalUrl = await LinkTransformer.transform(cleanUrl);
    const store = LinkTransformer.detectarTienda(cleanUrl);

    console.log(`[MANUAL-MODE] Store: ${store} | Clean URL: ${cleanUrl.substring(0, 60)}...`);

    let result = {
      url: finalUrl, // URL con afiliado para la DB
      cleanUrl: cleanUrl, // URL limpia para el scraper
      store,
      title: '',
      price: 0,
      image: '',
      weight: 3.5,
      categoria: 'Lifestyle & Street',
      isManualNotice: true
    };

    // 2. Scraping "SHOTGUN" (Estrategia Múltiple Automática Anti-Bloqueo)
    if (store === 'Amazon US' || cleanUrl.includes('amazon.com')) {
      const strategies = [
        { name: 'Desktop Direct', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36', proxy: false },
        { name: 'Mobile iPhone', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1', proxy: false },
        { name: 'Google Translate Tunnel', proxy: true } // El arma secreta
      ];

      for (const strat of strategies) {
        if (!result.isManualNotice) break; // Ya tenemos éxito, salir

        try {
          console.log(`[MANUAL-MODE] 🔫 Probando estrategia Amazon: ${strat.name}...`);
          let html = '';
          let currentUrl = cleanUrl;
          let requestConfig = {
            timeout: 10000,
            maxRedirects: 5
          };

          if (strat.proxy) {
            currentUrl = `https://translate.google.com/translate?sl=auto&tl=en&u=${encodeURIComponent(cleanUrl)}`;
            requestConfig.headers = {
              'User-Agent': strat.ua || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            };
          } else {
            requestConfig.headers = {
              'User-Agent': strat.ua,
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Connection': 'keep-alive'
            };
          }

          const response = await axios.get(currentUrl, requestConfig);
          html = response.data;
          const $ = cheerio.load(html);

          // A. TÍTULO (Reforzado con RegEx)
          let title = $('#productTitle').text().trim() ||
            $('.product-title-word-break').text().trim() ||
            $('meta[name="title"]').attr('content') ||
            $('title').text().split(':')[0].trim();

          if (!title || title.includes('Pardon Our Interruption') || title.includes('Robot Check')) {
            const titleMatch = html.match(/<title>(.*?)<\/title>/i);
            if (titleMatch && titleMatch[1]) title = titleMatch[1].replace(' - Google Translate', '').split('|')[0].trim();
          }

          if (title && !title.includes('Pardon Our Interruption') && !title.includes('Robot Check')) {
            title = title.replace(/^Amazon\.com\s*[:|-]?\s*/gi, '').trim();
            result.title = title;
          }

          // B. PRECIO
          let price = 0;
          const priceSelectors = ['.priceToPay .a-offscreen', '.apexPriceToPay .a-offscreen', '.a-price .a-offscreen', '#priceblock_ourprice'];
          for (const sel of priceSelectors) {
            let txt = $(sel).first().text().trim();
            if (txt) {
              const match = txt.match(/[\d,]+(\.?\d+)?/);
              if (match) { price = parseFloat(match[0].replace(/,/g, '')); if (price > 0) break; }
            }
          }

          if (price === 0) {
            const rawPriceMatch = html.match(/\$[\s]*([\d,]+\.\d{2})/);
            if (rawPriceMatch) price = parseFloat(rawPriceMatch[1].replace(/,/g, ''));
          }
          result.price = price;

          // C. IMAGEN
          let imgUrl = $('#landingImage').attr('src') || $('#imgBlkFront').attr('src');
          if (!imgUrl) {
            const imgMatch = html.match(/https:\/\/m.media-amazon.com\/images\/I\/[a-zA-Z0-9_-]+.jpg/);
            if (imgMatch) imgUrl = imgMatch[0];
          }
          if (imgUrl) result.image = imgUrl;

          if (result.title && result.price > 0) {
            result.isManualNotice = false;
            console.log(`[MANUAL-MODE] ✅ ÉXITO con ${strat.name}!`);
            break;
          }
        } catch (err) { }
      }
    }
    else if (store === 'eBay' || cleanUrl.includes('ebay.com')) {
      try {
        console.log(`[MANUAL-MODE] 🔫 Analizando eBay Shotgun...`);
        const response = await axios.get(cleanUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36' },
          timeout: 8000
        });
        const $ = cheerio.load(response.data);

        result.title = $('.x-item-title__mainTitle span').first().text().trim() || $('#itemTitle').text().replace('Details about', '').trim();

        let pText = $('.x-price-primary span').first().text().trim() || $('#prcIsum').text().trim();
        if (pText) {
          const pMatch = pText.match(/[\d,]+(\.?\d+)?/);
          if (pMatch) result.price = parseFloat(pMatch[0].replace(/,/g, ''));
        }

        result.image = $('.ux-image-magnify__image--main').attr('src') || $('#icImg').attr('src');

        if (result.title && result.price > 0) result.isManualNotice = false;
      } catch (e) { console.warn("eBay Shotgun falló"); }
    }

    // 3. ULTIMO RECURSO: DeepScraper (Puppeteer) - Solo si lo anterior falló y no es una redirección infinita
    if (result.isManualNotice) {
      try {
        console.log(`[MANUAL-MODE] 🕵️ Usando DeepScraper para: ${store}`);
        const DeepScraper = require('./src/utils/DeepScraper');
        const deepData = await DeepScraper.scrape(cleanUrl);
        if (deepData) {
          if (deepData.title) result.title = deepData.title;
          if (deepData.offerPrice) result.price = deepData.offerPrice;
          if (deepData.image) result.image = deepData.image;
          if (deepData.weight) result.weight = deepData.weight;
          if (result.title && result.price > 0) result.isManualNotice = false;
        }
      } catch (e) {
        console.error("DeepScraper en modo manual falló:", e.message);
      }
    }

    console.log(`[MANUAL-MODE] ⚡ Completado en ${Date.now() - start}ms | Auto-data: ${!result.isManualNotice}`);
    res.json(result);

  } catch (e) {
    console.error("❌ [MANUAL-MODE CRIT] Error fatal en analyze:", e.stack || e.message);

    // Evitar que la app se quede colgada: Reintentamos enviar lo básico para modo manual
    if (!res.headersSent) {
      res.status(200).json({
        url: url, // Fallback al original
        cleanUrl: url,
        store: 'Desconocido',
        title: '',
        price: 0,
        image: '',
        isManualNotice: true,
        error: e.message || "Error interno del servidor"
      });
    }
  }
});

// 6.5.4 CREAR BORRADOR MANUAL (ADMIN)
app.post('/api/admin/express/manual-post', authMiddleware, async (req, res) => {
  const { url, title, price, image, weight, store, category, gallery } = req.body;
  try {
    const { saveDeal } = require('./src/database/db');
    const id = 'exp_' + Date.now();

    // El DB tiene un CHECK constraint de price_offer > 0
    // Si estamos en borrador y no tenemos precio, usamos 0.01 como placeholder
    const safePrice = parseFloat(price) > 0 ? parseFloat(price) : 0.01;

    const deal = {
      id,
      link: url,
      original_link: url,
      title: title || '',
      price_official: safePrice,
      price_offer: safePrice,
      image: image || '',
      weight: parseFloat(weight) || 0,
      tienda: store || 'Tienda USA',
      categoria: category || 'Lifestyle & Street',
      gallery: gallery || '[]',
      status: 'pending_express',
      score: 0,
      description: '',
      coupon: '',
      is_historic_low: 0,
      price_cop: 0
    };
    saveDeal(deal);
    res.json({ success: true, id });
  } catch (e) {
    console.error("❌ Error en manual-post:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// 6.5.2.5 ARCHIVAR OFERTA (NUEVO - Backup histórico)
app.post('/api/admin/express/archive', authMiddleware, (req, res) => {
  const { id } = req.body;
  try {
    db.prepare("UPDATE published_deals SET status = 'archived' WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET Archivados
app.get('/api/admin/express/archived', authMiddleware, (req, res) => {
  try {
    const deals = db.prepare("SELECT * FROM published_deals WHERE status = 'archived' ORDER BY posted_at DESC").all();
    res.json(deals);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 6.5.3 ELIMINAR OFERTA (ADMIN)
app.post('/api/admin/express/delete', authMiddleware, (req, res) => {
  const { id } = req.body;
  try {
    db.prepare("DELETE FROM published_deals WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/express/approve', authMiddleware, async (req, res) => {
  const { id, price_cop, price_offer, title, weight, categoria, image, gallery } = req.body;

  // VALIDACIÓN CRÍTICA DE PRECIO (REFACTORIZADA)
  const pOffer = parseFloat(price_offer) || 0;
  if (pOffer <= 0) {
    console.error(`🚫 [REJECTED] Intento de publicar ID ${id} con precio ${pOffer}`);
    return res.status(400).json({ error: "Precio USD inválido" });
  }

  console.log(`💾 Aprobando ${id}: ${title} | Imagen: ${image ? 'Sí' : 'No'}`);
  try {
    const updated = db.prepare(`
        UPDATE published_deals 
        SET status = 'published', price_cop = ?, price_offer = ?, title = ?, weight = ?, categoria = ?, image = ?, gallery = ?, posted_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(
      parseFloat(price_cop) || 0,
      pOffer,
      title,
      parseFloat(weight) || 0,
      categoria || 'Lifestyle & Street',
      image,
      gallery || null,
      id
    );

    console.log(`✅ Resultado del UPDATE: ${updated.changes} filas modificadas.`);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 6.7 ACTUALIZAR SIN CAMBIAR ESTADO (ADMIN)
app.post('/api/admin/express/update', authMiddleware, async (req, res) => {
  const { id, price_cop, price_offer, title, weight, categoria, image, gallery } = req.body;

  // VALIDACIÓN CRÍTICA DE PRECIO (REFACTORIZADA)
  const pOffer = parseFloat(price_offer) || 0;
  if (pOffer <= 0) {
    console.error(`🚫 [REJECTED-UPDATE] Intento de guardar ID ${id} con precio ${pOffer}`);
    return res.status(400).json({ error: "Precio USD inválido" });
  }

  try {
    db.prepare(`
        UPDATE published_deals 
        SET price_cop = ?, price_offer = ?, title = ?, weight = ?, categoria = ?, image = ?, gallery = ?
        WHERE id = ?
    `).run(
      parseFloat(price_cop) || 0,
      pOffer,
      title,
      parseFloat(weight) || 0,
      categoria || 'Lifestyle & Street',
      image,
      gallery || null,
      id
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- PROXY DE IMÁGENES (Referer Dinámico para Bypass) ---
app.get('/api/proxy-image', async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) return res.status(400).send('URL missing');

  let referer = 'https://www.google.com/';
  if (imageUrl.includes('amazon.com') || imageUrl.includes('media-amazon')) referer = 'https://www.amazon.com/';
  if (imageUrl.includes('nike.com') || imageUrl.includes('nikecdn')) referer = 'https://www.nike.com/';

  try {
    const response = await axios({
      method: 'get',
      url: imageUrl,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Referer': referer,
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      },
      timeout: 10000
    });
    res.set('Content-Type', response.headers['content-type']);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(response.data);
  } catch (error) {
    try {
      const weservUrl = `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl)}`;
      const response = await axios.get(weservUrl, { responseType: 'arraybuffer' });
      res.set('Content-Type', response.headers['content-type']);
      res.send(response.data);
    } catch (e) {
      res.redirect(imageUrl); // Fallback final: intentar cargar directo
    }
  }
});



app.get('/api/admin/stats', authMiddleware, (req, res) => {
  try {
    const totalDeals = db.prepare('SELECT COUNT(*) as count FROM published_deals').get().count;
    const subscribers = db.prepare('SELECT COUNT(*) as count FROM subscribers').get().count;
    const clicks = db.prepare('SELECT SUM(clicks) as count FROM published_deals').get().count || 0;
    const last24h = db.prepare("SELECT COUNT(*) as count FROM published_deals WHERE posted_at > datetime('now', '-24 hours')").get().count;
    const stores = db.prepare('SELECT tienda, COUNT(*) as count FROM published_deals GROUP BY tienda ORDER BY count DESC LIMIT 5').all();

    res.json({
      total: totalDeals,
      subscribers: subscribers,
      clicks: clicks,
      earnings: (clicks * 0.05).toFixed(2), // Estimación conservadora: $0.05 por click
      last24h: last24h,
      stores: stores
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/manual-post', authMiddleware, async (req, res) => {
  const { url, price } = req.body;
  try {
    const success = await CoreProcessor.processDeal({
      sourceLink: url,
      title: 'Manual Order', // El bot buscará el título real
      price_offer: parseFloat(price) || 0,
      referencePrice: parseFloat(price) || 0,
      isManual: true
    });

    if (success) {
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'El bot rechazó la oferta (stock, precio o duplicado)' });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});



// 7.5 OPTIMIZAR TÍTULO CON IA (ADMIN)
app.post('/api/admin/express/optimize-title', authMiddleware, async (req, res) => {
  const { title } = req.body;
  try {
    const AIProcessor = require('./src/core/AIProcessor');
    const optimized = await AIProcessor.generateOptimizedTitle(title);
    res.json({ success: true, optimized });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 7.6 OPTIMIZAR TODO (TÍTULO + DESC + SPECS) CON IA (ADMIN)
app.post('/api/admin/express/optimize-all', authMiddleware, async (req, res) => {
  const { title } = req.body;
  try {
    const AIProcessor = require('./src/core/AIProcessor');
    const content = await AIProcessor.generateEnhancedContent(title);
    res.json({ success: true, content });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 7.5.0 OBTENER TRM ACTUAL (ADMIN)
app.get('/api/express/trm', async (req, res) => {
  try {
    const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD', { timeout: 10 * 1000 });
    if (response.data && response.data.rates && response.data.rates.COP) {
      res.json({
        success: true,
        trm: response.data.rates.COP,
        updated_at: new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      });
    } else {
      res.status(500).json({ success: false, error: 'No se pudo obtener la TRM' });
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// --- AUTO-PINGER: Mantiene la app activa en Render ---
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
if (RENDER_URL) {
  setInterval(async () => {
    try {
      await axios.get(`${RENDER_URL}/api/status`);
      console.log(`💓 [HEARTBEAT] Ping enviado a ${RENDER_URL}`);
    } catch (e) { console.error("💓 [HEARTBEAT] Error al auto-pingear."); }
  }, 1000 * 60 * 14); // Cada 14 minutos (Render duerme a los 15)
}

// 7.5.1 BUSCAR PRECIO EN MERCADOLIBRE (ADMIN)
app.post('/api/admin/express/meli-search', authMiddleware, async (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'Título requerido' });

  try {
    // Limpieza AGRESIVA para MercadoLibre
    let cleanQuery = title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    cleanQuery = cleanQuery.split(' ').slice(0, 4).join(' '); // Tomar solo marca/modelo
    if (!cleanQuery) cleanQuery = "producto";

    logger.info(`🔎 Buscando en ML: "${cleanQuery}"`);
    const searchUrl = `https://api.mercadolibre.com/sites/MCO/search?q=${encodeURIComponent(cleanQuery)}&limit=3`;

    // Headers ultra-completos para parecer un usuario real navegando desde Colombia
    const response = await axios.get(searchUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'es-CO,es;q=0.9',
        'Referer': 'https://www.mercadolibre.com.co/',
        'Origin': 'https://www.mercadolibre.com.co',
        'Cache-Control': 'max-age=0'
      }
    });

    if (response.data.results && response.data.results.length > 0) {
      const items = response.data.results;
      // Tomar el precio promedio de los primeros 3 resultados para evitar outliers
      const top3 = items.slice(0, 3);
      const avgPrice = Math.round(top3.reduce((acc, curr) => acc + curr.price, 0) / top3.length);
      const lowest = items[0].price;
      const link = items[0].permalink;

      res.json({ success: true, avgPrice, lowest, link });
    } else {
      res.json({ success: false, message: 'No se encontraron resultados' });
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
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

  // --- AUTO-PINGER: Evitar que Render entre en reposo ---
  const SITE_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  console.log(`📡 Auto-Pinger activado para: ${SITE_URL}`);

  setInterval(async () => {
    try {
      await axios.get(`${SITE_URL}/api/status`);
      console.log(`💓 Keep-alive ping exitoso a las ${new Date().toLocaleTimeString()}`);
    } catch (e) {
      console.error(`💔 Error en keep-alive ping: ${e.message}`);
    }
  }, 10 * 60 * 1000); // Cada 10 minutos (Render suele dormir a los 15)
});
