require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./src/database/db');
const PriceEngine = require('./src/core/PriceEngine');
const RadarBot = require('./src/core/Bot1_Scraper');
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
    const formatted = items.map(item => {
      let tienda = 'Tienda';
      try {
        if (item.source_link && item.source_link.includes('http')) {
          tienda = new URL(item.source_link).hostname.replace('www.', '').split('.')[0];
        }
      } catch (e) { console.error("Error parsing tienda URL:", item.source_link); }

      return {
        ...item,
        price_offer: item.price_usd,
        weight: item.weight_lb,
        tienda: tienda.toUpperCase(),
        image: JSON.parse(item.images || '[]')[0] || 'https://placehold.co/400x400'
      };
    });
    res.json(formatted);
  } catch (e) {
    console.error("[ADMIN ERROR] Fallo al cargar pendientes:", e.message);
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
        price_offer: item.price_usd,
        weight: item.weight_lb,
        tienda: tienda.toUpperCase(),
        image: JSON.parse(item.images || '[]')[0] || 'https://placehold.co/400x400'
      };
    });
    res.json(formatted);
  } catch (e) {
    console.error("[ADMIN ERROR] Fallo al cargar publicadas:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/express/update', (req, res) => {
  const { id, title, price_offer, weight, price_cop, categoria } = req.body;
  try {
    db.prepare(`
      UPDATE products 
      SET name = ?, price_usd = ?, weight_lb = ?, price_cop_final = ?, category = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(title, price_offer, weight, price_cop, categoria, id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
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
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    res.set('Content-Type', response.headers['content-type']);
    res.send(response.data);
  } catch (e) {
    res.status(500).send('Error proxying image');
  }
});

// 8. ADMIN EXPRESS: ANALIZAR URL (IA MAGIC + LINK TRANSFORMER)
app.post('/api/admin/express/analyze', async (req, res) => {
  const { url } = req.body;
  console.log(`[ANALYZE] Recibida solicitud para analizar URL: ${url}`);
  try {
    // 1. Transformar y Limpiar Link (Resolución Slickdeals -> Store URL -> Afiliación propia)
    console.log(`[ANALYZE] Transformando URL: ${url}`);
    const finalUrl = await LinkTransformer.transform(url);
    console.log(`[ANALYZE] URL transformada a: ${finalUrl}`);

    // 2. Extraer metadatos básicos (Hostname de la tienda final)
    let hostname = 'Tienda';
    let productTitle = "Producto detectado";
    let categoria = "Electrónica Premium";
    let estimatedWeight = 4;

    try {
      const urlObj = new URL(finalUrl);
      hostname = urlObj.hostname.replace('www.', '').split('.')[0].toUpperCase();

      // 3. Detección inteligente de categoría basada en la tienda y URL
      const lowUrl = finalUrl.toLowerCase();

      // Amazon: Intentar extraer info del ASIN
      if (lowUrl.includes('amazon.')) {
        const asinMatch = finalUrl.match(/\/dp\/([A-Z0-9]{10})/i) || finalUrl.match(/\/gp\/product\/([A-Z0-9]{10})/i);
        if (asinMatch) {
          productTitle = `Producto Amazon ASIN: ${asinMatch[1]}`;
          console.log(`[ANALYZE] ASIN detectado: ${asinMatch[1]}`);
        }
      }

      // Categorización inteligente por keywords en URL
      if (lowUrl.match(/watch|reloj|wearable|garmin|fitbit|smartwatch/i)) {
        categoria = "Relojes & Wearables";
        estimatedWeight = 1;
      } else if (lowUrl.match(/shoe|sneaker|nike|adidas|jordan|clothing|shirt|hoodie|pant/i)) {
        categoria = "Lifestyle & Street";
        estimatedWeight = 2;
      } else if (lowUrl.match(/laptop|phone|tablet|headphone|gpu|monitor|keyboard|mouse|camera|tv|console|gaming/i)) {
        categoria = "Electrónica Premium";
        estimatedWeight = 5;
      }

    } catch (err) {
      console.error("[ANALYZE ERROR] Error parsing finalUrl:", finalUrl, err);
    }

    const result = {
      url: finalUrl,
      title: `${productTitle} en ${hostname}`,
      price: 1, // Placeholder (el admin lo ajustará)
      weight: estimatedWeight,
      categoria: categoria,
      image: "https://placehold.co/400x400?text=Scan+Complete"
    };

    console.log(`[ANALYZE] Resultado final:`, result);
    res.json(result);
  } catch (e) {
    console.error("[ANALYZE CRITICAL ERROR]:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/express/manual-post', (req, res) => {
  const { title, price, weight, category, url } = req.body;
  console.log(`[ADMIN] Solicitud manual-post recibida para: ${title}`);
  try {
    const getSetting = (key, fallback) => {
      const res = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
      return res ? res.value : fallback;
    };

    const trm = getSetting('trm_base', '3650');
    const trm_offset = getSetting('trm_offset', '300');
    const cost_lb = getSetting('cost_lb_default', '6');

    console.log(`[ADMIN] Calculando precio para USD:${price} LBS:${weight} TRM:${trm}`);
    const calc = PriceEngine.calculate({
      price_usd: price, weight_lb: weight, trm, trm_offset, cost_lb_usd: cost_lb
    });

    const id = 'EXPR-' + Math.random().toString(36).substr(2, 7).toUpperCase();
    console.log(`[ADMIN] Insertando producto con ID: ${id} en estado PENDIENTE`);

    db.prepare(`
        INSERT INTO products (
            id, name, description, images, category, source_link, 
            price_usd, trm_applied, weight_lb, price_cop_final, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')
    `).run(id, title, "Importación Express desde USA", JSON.stringify(["https://placehold.co/600x600?text=Express"]),
      category, url, price, calc.trm_applied, calc.weight_used, calc.final_cop);

    console.log(`[ADMIN] Producto guardado con éxito como PENDIENTE.`);
    res.json({ success: true, id });
  } catch (e) {
    console.error("[ADMIN ERROR] Falla en manual-post:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// 9. ADMIN EXPRESS: MERCADOLIBRE SEARCH
app.post('/api/admin/express/meli-search', async (req, res) => {
  const { title } = req.body;
  try {
    const query = encodeURIComponent(title);
    const meliUrl = `https://api.mercadolibre.com/sites/MCO/search?q=${query}&limit=5`;
    const response = await axios.get(meliUrl);

    const results = response.data.results;
    if (results.length > 0) {
      const avgPrice = results.reduce((acc, curr) => acc + curr.price, 0) / results.length;
      res.json({
        success: true,
        avgPrice,
        link: `https://listado.mercadolibre.com.co/${query}`
      });
    } else {
      res.json({ success: false });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
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

// Iniciar
app.listen(PORT, () => {
  console.log(`🚀 MasbaratoExpress corriendo en puerto ${PORT}`);
});
