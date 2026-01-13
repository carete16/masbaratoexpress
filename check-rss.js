const RSSParser = require('rss-parser');
const axios = require('axios');
const parser = new RSSParser();

async function checkRSS() {
    const url = 'https://slickdeals.net/newsearch.php?mode=frontpage&threadfrequency=1d&sort=newest&runquery=1&type=all&format=rss';
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
    const response = await axios.get(url, { headers });
    const feed = await parser.parseString(response.data);
    console.log(JSON.stringify(feed.items[0], null, 2));
}

checkRSS();
