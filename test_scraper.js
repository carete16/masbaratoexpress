const collector = require('./src/collectors/SlickRSSCollector');
const Core = require('./src/core/CoreProcessor');
const logger = require('./src/utils/logger');

async function run() {
    console.log('--- TEST SCRAPER INICIADO ---');
    try {
        const deals = await collector.getDeals();
        console.log(`Encontrados en RSS: ${deals.length}`);

        for (let d of deals.slice(0, 5)) { // Solo los primeros 5 para rapidez
            console.log(`\n🔹 Procesando: ${d.title}`);
            const success = await Core.processDeal(d);
            console.log(`   Resultado: ${success ? '✅ PUBLICADO' : '❌ OMITIDO'}`);
        }
    } catch (e) {
        console.error('ERROR GENERAL:', e);
    }
    console.log('\n--- TEST FINALIZADO ---');
    process.exit();
}

run();
