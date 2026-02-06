require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./src/database/db');
const PriceEngine = require('./src/core/PriceEngine');

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
    // Obtener config actual para el cálculo
    const trm = db.prepare('SELECT value FROM settings WHERE key = "trm_base"').get().value;
    const trm_offset = db.prepare('SELECT value FROM settings WHERE key = "trm_offset"').get().value;
    const cost_lb = db.prepare('SELECT value FROM settings WHERE key = "cost_lb_default"').get().value;

    // Calcular con el Motor de Precios
    const calc = PriceEngine.calculate({
      price_usd,
      weight_lb,
      trm,
      trm_offset,
      cost_lb_usd: cost_lb
    });

    const id = 'PROD-' + Math.random().toString(36).substr(2, 7).toUpperCase();

    db.prepare(`
            INSERT INTO products (
                id, name, description, images, category, source_link, 
                price_usd, trm_applied, weight_lb, price_cop_final
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
      id, name, description, JSON.stringify(images || []), category, source_link,
      price_usd, calc.trm_applied, calc.weight_used, calc.final_cop
    );

    res.json({ success: true, product_id: id, price_calculated: calc.final_cop });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Fallback to index.html for SPA behavior if needed
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/web/public/index.html'));
});

// Iniciar
app.listen(PORT, () => {
  console.log(`🚀 MasbaratoExpress corriendo en puerto ${PORT}`);
});
