const scraper = require('./src/collectors/SlickdealsProScraper');
const QA = require('./src/utils/QualityAssurance');
const LinkTransformer = require('./src/utils/LinkTransformer');

async function debugFlow() {
    console.log('🔍 INICIANDO DEPURACIÓN DE FLUJO...\n');

    try {
        console.log('1. Probando Scraper...');
        const rawDeals = await scraper.getFrontpageDeals();
        console.log(`✅ Scraper obtuvo ${rawDeals.length} ofertas.`);

        if (rawDeals.length === 0) {
            console.log('❌ El scraper no está obteniendo nada. Posible cambio de HTML en Slickdeals o bloqueo.');
            return;
        }

        console.log('\n2. Analizando la primera oferta...');
        let deal = rawDeals[0];
        console.log(`📌 Título: ${deal.title}`);
        console.log(`📌 Link Original: ${deal.link}`);

        console.log('\n3. Probando Bypass y Monetización...');
        const monetizedLink = await LinkTransformer.transform(deal.link);
        console.log(`📌 Link Monetizado: ${monetizedLink}`);

        if (!monetizedLink || monetizedLink.includes('slickdeals.net')) {
            console.log('❌ FALLO DE MONETIZACIÓN: El link sigue siendo de Slickdeals o es nulo.');
            return;
        }

        console.log('\n4. Probando Sistema de QA...');
        deal.link = monetizedLink;
        const qaResult = await QA.validateOffer(deal);
        console.log(`✅ Resultado QA: ${qaResult.passed ? 'APROBADA' : 'RECHAZADA'}`);
        console.log('Reporte QA:\n', qaResult.report);

    } catch (error) {
        console.error('❌ ERROR DURANTE DEPURACIÓN:', error);
    }
}

debugFlow();
