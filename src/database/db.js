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

module.exports = db;
