let puppeteer;
try {
    puppeteer = require('puppeteer-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    puppeteer.use(StealthPlugin());
} catch (e) {
    try {
        puppeteer = require('puppeteer');
    } catch (e2) {
        puppeteer = null;
    }
}

const logger = require('./logger');

class DeepScraper {
    async scrape(url) {
        if (!puppeteer) {
            logger.warn('⚠️ DeepScraper: Puppeteer no está instalado. Saltando extracción profunda...');
            return null;
        }

        logger.info(`🕵️ DEEP SCRAPER iniciando en: ${url}`);
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
            });

            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await new Promise(r => setTimeout(r, 2000));

            const data = await page.evaluate(() => {
                let offerPrice = 0;
                let officialPrice = 0;
                let title = "";
                let image = "";

                const clean = (txt) => txt ? parseFloat(txt.replace(/[^0-9.]/g, '')) : 0;

                if (window.location.hostname.includes('amazon.com')) {
                    title = document.querySelector('#productTitle')?.innerText.trim();
                    const op = document.querySelector('.a-price .a-offscreen')?.innerText;
                    offerPrice = clean(op);
                    const listPrice = document.querySelector('.basisPrice .a-offscreen')?.innerText ||
                        document.querySelector('.a-price.a-text-price .a-offscreen')?.innerText;
                    officialPrice = clean(listPrice);
                    image = document.querySelector('#landingImage')?.src || document.querySelector('#imgBlkFront')?.src;
                }
                else if (window.location.hostname.includes('walmart.com')) {
                    title = document.querySelector('h1')?.innerText;
                    const op = document.querySelector('[data-testid="price-at-a-glance"] .f2')?.innerText ||
                        document.querySelector('[itemprop="price"]')?.content;
                    offerPrice = clean(op);
                    const lp = document.querySelector('[data-testid="list-price"]')?.innerText ||
                        document.querySelector('.was-price-text')?.innerText;
                    officialPrice = clean(lp);
                    image = document.querySelector('[data-testid="main-image-container"] img')?.src;
                }

                return { offerPrice, officialPrice, title, image };
            });

            await browser.close();
            return data;

        } catch (error) {
            logger.error(`❌ DeepScraper Error: ${error.message}`);
            if (browser) await browser.close();
            return null;
        }
    }
}

module.exports = new DeepScraper();
