const Database = require('better-sqlite3');
const db = new Database('src/database/deals.db', { readonly: true }); // Acceso solo lectura para evitar bloqueos

try {
    const row = db.prepare('SELECT id, title, price_offer, link, posted_at FROM published_deals ORDER BY posted_at DESC LIMIT 1').get();
    console.log("--- ÚLTIMA OFERTA PUBLICADA ---");
    console.log(JSON.stringify(row, null, 2));
} catch (error) {
    console.error("Error leyendo DB:", error.message);
}
