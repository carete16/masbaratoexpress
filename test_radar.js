const Radar = require('./src/core/Bot1_Scraper');
async function test() {
    try {
        const opportunities = await Radar.getMarketOpportunities();
        console.log('ENCONTRADAS:', opportunities.length);
        if (opportunities.length > 0) {
            console.log(JSON.stringify(opportunities[0], null, 2));
        }
    } catch (e) {
        console.error('ERROR EN TEST:', e);
    }
}
test();
