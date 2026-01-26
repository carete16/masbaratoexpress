const db = require('better-sqlite3')('src/database/deals.db');
const rows = db.prepare('SELECT title, price_offer, price_official, tienda, original_link FROM published_deals ORDER BY posted_at DESC LIMIT 5').all();
rows.forEach(r => {
    console.log(`TITLE: ${r.title}`);
    console.log(`PRICE: ${r.price_offer} / MSRP: ${r.price_official}`);
    console.log(`STORE: ${r.tienda}`);
    console.log(`URL: ${r.original_link}`);
    console.log('---');
});
