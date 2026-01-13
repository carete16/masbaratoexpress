const RSSParser = require('rss-parser');
const axios = require('axios');
const parser = new RSSParser();

async function testEbay() {
    try {
        const response = await axios.get('https://www.ebay.com/globaldeals/feed/rss?siteid=0');
        const feed = await parser.parseString(response.data);
        const item = feed.items[0];
        console.log('Ebay Title:', item.title);
        // eBay suele poner la imagen en 'enclosure' o in content
        console.log('Enclosure:', item.enclosure);
        console.log('Content snippet includes img?', item.content.includes('<img'));
    } catch (e) {
        console.log('FAIL EBAY:', e.message);
    }
}
testEbay();
