const db = require('./src/database/db').db;

function cleanup() {
    console.log("🚀 Starting Database Surgery...");

    // 1. Eliminar precios basura
    const r1 = db.prepare("DELETE FROM published_deals WHERE price_offer < 1 OR price_offer > 5000").run();
    console.log(`Cleaned ${r1.changes} extremely low/high prices.`);

    // 2. Eliminar ofertas donde el MSRP es absurdo (más de 10x el precio de oferta)
    // EXCEPTO si el precio de oferta es muy bajo (ej: < 5) donde 10x es posible.
    const r2 = db.prepare("DELETE FROM published_deals WHERE price_offer > 10 AND price_official > (price_offer * 15)").run();
    console.log(`Cleaned ${r2.changes} deals with absurd MSRP comparisons.`);

    // 3. Redondear precios existentes
    const deals = db.prepare("SELECT id, price_offer, price_official FROM published_deals").all();
    let updated = 0;
    for (const d of deals) {
        const newOffer = Math.round(d.price_offer * 100) / 100;
        const newOfficial = Math.round(d.price_official * 100) / 100;
        if (newOffer !== d.price_offer || newOfficial !== d.price_official) {
            db.prepare("UPDATE published_deals SET price_offer = ?, price_official = ? WHERE id = ?").run(newOffer, newOfficial, d.id);
            updated++;
        }
    }
    console.log(`Rounded ${updated} prices to 2 decimals.`);

    console.log("✅ Surgery Complete.");
}

cleanup();
