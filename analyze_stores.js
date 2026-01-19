const db = require('better-sqlite3')('src/database/deals.db');

console.log('\n=== ANÁLISIS DE TIENDAS PROMOCIONADAS ===\n');

const stores = db.prepare('SELECT tienda, COUNT(*) as count FROM published_deals GROUP BY tienda ORDER BY count DESC').all();

console.log('Tiendas Activas:');
stores.forEach(s => {
    console.log(`  ${s.tienda}: ${s.count} ofertas`);
});

console.log(`\nTotal de ofertas: ${db.prepare('SELECT COUNT(*) as c FROM published_deals').get().c}`);

const categories = db.prepare('SELECT categoria, COUNT(*) as count FROM published_deals GROUP BY categoria ORDER BY count DESC').all();
console.log('\nCategorías:');
categories.forEach(c => {
    console.log(`  ${c.categoria}: ${c.count} ofertas`);
});
