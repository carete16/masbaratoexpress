const Database = require('better-sqlite3');
const path = require('path');
const logger = require('../utils/logger');
require('dotenv').config();

// Usar el directorio actual de ejecución (root) para localizar la DB
const dbPath = path.resolve(process.cwd(), 'src/database/deals.db');

// Asegurar que el directorio existe (CRÍTICO PARA RENDER)
const fs = require('fs');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

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
        description TEXT,
        coupon TEXT,
        status TEXT DEFAULT 'published',
        posted_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

  // --- MIGRACIONES AUTOMÁTICAS ---
  try { db.exec("ALTER TABLE published_deals ADD COLUMN original_link TEXT"); } catch (e) { }
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_original_link ON published_deals(original_link)"); } catch (e) { }
  try { db.exec("ALTER TABLE published_deals ADD COLUMN description TEXT"); } catch (e) { }
  try { db.exec("ALTER TABLE published_deals ADD COLUMN coupon TEXT"); } catch (e) { }
  try { db.exec("ALTER TABLE published_deals ADD COLUMN status TEXT DEFAULT 'published'"); } catch (e) { }
  try { db.exec("ALTER TABLE published_deals ADD COLUMN is_historic_low BOOLEAN DEFAULT 0"); } catch (e) { }
  try { db.exec("ALTER TABLE published_deals ADD COLUMN score INTEGER DEFAULT 0"); } catch (e) { }
  try { db.exec("ALTER TABLE published_deals ADD COLUMN votes_up INTEGER DEFAULT 0"); } catch (e) { }
  try { db.exec("ALTER TABLE published_deals ADD COLUMN votes_down INTEGER DEFAULT 0"); } catch (e) { }
  try { db.exec("ALTER TABLE published_deals ADD COLUMN comment_count INTEGER DEFAULT 0"); } catch (e) { }
  try { db.exec("ALTER TABLE published_deals ADD COLUMN price_cop REAL DEFAULT 0"); } catch (e) { }
  try { db.exec("ALTER TABLE published_deals ADD COLUMN weight REAL DEFAULT 0"); } catch (e) { }

  // --- TABLAS EXTRA ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deal_id TEXT,
      author TEXT,
      text TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(deal_id) REFERENCES published_deals(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      name TEXT,
      phone TEXT,
      telegram TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'active'
    )
  `);

  // Migraciones para suscriptores
  try { db.exec("ALTER TABLE subscribers ADD COLUMN name TEXT"); } catch (e) { }
  try { db.exec("ALTER TABLE subscribers ADD COLUMN phone TEXT"); } catch (e) { }
  try { db.exec("ALTER TABLE subscribers ADD COLUMN telegram TEXT"); } catch (e) { }

} catch (error) {
  logger.error(`❌ Error Crítico DB: ${error.message}. Usando base de datos temporal.`);
  db = new Database(':memory:');
}

const addSubscriber = (email, name = '', phone = '', telegram = '') => {
  return db.prepare('INSERT OR REPLACE INTO subscribers (email, name, phone, telegram) VALUES (?, ?, ?, ?)').run(email, name, phone, telegram);
};

const voteUp = (id) => {
  return db.prepare('UPDATE published_deals SET votes_up = votes_up + 1, score = score + 5 WHERE id = ?').run(id);
};

const addComment = (dealId, author, text) => {
  const stmt = db.prepare('INSERT INTO comments (deal_id, author, text) VALUES (?, ?, ?)');
  stmt.run(dealId, author || 'Anónimo', text);
  db.prepare('UPDATE published_deals SET comment_count = comment_count + 1 WHERE id = ?').run(dealId);
};

const getComments = (dealId) => {
  return db.prepare('SELECT * FROM comments WHERE deal_id = ? ORDER BY created_at ASC').all(dealId);
};

const saveDeal = (deal) => {
  const isPending = deal.status === 'pending_express';

  // --- SEGURIDAD RELAJADA PARA PENDIENTES ---
  if (!isPending) {
    if (deal.price_offer > 10000 && !deal.title?.toLowerCase().includes('car')) {
      logger.warn(`🚫 BLOQUEO: Precio sospechoso ($${deal.price_offer}) para "${deal.title}".`);
      return false;
    }
    if (!deal.image || deal.image.includes('favicon') || deal.image.includes('placehold.co')) {
      logger.warn(`🚫 BLOQUEO: Imagen inválida.`);
      return false;
    }
  } else {
    // Si es pendiente y no tiene imagen, poner una por defecto para que no falle el insert
    if (!deal.image) deal.image = 'https://placehold.co/400?text=Masbarato+Express';
  }

  try {
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO published_deals 
        (id, link, original_link, title, price_official, price_offer, image, tienda, categoria, description, coupon, is_historic_low, score, status, price_cop, weight)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
    return stmt.run(
      deal.id,
      deal.link,
      deal.original_link || deal.link,
      deal.title,
      deal.price_official || 0,
      deal.price_offer || 0,
      deal.image,
      deal.tienda || 'Oferta USA',
      deal.categoria || 'Oferta',
      deal.description || '',
      deal.coupon || null,
      (deal.is_historic_low) ? 1 : 0,
      deal.score || 0,
      deal.status || 'published',
      deal.price_cop || 0,
      deal.weight || 0
    );
  } catch (e) {
    logger.error(`Error guardando: ${e.message}`);
  }
};

const registerClick = (dealId) => {
  try { db.prepare("UPDATE published_deals SET clicks = clicks + 1 WHERE id = ?").run(dealId); } catch (e) { }
};

const isRecentlyPublished = (link, title = '') => {
  try {
    const byOrig = db.prepare(`SELECT * FROM published_deals WHERE (original_link = ? OR link = ?) AND posted_at > datetime('now', '-168 hours')`);
    if (byOrig.get(link, link)) return true;
    if (title) {
      const cleanTitle = title.toLowerCase().trim().substring(0, 45);
      const byTitle = db.prepare(`SELECT * FROM published_deals WHERE LOWER(SUBSTR(title, 1, 45)) = ? AND posted_at > datetime('now', '-168 hours')`);
      if (byTitle.get(cleanTitle)) return true;
    }
    return false;
  } catch (e) { return false; }
};

module.exports = { db, saveDeal, isRecentlyPublished, registerClick, voteUp, addComment, getComments, addSubscriber };
