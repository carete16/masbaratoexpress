const Database = require('better-sqlite3');
const db = new Database('src/database/deals.db');

try {
    const info = db.prepare("DELETE FROM published_deals WHERE id LIKE 'http%'").run();
    console.log(`✅ Base de datos saneada: ${info.changes} registros corruptos eliminados.`);
} catch (e) {
    console.error("Error limpieza:", e.message);
}
