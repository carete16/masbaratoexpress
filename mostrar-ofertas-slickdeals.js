#!/usr/bin/env node

/**
 * 🔍 MOSTRAR OFERTAS QUE EL BOT ESTÁ TOMANDO
 * 
 * IMPORTANTE: El bot usa Reddit r/deals como fuente principal
 * (más estable que Slickdeals directo)
 */

const SlickdealsCollector = require('./src/collectors/SlickdealsCollector');
const logger = require('./src/utils/logger');

console.log('\n🔍 ========================================');
console.log('   OFERTAS QUE EL BOT ESTÁ TOMANDO');
console.log('========================================\n');

console.log('📝 FUENTE: Reddit r/deals (Ofertas USA)');
console.log('   (Más estable que Slickdeals directo)\n');

async function showSlickdealsOffers() {
    try {
        console.log('📡 Conectando a Reddit r/deals...\n');

        const deals = await SlickdealsCollector.getDeals();

        console.log(`✅ Se encontraron ${deals.length} ofertas\n`);
        console.log('========================================\n');

        if (deals.length === 0) {
            console.log('⚠️  No se encontraron ofertas en este momento.');
            console.log('   Esto puede ser normal si:');
            console.log('   - No hay ofertas nuevas en Slickdeals');
            console.log('   - El feed RSS está temporalmente vacío');
            console.log('   - Hay problemas de conexión\n');
            return;
        }

        deals.forEach((deal, index) => {
            console.log(`📦 OFERTA ${index + 1}/${deals.length}`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

            console.log(`📌 TÍTULO:`);
            console.log(`   ${deal.title}\n`);

            console.log(`🔗 LINK ORIGINAL (Slickdeals):`);
            console.log(`   ${deal.link}\n`);

            if (deal.price_official) {
                console.log(`💰 PRECIO OFICIAL: $${deal.price_official}`);
            }

            if (deal.price_offer) {
                console.log(`🔥 PRECIO OFERTA: $${deal.price_offer}`);
            }

            if (deal.price_official && deal.price_offer) {
                const discount = Math.round(((deal.price_official - deal.price_offer) / deal.price_official) * 100);
                console.log(`📉 DESCUENTO: ${discount}%`);
            }

            if (deal.tienda) {
                console.log(`🏪 TIENDA: ${deal.tienda}`);
            }

            if (deal.categoria) {
                console.log(`📂 CATEGORÍA: ${deal.categoria}`);
            }

            if (deal.score) {
                console.log(`⭐ SCORE: ${deal.score}`);
            }

            if (deal.image) {
                console.log(`🖼️  IMAGEN: ${deal.image.substring(0, 60)}...`);
            }

            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        });

        console.log('========================================');
        console.log('   RESUMEN');
        console.log('========================================\n');

        const amazonDeals = deals.filter(d => d.tienda && d.tienda.toLowerCase().includes('amazon'));
        const ebayDeals = deals.filter(d => d.tienda && d.tienda.toLowerCase().includes('ebay'));
        const walmartDeals = deals.filter(d => d.tienda && d.tienda.toLowerCase().includes('walmart'));
        const otherDeals = deals.filter(d => !d.tienda || (!d.tienda.toLowerCase().includes('amazon') && !d.tienda.toLowerCase().includes('ebay') && !d.tienda.toLowerCase().includes('walmart')));

        console.log(`📊 Total de ofertas: ${deals.length}`);
        console.log(`   🛒 Amazon: ${amazonDeals.length}`);
        console.log(`   🛒 eBay: ${ebayDeals.length}`);
        console.log(`   🛒 Walmart: ${walmartDeals.length}`);
        console.log(`   🛒 Otras: ${otherDeals.length}\n`);

        const avgDiscount = deals
            .filter(d => d.price_official && d.price_offer)
            .map(d => ((d.price_official - d.price_offer) / d.price_official) * 100)
            .reduce((a, b) => a + b, 0) / deals.filter(d => d.price_official && d.price_offer).length;

        if (!isNaN(avgDiscount)) {
            console.log(`💰 Descuento promedio: ${avgDiscount.toFixed(1)}%\n`);
        }

        console.log('📝 NOTA: Estas son las ofertas RAW de Slickdeals.');
        console.log('   El filtro anti-competencia las procesará así:');
        console.log('   1. Extraerá el link directo a Amazon/eBay/Walmart');
        console.log('   2. Agregará tu tag de afiliado');
        console.log('   3. Eliminará toda referencia a "Slickdeals"');
        console.log('   4. Publicará solo las que pasen los filtros\n');

    } catch (error) {
        console.error('❌ Error obteniendo ofertas:', error.message);
        console.log('\n⚠️  Posibles causas:');
        console.log('   - Slickdeals bloqueó la conexión');
        console.log('   - Problemas de red');
        console.log('   - El feed RSS cambió de formato\n');
    }
}

showSlickdealsOffers();
