const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const dbPath = path.resolve(__dirname, 'deals.db');
const db = new Database(dbPath);

// Inicializar base de datos con esquema profesional
db.exec(`
  CREATE TABLE IF NOT EXISTS published_deals (
    id TEXT PRIMARY KEY,
    link TEXT UNIQUE,
    title TEXT,
    price_official REAL,
    price_offer REAL,
    image TEXT,
    tienda TEXT DEFAULT 'Amazon USA',
    categoria TEXT DEFAULT 'Tecnología',
    clicks INTEGER DEFAULT 0,
    posted_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Migraciones automáticas silenciosas
const migrate = (query) => {
  try { db.exec(query); } catch (e) { }
};

migrate("ALTER TABLE published_deals ADD COLUMN clicks INTEGER DEFAULT 0");
migrate("ALTER TABLE published_deals ADD COLUMN tienda TEXT DEFAULT 'Amazon USA'");
migrate("ALTER TABLE published_deals ADD COLUMN categoria TEXT DEFAULT 'Tecnología'");

const saveDeal = (deal) => {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO published_deals (id, link, title, price_official, price_offer, image, tienda, categoria)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(
    deal.id,
    deal.link,
    deal.title,
    deal.price_official,
    deal.price_offer,
    deal.image,
    deal.tienda || 'Amazon USA',
    deal.categoria || 'Tecnología'
  );
};

const registerClick = (dealId) => {
  const stmt = db.prepare("UPDATE published_deals SET clicks = clicks + 1 WHERE id = ?");
  return stmt.run(dealId);
};

const isRecentlyPublished = (link) => {
  const stmt = db.prepare(`
    SELECT * FROM published_deals 
    WHERE link = ? AND posted_at > datetime('now', '-168 hours')
  `);
  return stmt.get(link) !== undefined;
};

module.exports = {
  saveDeal,
  isRecentlyPublished,
  registerClick
};
