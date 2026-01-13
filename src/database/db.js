const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const dbPath = path.resolve(__dirname, 'deals.db');
const db = new Database(dbPath);

// Inicializar base de datos
db.exec(`
  CREATE TABLE IF NOT EXISTS published_deals (
    id TEXT PRIMARY KEY,
    link TEXT UNIQUE,
    title TEXT,
    price_official REAL,
    price_offer REAL,
    image TEXT,
    posted_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const saveDeal = (deal) => {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO published_deals (id, link, title, price_official, price_offer, image)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(deal.id, deal.link, deal.title, deal.price_official, deal.price_offer, deal.image);
};

const isRecentlyPublished = (link) => {
  const stmt = db.prepare(`
    SELECT * FROM published_deals 
    WHERE link = ? AND posted_at > datetime('now', '-72 hours')
  `);
  return stmt.get(link) !== undefined;
};

module.exports = {
  saveDeal,
  isRecentlyPublished
};
