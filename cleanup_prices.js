const { db } = require('./src/database/db');

async function cleanup() {
    console.log("🧹 Iniciando limpieza de productos con precio 0...");

    // 1. Identificar productos publicados con precio 0 o menor
    const badDeals = db.prepare("SELECT id, title, price_offer FROM published_deals WHERE (price_offer <= 0 OR price_offer IS NULL) AND status = 'published'").all();

    console.log(`🔍 Encontrados ${badDeals.length} productos publicados con precio inválido.`);

    if (badDeals.length > 0) {
        // 2. Moverlos a estado 'pending_express' para corrección manual
        const stmt = db.prepare("UPDATE published_deals SET status = 'pending_express' WHERE (price_offer <= 0 OR price_offer IS NULL) AND status = 'published'");
        const result = stmt.run();
        console.log(`✅ ${result.changes} productos movidos a Pendientes para revisión.`);

        badDeals.forEach(d => {
            console.log(`   - [CORREGIDO] ${d.title} (ID: ${d.id})`);
        });
    } else {
        console.log("✨ No se encontraron productos 'Vivo' con precio inválido.");
    }
}

cleanup().catch(err => console.error("❌ Error en limpieza:", err));
