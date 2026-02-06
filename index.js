require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./src/database/db');
const PriceEngine = require('./src/core/PriceEngine');
const RadarBot = require('./src/core/Bot1_Scraper');
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
    const query = "SELECT id, name, category, price_cop_final, images, status FROM products ORDER BY created_at DESC";
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
    const trm = db.prepare('SELECT value FROM settings WHERE key = "trm_base"').get().value;
    const trm_offset = db.prepare('SELECT value FROM settings WHERE key = "trm_offset"').get().value;
    const cost_lb = db.prepare('SELECT value FROM settings WHERE key = "cost_lb_default"').get().value;

    const calc = PriceEngine.calculate({
      price_usd, weight_lb, trm, trm_offset, cost_lb_usd: cost_lb
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
  try {
    const items = db.prepare("SELECT * FROM products WHERE status = 'agotado' OR status IS NULL").all();
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/express/published', (req, res) => {
  try {
    const items = db.prepare("SELECT * FROM products WHERE status = 'disponible'").all();
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
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

// 8. ADMIN EXPRESS: ANALIZAR URL (IA MAGIC)
app.post('/api/admin/express/analyze', async (req, res) => {
  const { url } = req.body;
  try {
    // Simulación de análisis con RadarBot
    const result = {
      url: url,
      title: "Producto Detectado de USA",
      price: 99.99,
      weight: 4.5,
      categoria: "Lifestyle & Street",
      image: "https://placehold.co/400x400?text=Detecting..."
    };

    // Si la URL es de Amazon/eBay, podríamos intentar algo más real en el futuro
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/express/manual-post', (req, res) => {
  const { title, price, weight, category, url } = req.body;
  try {
    const trm = db.prepare('SELECT value FROM settings WHERE key = "trm_base"').get().value;
    const trm_offset = db.prepare('SELECT value FROM settings WHERE key = "trm_offset"').get().value;
    const cost_lb = db.prepare('SELECT value FROM settings WHERE key = "cost_lb_default"').get().value;

    const calc = PriceEngine.calculate({
      price_usd: price, weight_lb: weight, trm, trm_offset, cost_lb_usd: cost_lb
    });

    const id = 'EXPR-' + Math.random().toString(36).substr(2, 7).toUpperCase();
    db.prepare(`
        INSERT INTO products (
            id, name, description, images, category, source_link, 
            price_usd, trm_applied, weight_lb, price_cop_final, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'agotado')
    `).run(id, title, "Importación Express desde USA", JSON.stringify(["https://placehold.co/600x600?text=Express"]),
      category, url, price, calc.trm_applied, calc.weight_used, calc.final_cop);

    res.json({ success: true, id });
  } catch (e) { res.status(500).json({ error: e.message }); }
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
