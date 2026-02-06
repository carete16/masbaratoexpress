const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'deals.db');
const db = new Database(dbPath);

// Habilitar claves foráneas
db.pragma('foreign_keys = ON');

/**
 * SCHEMA INITIALIZATION
 */
const schema = `
-- Configuración Global
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- Usuarios y Roles
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    full_name TEXT,
    phone TEXT,
    role TEXT CHECK(role IN ('cliente_persona', 'cliente_negocio', 'admin')) DEFAULT 'cliente_persona',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Productos
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    images TEXT, -- JSON array de URLs
    category TEXT CHECK(category IN ('Electrónica Premium', 'Lifestyle & Street', 'Relojes & Wearables')),
    status TEXT CHECK(status IN ('disponible', 'agotado')) DEFAULT 'disponible',
    delivery_time_est TEXT DEFAULT '10-15 días hábiles',
    warranty TEXT DEFAULT 'Garantía básica de 30 días',
    
    -- Datos Internos (Administración)
    source_link TEXT,
    price_usd REAL,
    trm_applied REAL,
    tax_usa_perc REAL DEFAULT 7.0,
    weight_lb REAL DEFAULT 4.0, -- Mínimo 4 lb por defecto
    cost_lb_usd REAL DEFAULT 6.0,
    margin_perc REAL DEFAULT 30.0,
    
    -- Calculado (Visible)
    price_cop_final INTEGER,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pedidos (Workflow 50/50 e Importación)
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    product_id TEXT,
    status TEXT CHECK(status IN ('recibido', 'comprado_usa', 'en_transito', 'en_aduana', 'listo_entrega', 'entregado')) DEFAULT 'recibido',
    
    total_amount_cop INTEGER,
    paid_amount_cop INTEGER DEFAULT 0,
    payment_status TEXT CHECK(payment_status IN ('pendiente_pago_1', 'pago_1_completado', 'pago_2_completado')) DEFAULT 'pendiente_pago_1',
    
    shipping_address TEXT,
    tracking_number TEXT,
    
    is_business_import BOOLEAN DEFAULT 0,
    business_data TEXT, -- JSON para cantidad, enlace negocio, etc.
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
);

-- Reseñas
CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    product_id TEXT,
    user_id TEXT,
    rating INTEGER CHECK(rating BETWEEN 1 AND 5),
    comment TEXT,
    is_approved BOOLEAN DEFAULT 0,
    admin_response TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Reclamos
CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY,
    order_id TEXT,
    user_id TEXT,
    type TEXT,
    description TEXT,
    evidence_urls TEXT, -- JSON array
    status TEXT CHECK(status IN ('abierto', 'en_gestion', 'resuelto', 'cerrado')) DEFAULT 'abierto',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(order_id) REFERENCES orders(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
);
`;

db.exec(schema);

// Valores iniciales por defecto si no existen
const defaultSettings = [
    ['trm_base', '3650'],
    ['trm_offset', '300'],
    ['cost_lb_default', '6'],
    ['min_weight_default', '4']
];

const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
defaultSettings.forEach(s => insertSetting.run(s));

// SEED PRODUCTS (Opcional - solo para desarrollo inicial)
const seedProducts = [
    {
        id: 'SEED-1',
        name: 'Apple Watch Series 9 GPS 41mm',
        description: 'El reloj más avanzado de Apple con sensor de oxígeno y pantalla siempre activa.',
        images: JSON.stringify(['https://m.media-amazon.com/images/I/71XvO7Z6qPL._AC_SL1500_.jpg']),
        category: 'Relojes & Wearables',
        source_link: 'https://amazon.com',
        price_usd: 329.00,
        weight_lb: 1.0,
        price_cop_final: 1545000,
        status: 'disponible'
    },
    {
        id: 'SEED-2',
        name: 'Nike Air Max Excee Mens Sneakers',
        description: 'Estilo icónico inspirado en las Air Max 90 con comodidad moderna.',
        images: JSON.stringify(['https://static.nike.com/a/images/t_PDP_1280_v1/f_auto,q_auto:eco/e9fd843e-c6e0-47bf-a859-cd9f01832049/air-max-excee-shoes-609vps.png']),
        category: 'Lifestyle & Street',
        source_link: 'https://nike.com',
        price_usd: 75.00,
        weight_lb: 4.5,
        price_cop_final: 485000,
        status: 'disponible'
    },
    {
        id: 'SEED-3',
        name: 'Logitech G PRO X Mechanical Keyboard',
        description: 'Diseño compacto tenkeyless para profesionales del gaming.',
        images: JSON.stringify(['https://resource.logitechg.com/w_692,c_limit,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/gaming/en/products/pro-keyboard/pro-keyboard-gallery-1.png?v=1']),
        category: 'Electrónica Premium',
        source_link: 'https://logitech.com',
        price_usd: 129.00,
        weight_lb: 4.0,
        price_cop_final: 720000,
        status: 'disponible'
    }
];

const insertProduct = db.prepare(`
  INSERT OR IGNORE INTO products (
    id, name, description, images, category, source_link, price_usd, weight_lb, price_cop_final, status
  ) VALUES (@id, @name, @description, @images, @category, @source_link, @price_usd, @weight_lb, @price_cop_final, @status)
`);

seedProducts.forEach(p => insertProduct.run(p));

module.exports = db;
