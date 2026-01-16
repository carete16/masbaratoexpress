const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'src/database/deals.db');
const db = new Database(dbPath);

console.log('🧹 Iniciando limpieza de base de datos...');

// 1. Limpiar "Slickdeals" de los nombres de tiendas
const fixTienda = db.prepare("UPDATE published_deals SET tienda = 'Oferta USA' WHERE LOWER(tienda) LIKE '%slickdeals%'");
const res1 = fixTienda.run();
console.log(`✅ Tiendas corregidas: ${res1.changes}`);

// 2. Limpiar "Slickdeals" de los títulos
const deals = db.prepare("SELECT id, title FROM published_deals WHERE title LIKE '%slickdeals%'").all();
let titleChanges = 0;
const updateTitle = db.prepare("UPDATE published_deals SET title = ? WHERE id = ?");

deals.forEach(deal => {
    const cleanTitle = deal.title.replace(/slickdeals/gi, '').trim();
    updateTitle.run(cleanTitle, deal.id);
    titleChanges++;
});
console.log(`✅ Títulos corregidos: ${titleChanges}`);

// 3. Limpiar "Analizando..."
const fixAnalizando = db.prepare("UPDATE published_deals SET tienda = 'Oferta USA' WHERE tienda = 'Analizando...'");
const res3 = fixAnalizando.run();
console.log(`✅ Tiendas 'Analizando' corregidas: ${res3.changes}`);

console.log('🚀 Base de datos 100% limpia de marcas de competencia.');
db.close();
