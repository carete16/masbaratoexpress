require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./src/database/db');
const PriceEngine = require('./src/utils/PriceEngine'); // Changed path from core to utils
const DeepScraper = require('./src/utils/DeepScraper'); // Importar Scraper Real
const LinkTransformer = require('./src/utils/LinkTransformer');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'src/web/public')));

/**
 * API ROUTES
 */

// 1. OBTENER AJUSTES (TRM, etc)
app.get('/api/config', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM settings').all();
    const config = {};
    settings.forEach(s => config[s.key] = s.value);
    res.json(config);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. PRODUCTOS (CATÁLOGO)
app.get('/api/products', (req, res) => {
  try {
    const query = "SELECT id, name, category, price_cop_final, images, status FROM products WHERE status = 'disponible' ORDER BY created_at DESC";
    const products = db.prepare(query).all();

    // Parsear imágenes (vienen como JSON string)
    const formatted = products.map(p => ({
      ...p,
      images: JSON.parse(p.images || '[]')
    }));

    res.json(formatted);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. DETALLE DE PRODUCTO
app.get('/api/products/:id', (req, res) => {
  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!product) return res.status(404).json({ error: 'No encontrado' });

    product.images = JSON.parse(product.images || '[]');
    res.json(product);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 4. CREAR PEDIDO (Workflow 50/50)
app.post('/api/orders', (req, res) => {
  const { product_id, user_email, full_name, address } = req.body;

  try {
    const product = db.prepare('SELECT price_cop_final FROM products WHERE id = ?').get(product_id);
    if (!product) return res.status(400).json({ error: 'Producto inválido' });

    const orderId = 'ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    const userId = 'USR-' + Math.random().toString(36).substr(2, 6).toUpperCase();

    // Registrar Usuario si no existe (Simplificado)
    db.prepare('INSERT OR IGNORE INTO users (id, email, full_name) VALUES (?, ?, ?)').run(userId, user_email, full_name);

    // Crear Pedido
    db.prepare(`
            INSERT INTO orders (id, user_id, product_id, total_amount_cop, status, payment_status)
            VALUES (?, ?, ?, ?, 'recibido', 'pendiente_pago_1')
        `).run(orderId, userId, product_id, product.price_cop_final);

    res.json({
      success: true,
      order_id: orderId,
      msg: 'Pedido registrado. Se requiere pago inicial del 50%.',
      total: product.price_cop_final,
      deposit_required: product.price_cop_final / 2
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 5. ADMIN: CREAR PRODUCTO (Inyección de Motor de Precios)
app.post('/api/admin/products', (req, res) => {
  const { name, description, images, category, source_link, price_usd, weight_lb } = req.body;
  try {
    const getSetting = (key, fallback) => {
      const res = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
      return res ? res.value : fallback;
    };

    const trm = getSetting('trm_base', '3650');
    const trm_offset = getSetting('trm_offset', '300');
    const cost_lb = getSetting('cost_lb_default', '6');
    const min_weight = getSetting('min_weight_default', '4');
    const tax_usa_perc = getSetting('tax_usa_perc', '7');
    const margin_perc = getSetting('margin_perc', '30');

    const calc = PriceEngine.calculate({
      price_usd: parseFloat(price_usd) || 0,
      weight_lb: parseFloat(weight_lb) || 0,
      trm: parseFloat(trm),
      trm_offset: parseFloat(trm_offset),
      cost_lb_usd: parseFloat(cost_lb),
      min_weight: parseFloat(min_weight),
      tax_usa_perc: parseFloat(tax_usa_perc),
      margin_perc: parseFloat(margin_perc)
    });

    const id = 'PROD-' + Math.random().toString(36).substr(2, 7).toUpperCase();
    db.prepare(`
        INSERT INTO products (
            id, name, description, images, category, source_link, 
            price_usd, trm_applied, weight_lb, price_cop_final
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, description, JSON.stringify(images || []), category, source_link,
      price_usd, calc.trm_applied, calc.weight_used, calc.final_cop);

    res.json({ success: true, product_id: id, price_calculated: calc.final_cop });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 6. ADMIN: ACCIONES ADICIONALES (EXPRESS)
app.get('/api/admin/express/pending', (req, res) => {
  console.log("[ADMIN] Cargando ofertas PENDIENTES...");
  try {
    const items = db.prepare("SELECT * FROM products WHERE status = 'pendiente' ORDER BY created_at DESC").all();
    console.log(`[ADMIN] Encontrados ${items.length} productos pendientes`);

    const formatted = items.map(item => {
      let tienda = 'Tienda';
      try {
        if (item.source_link && item.source_link.includes('http')) {
          tienda = new URL(item.source_link).hostname.replace('www.', '').split('.')[0];
        }
      } catch (e) { console.error("Error parsing tienda URL:", item.source_link); }

      return {
        ...item,
        // Mapeo de campos para compatibilidad con frontend
        title: item.name || 'Producto',
        categoria: item.category || 'Electrónica Premium',
        link: item.source_link,
        price_offer: item.price_usd,
        weight: item.weight_lb,
        tienda: tienda.toUpperCase(),
        image: JSON.parse(item.images || '[]')[0] || 'https://placehold.co/400x400'
      };
    });

    console.log(`[ADMIN] Enviando ${formatted.length} productos formateados`);
    res.json(formatted);
  } catch (e) {
    console.error("[ADMIN ERROR] Fallo al cargar pendientes:", e.message, e.stack);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/express/published', (req, res) => {
  console.log("[ADMIN] Cargando ofertas PUBLICADAS...");
  try {
    const items = db.prepare("SELECT * FROM products WHERE status = 'disponible' ORDER BY updated_at DESC").all();
    const formatted = items.map(item => {
      let tienda = 'Tienda';
      try {
        if (item.source_link && item.source_link.includes('http')) {
          tienda = new URL(item.source_link).hostname.replace('www.', '').split('.')[0];
        }
      } catch (e) { console.error("Error parsing tienda URL:", item.source_link); }

      return {
        ...item,
        // Mapeo de campos para compatibilidad con frontend
        title: item.name || 'Producto',
        categoria: item.category || 'Electrónica Premium',
        link: item.source_link,
        price_offer: item.price_usd,
        weight: item.weight_lb,
        tienda: tienda.toUpperCase(),
        image: JSON.parse(item.images || '[]')[0] || 'https://placehold.co/400x400'
      };
    });
    res.json(formatted);
  } catch (e) {
    console.error("[ADMIN ERROR] Fallo al cargar publicadas:", e.message, e.stack);
    res.status(500).json({ error: e.message });
  }
});

// --- MIGRACIÓN PREVENTIVA ---
try {
  db.prepare("ALTER TABLE products ADD COLUMN margin_perc REAL DEFAULT 30").run();
  console.log("Columna margin_perc agregada.");
} catch (e) { }
try {
  db.prepare("ALTER TABLE products ADD COLUMN tax_usa_perc REAL DEFAULT 7").run();
  console.log("Columna tax_usa_perc agregada.");
} catch (e) { }
try {
  db.prepare("ALTER TABLE products ADD COLUMN meli_price REAL DEFAULT 0").run();
  console.log("Columna meli_price agregada.");
} catch (e) { }
try {
  db.prepare("ALTER TABLE products ADD COLUMN meli_link TEXT").run();
  console.log("Columna meli_link agregada.");
} catch (e) { }

app.post('/api/admin/express/update', (req, res) => {
  const { id, title, price_offer, weight, price_cop, categoria, margin, tax, meli_price, meli_link } = req.body;
  try {
    const m = margin !== undefined ? margin : 30;
    const t = tax !== undefined ? tax : 7;

    db.prepare(`
      UPDATE products 
      SET name = ?, price_usd = ?, weight_lb = ?, price_cop_final = ?, category = ?, 
          margin_perc = ?, tax_usa_perc = ?, meli_price = ?, meli_link = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(title, price_offer, weight, price_cop, categoria, m, t, meli_price, meli_link, id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/express/manual-post', (req, res) => {
  const { title, price, weight, category, url, images, margin, tax, meli_price, meli_link } = req.body;
  console.log(`[ADMIN] Solicitud manual-post recibida para: ${title}`);
  try {
    const getSetting = (key, fallback) => {
      const res = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
      return res ? res.value : fallback;
    };

    const trm = parseFloat(getSetting('trm_base', '3650'));
    const trm_offset = parseFloat(getSetting('trm_offset', '300'));
    const cost_lb = parseFloat(getSetting('cost_lb_default', '6'));
    const min_weight = parseFloat(getSetting('min_weight_default', '4'));
    const tax_usa_perc = parseFloat(getSetting('tax_usa_perc', '7'));
    const margin_perc = parseFloat(getSetting('margin_perc', '30'));

    const finalMargin = margin !== undefined ? parseFloat(margin) : margin_perc;
    const finalTax = tax !== undefined ? parseFloat(tax) : tax_usa_perc;

    const calc = PriceEngine.calculate({
      price_usd: parseFloat(price) || 0,
      weight_lb: parseFloat(weight) || 0,
      trm: trm,
      trm_offset: trm_offset,
      cost_lb_usd: cost_lb,
      min_weight: min_weight,
      tax_usa_perc: finalTax,
      margin_perc: finalMargin
    });

    const id = 'PROD-' + Math.random().toString(36).substr(2, 7).toUpperCase();

    // Procesar imágenes
    let imageJson = '[]';
    try {
      if (Array.isArray(images)) imageJson = JSON.stringify(images);
      else if (typeof images === 'string') imageJson = JSON.stringify([images]);
      else imageJson = JSON.stringify(["https://placehold.co/600x600?text=No+Image"]);
    } catch (e) { console.error("Error procesando imagen para DB", e); }

    const operationalTrm = calc.trm_applied;
    const finalWeight = calc.weight_used;
    const finalCop = calc.final_cop;

    db.prepare(`
        INSERT INTO products (
            id, name, description, images, category, source_link, 
            price_usd, trm_applied, weight_lb, price_cop_final, 
            margin_perc, tax_usa_perc, meli_price, meli_link,
            status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')
    `).run(id, title, "", imageJson, // Descripción vacía a petición usuario
      category, url, price, operationalTrm, finalWeight, finalCop,
      finalMargin, finalTax, meli_price || 0, meli_link || "");

    console.log(`[ADMIN] Producto guardado con éxito como PENDIENTE.`);
    res.json({ success: true, id, price_calculated: finalCop });
  } catch (e) {
    console.error("[ADMIN ERROR] Falla en manual-post:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/express/approve', (req, res) => {
  const { id, title, price_offer, weight, price_cop, categoria } = req.body;
  try {
    db.prepare(`
      UPDATE products 
      SET name = ?, price_usd = ?, weight_lb = ?, price_cop_final = ?, category = ?, status = 'disponible', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(title, price_offer, weight, price_cop, categoria, id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/express/delete', (req, res) => {
  try {
    db.prepare('DELETE FROM products WHERE id = ?').run(req.body.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/express/finalize', (req, res) => {
  try {
    db.prepare("UPDATE products SET status = 'agotado' WHERE id = ?").run(req.body.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/express/leads', (req, res) => {
  try {
    const items = db.prepare("SELECT * FROM leads ORDER BY created_at DESC").all();
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/express/claims', (req, res) => {
  try {
    const items = db.prepare(`
      SELECT c.*, u.full_name as user_name, o.id as order_display_id 
      FROM claims c
      JOIN users u ON c.user_id = u.id
      JOIN orders o ON c.order_id = o.id
      ORDER BY c.created_at DESC
    `).all();
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/express/claims/status', (req, res) => {
  const { id, status } = req.body;
  try {
    db.prepare("UPDATE claims SET status = ? WHERE id = ?").run(status, id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/express/trm', (req, res) => {
  try {
    const trm = db.prepare('SELECT value FROM settings WHERE key = "trm_base"').get().value;
    res.json({ success: true, trm: parseFloat(trm) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/subscribe', (req, res) => {
  const { name, phone, email, product, link, qty, msg, is_business_import } = req.body;
  try {
    const id = 'LEAD-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    const meta = JSON.stringify({ product, link, qty });
    db.prepare(`
      INSERT INTO leads (id, full_name, phone, email, subject, message, meta_data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, phone, email || '', is_business_import ? 'business_import' : 'contact', msg || '', meta);

    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 7. CLIENTES: MIS PEDIDOS Y RECLAMOS
app.get('/api/my-orders', (req, res) => {
  const { phone } = req.query; // Buscamos por teléfono como método simple de seguimiento
  if (!phone) return res.json([]);
  try {
    const orders = db.prepare(`
      SELECT o.*, p.name as product_name, p.images as product_images
      FROM orders o
      JOIN products p ON o.product_id = p.id
      JOIN users u ON o.user_id = u.id
      WHERE u.phone = ?
      ORDER BY o.created_at DESC
    `).all(phone);

    res.json(orders.map(o => ({
      ...o,
      product_images: JSON.parse(o.product_images || '[]')
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/claims', (req, res) => {
  const { order_id, phone, type, description } = req.body;
  try {
    const user = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const id = 'CLM-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    db.prepare(`
      INSERT INTO claims (id, order_id, user_id, type, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, order_id, user.id, type, description);

    res.json({ success: true, claim_id: id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 7. PROXY DE IMÁGENES (Para evitar problemas de CORS y Mixed Content)
app.get('/api/proxy-image', async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) return res.status(400).send('URL missing');

  // Detectar Referer adecuado para burlar anti-hotlink
  let referer = '';
  try {
    if (imageUrl.includes('amazon')) referer = 'https://www.amazon.com/';
    else if (imageUrl.includes('nike')) referer = 'https://www.nike.com/';
    else if (imageUrl.includes('ebay')) referer = 'https://www.ebay.com/';
    else referer = new URL(imageUrl).origin + '/';
  } catch (e) { referer = 'https://www.google.com/'; }

  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': referer,
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site'
      },
      timeout: 15000
    });

    // Propagar tipo de contenido y cachear agresivamente
    res.set('Content-Type', response.headers['content-type']);
    res.set('Cache-Control', 'public, max-age=86400'); // Cache 24h
    res.send(response.data);
  } catch (e) {
    console.error(`[PROXY ERROR] Falló carga de: ${imageUrl} - ${e.message}`);
    // Último recurso: Redirección directa (el navegador del cliente podría tener acceso si tiene cookies)
    res.redirect(imageUrl);
  }
});

// --- TRM SYSTEM ---
let cachedTRM = { value: 4100, date: null };
async function updateTRM() {
  try {
    const res = await axios.get('https://www.datos.gov.co/resource/32sa-8pi3.json?$limit=1&$order=vigenciahasta%20DESC');
    if (res.data && res.data.length > 0) {
      cachedTRM = { value: parseFloat(res.data[0].valor), date: new Date() };
      console.log("TRM Actualizada:", cachedTRM.value);
    }
  } catch (e) {
    console.error("Error actualizando TRM:", e.message);
    // Fallback a API secundaria si falla la gubernamental
    try {
      const res2 = await axios.get('https://trm-colombia.vercel.app/api/latest');
      if (res2.data && res2.data.valor) cachedTRM = { value: parseFloat(res2.data.valor), date: new Date() };
    } catch (e2) { }
  }
}
updateTRM(); // Al iniciar
setInterval(updateTRM, 12 * 60 * 60 * 1000); // Cada 12h

app.get('/api/admin/trm', (req, res) => res.json(cachedTRM));

// 8. ADMIN EXPRESS: ANALIZAR URL (IA + SCRAPING REAL + MELI AUTO)
app.post('/api/admin/express/analyze', async (req, res) => {
  const { url } = req.body;
  console.log(`[ANALYZE] Recibida solicitud para analizar URL: ${url}`);
  try {
    // 1. Transformar y Limpiar Link
    const finalUrl = await LinkTransformer.transform(url);

    // 2. Extraer metadatos básicos por URL (Fallback)
    let hostname = 'TIENDA';
    try {
      hostname = new URL(finalUrl).hostname.replace('www.', '').split('.')[0].toUpperCase();
    } catch (e) { }

    // 3. ✨ SCRAPING REAL CON DEEPSCRAPER ✨
    let scraperResult = null;
    try {
      console.log(`[ANALYZE] Iniciando DeepScraper en: ${finalUrl}`);
      scraperResult = await DeepScraper.scrape(finalUrl);
    } catch (e) {
      console.error("[ANALYZE] Error en scraping:", e);
    }

    // RESCUE 911: Si DeepScraper falla o precio es absurdo ($1)
    if (!scraperResult || !scraperResult.offerPrice || scraperResult.offerPrice <= 1) {
      try {
        console.log("[ANALYZE] ⚠️ DeepScraper dudoso. Ejecutando Rescate Axios (Modo iPhone)...");
        const axRes = await axios.get(finalUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
          }, timeout: 5000
        });
        const h = axRes.data;
        // Intentar regex precios comunes Amazon
        const m1 = h.match(/<span class="a-offscreen">\$([\d\.]+)<\/span>/);
        const m2 = h.match(/"price":{"amount":([\d\.]+)/);
        const m3 = h.match(/class="a-price-whole">([\d\.,]+)/); // A veces sin decimales

        let rescuePrice = 0;
        if (m1) rescuePrice = parseFloat(m1[1]);
        else if (m2) rescuePrice = parseFloat(m2[1]);
        else if (m3) rescuePrice = parseFloat(m3[1].replace(/,/g, ''));

        if (rescuePrice > 1) {
          scraperResult = scraperResult || {};
          scraperResult.offerPrice = rescuePrice;
          console.log("[ANALYZE] ✅ Precio rescatado:", rescuePrice);
        }

        // Rescate Imágenes (og:image)
        if (!scraperResult || !scraperResult.images || scraperResult.images.length === 0) {
          const imgMatch = h.match(/<meta property="og:image" content="(.*?)"/);
          if (imgMatch && !imgMatch[1].includes('captcha')) {
            scraperResult = scraperResult || {};
            if (!scraperResult.images) scraperResult.images = [];
            scraperResult.images.push(imgMatch[1]);
            scraperResult.image = imgMatch[1];
            console.log("[ANALYZE] ✅ Imagen rescatada (og:image):", imgMatch[1]);
          }
        }

        // Rescate Título
        if (!scraperResult || !scraperResult.title) {
          scraperResult = scraperResult || {};
          const tMatch = h.match(/<title>(.*?)<\/title>/);
          if (tMatch) {
            let cleanT = tMatch[1].replace(/Amazon\.com: | : .*/g, '').replace(/en Amazon/gi, '').trim();
            if (cleanT.length > 5 && !cleanT.includes('Captcha')) scraperResult.title = cleanT;
            else {
              // Extraer ASIN como ultimo recurso
              const asinMatch = finalUrl.match(/\/dp\/([A-Z0-9]{10})/);
              if (asinMatch) scraperResult.title = `Producto Referencia ${asinMatch[1]}`;
            }
          }
        }
      } catch (ex) { console.error("Rescate fallido:", ex.message); }
    }

    // 4. ✨ NEW: MERCADOLIBRE AUTO-SEARCH (CONDITION=NEW) ✨
    let meliData = { price: 0, link: '' };
    const searchTitle = scraperResult?.title || "";
    if (searchTitle) {
      try {
        const cleanQuery = searchTitle.replace(/[^a-zA-Z0-9\sñÑáéíóúÁÉÍÓÚ]/g, '').split(/\s+/).slice(0, 6).join(' ');
        console.log(`[ANALYZE] Buscando competencia en ML para: "${cleanQuery}"`);
        const meliUrl = `https://api.mercadolibre.com/sites/MCO/search?q=${encodeURIComponent(cleanQuery)}&condition=new&limit=5`;

        const meliRes = await axios.get(meliUrl, { headers: { 'User-Agent': 'MasbaratoExpress/1.0' } });

        if (meliRes.data && meliRes.data.results && meliRes.data.results.length > 0) {
          const results = meliRes.data.results;
          const topN = results.slice(0, 3);
          const avgPrice = topN.reduce((acc, curr) => acc + curr.price, 0) / topN.length;
          meliData = { price: avgPrice, link: results[0].permalink };
        }
      } catch (e) {
        console.error("Error ML Auto-Search:", e.message);
        meliData.link = `https://listado.mercadolibre.com.co/${encodeURIComponent(searchTitle)}/_Condicion_Nuevo`;
      }
    }

    // 5. Procesar Resultados
    let title = scraperResult?.title || "Producto detectado";

    // LIMPIEZA FORZADA DE TÍTULO (Global)
    if (title) {
      title = title.replace(/Amazon\.com: | : .*/g, '')
        .replace(/en Amazon/gi, '')
        .replace(/\s+-\s+Amazon.*/gi, '') // " - Amazon.com"
        .trim();
    }

    let price = scraperResult?.offerPrice || 1;
    let weight = scraperResult?.weight || 4;
    let images = scraperResult?.images || [];
    let image = scraperResult?.image || (images.length > 0 ? images[0] : "https://placehold.co/400x400?text=No+Image");

    // Detección de Categoría
    let categoria = "Electrónica Premium";
    const lowText = (title + " " + finalUrl).toLowerCase();

    if (lowText.match(/watch|reloj|wearable|garmin|fitbit|smartwatch/i)) {
      categoria = "Relojes & Wearables";
      if (!scraperResult?.weight) weight = 1;
    } else if (lowText.match(/shoe|sneaker|nike|adidas|jordan|clothing|shirt|hoodie|pant|zapat|tenis|botas|camisa|ropa/i)) {
      categoria = "Lifestyle & Street";
      if (!scraperResult?.weight) weight = 3;
    } else if (lowText.match(/vitamin|suplement|proteina|collagen|salud|health|belleza|piel|skin/i)) {
      categoria = "Salud & Belleza";
      if (!scraperResult?.weight) weight = 1;
    } else if (lowText.match(/toy|juguete|fiesta|party|lego|barbie|funko|juego/i)) {
      categoria = "Juguetes & Hobbies";
    } else if (lowText.match(/laptop|computer|pc|macbook|ipad|tablet|monitor|tecno/i)) {
      categoria = "Tecnología & Cómputo";
    } else if (lowText.match(/audio|headphone|audifono|parlante|bose|sony|jbl/i)) {
      categoria = "Audio Profesional";
    } else if (lowText.match(/perfume|fragrancia|locion|cologne/i)) {
      categoria = "Perfumes Originales";
      if (!scraperResult?.weight) weight = 1;
    }

    // Generar JSON seguro para frontend
    const result = {
      url: finalUrl,
      title: title,
      price: price,
      weight: weight,
      categoria: categoria,
      image: image,
      images: images,
      tienda: "",
      meli_price: meliData.price,
      meli_link: meliData.link
    };

    console.log(`[ANALYZE] Resultado final:`, { ...result, images: `Array(${result.images.length})` });
    res.json(result);

  } catch (e) {
    console.error("[ANALYZE CRITICAL ERROR]:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/express/manual-post', (req, res) => {
  const { title, price, weight, category, url, images, margin, tax } = req.body;
  console.log(`[ADMIN] Solicitud manual-post recibida para: ${title}`);
  try {
    const getSetting = (key, fallback) => {
      const res = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
      return res ? res.value : fallback;
    };

    const trm = getSetting('trm_base', '3650');
    const trm_offset = getSetting('trm_offset', '300');
    const cost_lb = getSetting('cost_lb_default', '6');

    // Usar valores custom si vienen del frontend, si no, usar defaults
    const finalMargin = margin ? parseFloat(margin) : parseFloat(getSetting('margin_perc', '30'));
    const finalTax = tax ? parseFloat(tax) : parseFloat(getSetting('tax_usa_perc', '7'));

    console.log(`[ADMIN] Calculando precio para USD:${price} LBS:${weight} TRM:${trm} Margen:${finalMargin}% Tax:${finalTax}%`);

    // Modificar PriceEngine para aceptar overrides (o calcular manualmente aquí si PriceEngine no lo soporta)
    // Asumimos que PriceEngine soporta overrides o simulamos el objeto
    // Nota: PriceEngine.calculate usa settings internos o parámetros. Vamos a pasarle los parámetros.
    // Como PriceEngine puede no soportar 'margin_perc' en opciones, mejor forzamos el cálculo aquí o actualizamos PriceEngine.
    // Para seguridad, usaremos la lógica estándar pero inyectamos los valores.

    const settingsOverride = {
      margin_perc: finalMargin,
      tax_usa_perc: finalTax,
      min_weight_default: 4 // default
    };

    // Si PriceEngine no acepta overrides, mejor lo hacemos directo aquí para garantizar que funcione:
    const priceWithMargin = price * (1 + (finalMargin / 100));
    const priceWithTax = priceWithMargin * (1 + (finalTax / 100));
    const finalWeight = Math.max(weight + 1, 4); // +1 lb safety + min 4 lbs
    const shippingCost = finalWeight * cost_lb;
    const totalUsd = priceWithTax + shippingCost;
    const operationalTrm = parseFloat(trm) + parseFloat(trm_offset);
    const finalCop = Math.ceil((totalUsd * operationalTrm) / 1000) * 1000;

    const id = 'EXPR-' + Math.random().toString(36).substr(2, 7).toUpperCase();
    console.log(`[ADMIN] Insertando producto con ID: ${id} en estado PENDIENTE`);

    // Procesar imágenes
    let imageJson = '[]';
    try {
      if (Array.isArray(images)) imageJson = JSON.stringify(images);
      else if (typeof images === 'string') imageJson = JSON.stringify([images]);
      else imageJson = JSON.stringify(["https://placehold.co/600x600?text=No+Image"]);
    } catch (e) { console.error("Error procesando imagen para DB", e); }

    db.prepare(`
        INSERT INTO products (
            id, name, description, images, category, source_link, 
            price_usd, trm_applied, weight_lb, price_cop_final, 
            margin_perc, tax_usa_perc,
            status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')
    `).run(id, title, "Importación Express desde USA", imageJson,
      category, url, price, operationalTrm, finalWeight, finalCop,
      finalMargin, finalTax);

    console.log(`[ADMIN] Producto guardado con éxito como PENDIENTE.`);
    res.json({ success: true, id });
  } catch (e) {
    console.error("[ADMIN ERROR] Falla en manual-post:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// 9. ADMIN EXPRESS:// 11. MERCADOLIBRE SEARCH (SERVER-SIDE PROXY)
// 11. MERCADOLIBRE SEARCH (SERVER-SIDE PROXY)
app.get('/api/admin/express/search-ml', async (req, res) => {
  const { query } = req.query;
  // Mejor encabezado para evitar 403 y SOLO NUEVOS
  try {
    const meliUrl = `https://api.mercadolibre.com/sites/MCO/search?q=${encodeURIComponent(query)}&condition=new&limit=5`;
    const response = await axios.get(meliUrl, {
      headers: {
        'User-Agent': 'MasbaratoExpress/1.0 (masbaratoexpress.com)',
        'Authorization': ''
      }
    });

    if (response.data && response.data.results) {
      res.json(response.data.results.map(r => ({
        title: r.title,
        price: r.price,
        link: r.permalink,
        image: r.thumbnail
      })));
    } else {
      res.json([]);
    }
  } catch (e) {
    console.error("ML Search Error:", e.response?.status, e.message);
    res.status(200).json({
      error: true,
      fallbackLink: `https://listado.mercadolibre.com.co/${encodeURIComponent(query)}/_Condicion_Nuevo`
    });
  }
});

// --- ROUTES PARA PÁGINAS ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/web/public/index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/web/public/admin.html'));
});

app.get('/catalog', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/web/public/catalog.html'));
});

app.get('/producto', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/web/public/producto.html'));
});

app.get('/como-funciona', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/web/public/como-funciona.html'));
});

app.get('/negocios', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/web/public/negocios.html'));
});

app.get('/reseñas', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/web/public/reseñas.html'));
});

app.get('/contacto', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/web/public/contacto.html'));
});

app.get('/terminos', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/web/public/terminos.html'));
});

app.get('/privacidad', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/web/public/privacidad.html'));
});

app.get('/mis-pedidos', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/web/public/mis-pedidos.html'));
});

// Fallback to index.html for SPA behavior if needed
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/web/public/index.html'));
});

// TEMPORARY DEBUG ENDPOINT - REMOVE AFTER DIAGNOSIS
app.get('/api/debug/db-status', (req, res) => {
  try {
    const counts = db.prepare("SELECT status, COUNT(*) as count FROM products GROUP BY status").all();
    const pending = db.prepare("SELECT id, name, category, price_usd, weight_lb, source_link FROM products WHERE status = 'pendiente' LIMIT 10").all();
    const all = db.prepare("SELECT id, name, status, category FROM products").all();

    res.json({
      counts,
      pending_products: pending,
      all_products: all,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
});

// Iniciar
app.listen(PORT, () => {
  console.log(`🚀 MasbaratoExpress corriendo en puerto ${PORT}`);
});
