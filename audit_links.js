const Database = require('better-sqlite3');
const db = new Database('src/database/deals.db');
const row = db.prepare('SELECT title, link FROM published_deals ORDER BY posted_at DESC LIMIT 1').get();
if (row) {
    console.log('--- AUDITORÍA DE ÚLTIMA OFERTA ---');
    console.log('Título:', row.title);
    console.log('Link:', row.link);
    const isMonetized = row.link.includes('masbaratodeal-20') || row.link.includes('viglink') || row.link.includes('redirect');
    console.log('Estado Monetización:', isMonetized ? '✅ OK (Monetizado)' : '❌ ERROR (No Monetizado)');
} else {
    console.log('Base de datos vacía');
}
db.close();
