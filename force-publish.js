const GlobalCollector = require('./src/collectors/GlobalDealsCollector');
const CoreProcessor = require('./src/core/CoreProcessor');
const logger = require('./src/utils/logger');
const { db } = require('./src/database/db');

async function forcePublish() {
    console.log("🚨 FORZANDO PUBLICACIÓN MASIVA (GLOBAL) 🚨");

    // 1. Obtener ofertas RAW de TODAS LAS FUENTES
    const deals = await GlobalCollector.getDeals();
    console.log(`📥 Encontradas ${deals.length} ofertas en raw (Slickdeals + TechBargains + BensBargains)...`);

    // 2. Procesar (sin filtrar por fecha db para forzar re-evaluación)
    const processed = await CoreProcessor.processDeals(deals);

    console.log(`✨ ${processed.length} ofertas pasaron el filtro.`);

    if (processed.length === 0) {
        console.log("⚠️ Ninguna oferta pasó los filtros.");
        console.log("Las fuentes RSS pueden tener latencia o formatos inesperados.");
    }

    // 3. Forzar Publicación
    const Telegram = require('./src/notifiers/TelegramNotifier');

    for (const deal of processed) {
        // Doble check rápido
        const exists = db ? db.prepare('SELECT id FROM published_deals WHERE link = ?').get(deal.link) : false;
        if (exists) {
            console.log(`⏭️ Ya publicada: ${deal.title.substring(0, 30)}...`);
            continue;
        }

        console.log(`🚀 PUBLICANDO (${deal.origin}): ${deal.title}`);

        // Guardar DB
        if (db) {
            db.prepare(`
                INSERT INTO published_deals (id, title, price_offer, price_official, link, image, tienda, categoria, description, posted_at, score)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
            `).run(deal.id, deal.title, deal.price_offer, deal.price_official || 0, deal.link, deal.image, deal.tienda, deal.categoria, deal.description || '', deal.score);
        }

        // Enviar TG
        await Telegram.sendOffer(deal);

        // Pausa anti-flood
        await new Promise(r => setTimeout(r, 4000));
    }

    console.log("🏁 Proceso GLOBAL terminado.");
}

forcePublish();
