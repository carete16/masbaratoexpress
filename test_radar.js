const Bot1 = require('./src/core/Bot1_Scraper');
async function test() {
    const opportunities = await Bot1.getMarketOpportunities();
    console.log(JSON.stringify(opportunities.slice(0, 5), null, 2));
}
test();
