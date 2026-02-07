const { db } = require('./src/database/db');
try {
    const deals = db.prepare("SELECT id, title, status, categoria, price_cop FROM published_deals LIMIT 50").all();
    console.log(JSON.stringify(deals, null, 2));
} catch (e) {
    console.error(e);
}
