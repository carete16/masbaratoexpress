const Database = require('better-sqlite3');
const path = require('path');
const logger = require('../utils/logger');
require('dotenv').config();

// Usar el directorio actual de ejecución (root) para localizar la DB
const dbPath = path.resolve(process.cwd(), 'src/database/deals.db');

let db;
try {
  db = new Database(dbPath);
  logger.info(`💾 Base de datos conectada en: ${dbPath}`);

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
} catch (error) {
  logger.error(`❌ Error Crítico DB: ${error.message}. Usando base de datos temporal.`);
  db = new Database(':memory:');
}

const saveDeal = (deal) => {
  try {
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
  } catch (e) {
    logger.error(`Error guardando: ${e.message}`);
  }
};

const registerClick = (dealId) => {
  try {
    db.prepare("UPDATE published_deals SET clicks = clicks + 1 WHERE id = ?").run(dealId);
  } catch (e) {
    logger.error(`Error click: ${e.message}`);
  }
};

const isRecentlyPublished = (link, title = '') => {
  try {
    // Check by link (primary)
    const byLink = db.prepare(`SELECT * FROM published_deals WHERE link = ? AND posted_at > datetime('now', '-168 hours')`);
    if (byLink.get(link)) return true;

    // Check by title similarity (secondary - prevent same product with different link)
    if (title) {
      const cleanTitle = title.toLowerCase().trim().substring(0, 50); // First 50 chars
      const byTitle = db.prepare(`SELECT * FROM published_deals WHERE LOWER(SUBSTR(title, 1, 50)) = ? AND posted_at > datetime('now', '-168 hours')`);
      if (byTitle.get(cleanTitle)) return true;
    }

    return false;
  } catch (e) {
    return false;
  }
};

module.exports = { db, saveDeal, isRecentlyPublished, registerClick };
