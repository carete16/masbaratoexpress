const Radar = require('./src/core/Bot1_Scraper');
const Validator = require('./src/core/Bot2_Explorer');
const logger = require('./src/utils/logger');

async function debugValidation() {
    const opportunities = await Radar.getMarketOpportunities();
    for (let opp of opportunities.slice(0, 3)) {
        console.log('\n--- VALIDANDO ---');
        console.log('Título:', opp.title);
        console.log('Ref Price:', opp.referencePrice);
        const res = await Validator.validate(opp);
        console.log('Resultado:', JSON.stringify(res, null, 2));
    }
}
debugValidation();
