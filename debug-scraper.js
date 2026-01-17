const axios = require('axios');
const cheerio = require('cheerio');

const TARGET_URL = 'https://slickdeals.net/f/17983638-philips-essential-airfryer-compact-with-rapid-air-technology-4-1l-50-65-limited-sizes-colors-from-adidas?src=frontpage';

async function debug() {
    console.log(`🔍 DIAGNOSTICO DE SCRAPING para: ${TARGET_URL}`);

    // 1. INTENTO DIRECTO
    try {
        console.log('\n--- INTENTO 1: Directo (Desktop UA) ---');
        const res = await axios.get(TARGET_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            timeout: 5000
        });
        console.log(`✅ Status: ${res.status}`);
        analyzeHtml(res.data);
    } catch (e) {
        console.log(`❌ FAILED: ${e.message}`);
        if (e.response) console.log(`   Status: ${e.response.status}`);
    }

    // 2. INTENTO GOOGLE PROXY
    try {
        console.log('\n--- INTENTO 2: Google Translate Proxy ---');
        const proxy = `https://translate.google.com/translate?sl=auto&tl=en&u=${encodeURIComponent(TARGET_URL)}`;
        const res = await axios.get(proxy, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        console.log(`✅ Status: ${res.status}`);
        analyzeHtml(res.data);
    } catch (e) {
        console.log(`❌ FAILED: ${e.message}`);
    }
}

function analyzeHtml(html) {
    const $ = cheerio.load(html);
    console.log(`   HTML Size: ${html.length} chars`);

    // Buscar precio
    const price = $('.dealPrice, .price, .itemPrice').first().text().trim();
    console.log(`   Price Found: "${price}"`);

    // Buscar Buy Button
    const buyBtn = $('a.buyNow, a:contains("See Deal"), a:contains("Buy Now")');
    console.log(`   Buy Buttons: ${buyBtn.length}`);

    buyBtn.each((i, el) => {
        console.log(`   [${i}] Text: "${$(el).text().trim()}" | Href: ${$(el).attr('href')}`);
    });
}

debug();
