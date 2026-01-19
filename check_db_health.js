const db = require('better-sqlite3')('deals.db');
try {
    const count = db.prepare('SELECT COUNT(*) as total FROM published_deals').get();
    console.log(`✅ Base de datos lista. Ofertas actuales: ${count.total}`);
} catch (e) {
    console.log("❌ Error leyendo la tabla. Recreado tabla...");
    db.prepare(`CREATE TABLE IF NOT EXISTS published_deals (
        id TEXT PRIMARY KEY,
        title TEXT,
        price_offer REAL,
        price_official REAL,
        link TEXT,
        image TEXT,
        tienda TEXT,
        categoria TEXT,
        coupon TEXT,
        score INTEGER,
        viralContent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run();
    console.log("✅ Tabla regenerada.");
}
process.exit();
