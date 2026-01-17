const { db } = require('./src/database/db');
const LinkTransformer = require('./src/utils/LinkTransformer');

async function fixLinks() {
    console.log('🔧 INICIANDO REPARACIÓN MASIVA DE ENLACES...');

    const deals = db.prepare('SELECT * FROM published_deals').all();
    console.log(`📋 Analizando ${deals.length} ofertas...`);

    let fixed = 0;

    for (const deal of deals) {
        // Forzar detección de tienda si es genérica
        if ((!deal.tienda || deal.tienda === 'Oferta USA') && deal.title) {
            const t = deal.title.toLowerCase();
            if (t.includes('amazon')) deal.tienda = 'Amazon';
            else if (t.includes('walmart')) deal.tienda = 'Walmart';
            else if (t.includes('ebay')) deal.tienda = 'eBay';
            else if (t.includes('best buy')) deal.tienda = 'Best Buy';
        }

        // Transformar link
        const newLink = await LinkTransformer.transform(deal.link, deal);

        if (newLink !== deal.link || deal.tienda !== 'Oferta USA') {
            db.prepare('UPDATE published_deals SET link = ?, tienda = ? WHERE id = ?')
                .run(newLink, deal.tienda, deal.id);
            fixed++;
            console.log(`✅ [FIXED] ${deal.title.substring(0, 30)}... \n    -> ${newLink}`);
        }
    }

    console.log(`🏁 REPARACIÓN COMPLETADA. ${fixed} ofertas actualizadas.`);
}

fixLinks();
