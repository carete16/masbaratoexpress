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
            logger.warn('⚠️ DeepScraper: Puppeteer no está instalado.');
            return null;
        }

        // --- SOLUCIÓN ERROR DE MONEDA ---
        // Forzamos a Amazon a mostrar USD agregando el parámetro language=en_US y currency=USD
        let targetUrl = url;
        if (url.includes('amazon.com')) {
            const separator = url.includes('?') ? '&' : '?';
            targetUrl = `${url}${separator}language=en_US&currency=USD`;
        }

        logger.info(`🕵️ DEEP SCRAPER iniciando en: ${targetUrl}`);
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
            });

            const page = await browser.newPage();

            // Configurar cookies para forzar USD y USA como región
            if (targetUrl.includes('amazon.com')) {
                await page.setCookie({
                    name: 'sp-cdn',
                    value: '"L5Z9:CO"', // Intento de forzar región, pero currency es más fiable
                    domain: '.amazon.com'
                });
            }

            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

            await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 45000 });

            const data = await page.evaluate(() => {
                let offerPrice = 0;
                let officialPrice = 0;
                let title = "";
                let image = "";
                let description = "";
                let isUnavailable = false;

                const clean = (txt) => {
                    if (!txt) return 0;
                    const cleaned = txt.replace(/[^0-9,.]/g, '').replace(',', '');
                    return parseFloat(cleaned) || 0;
                };

                const bodyText = document.body.innerText.toLowerCase();

                // Detector de stock
                if (bodyText.includes('out of stock') || bodyText.includes('currently unavailable') || bodyText.includes('agotado')) {
                    isUnavailable = true;
                }

                if (window.location.hostname.includes('amazon.com')) {
                    title = document.querySelector('#productTitle')?.innerText.trim();

                    const opElement = document.querySelector('.a-price .a-offscreen') ||
                        document.querySelector('#priceblock_ourprice') ||
                        document.querySelector('#priceblock_dealprice');

                    const opText = opElement?.innerText || "";
                    offerPrice = clean(opText);

                    if (offerPrice > 5000 && (title.toLowerCase().includes('lego') || title.toLowerCase().includes('toy'))) {
                        offerPrice = offerPrice / 4000;
                    }

                    const lp = document.querySelector('.basisPrice .a-offscreen')?.innerText ||
                        document.querySelector('.a-price.a-text-price .a-offscreen')?.innerText;
                    officialPrice = clean(lp);

                    image = document.querySelector('#landingImage')?.src || document.querySelector('#main-image')?.src;

                    // EXTRAER DESCRIPCIÓN DEL PRODUCTO
                    const features = Array.from(document.querySelectorAll('#feature-bullets li'))
                        .map(li => li.innerText.trim())
                        .filter(t => t.length > 0)
                        .slice(0, 5);

                    const productDesc = document.querySelector('#productDescription p')?.innerText.trim() || '';
                    const aboutItem = document.querySelector('#featurebullets_feature_div')?.innerText.trim() || '';

                    if (features.length > 0) {
                        description = features.join('\n');
                    } else if (productDesc) {
                        description = productDesc.substring(0, 400);
                    } else if (aboutItem) {
                        description = aboutItem.substring(0, 400);
                    }

                    if (!document.querySelector('#add-to-cart-button') && !document.querySelector('#buy-now-button')) {
                        isUnavailable = true;
                    }
                }
                else if (window.location.hostname.includes('walmart.com')) {
                    title = document.querySelector('h1')?.innerText;
                    const op = document.querySelector('[data-testid="price-at-a-glance"] .f2')?.innerText ||
                        document.querySelector('[itemprop="price"]')?.content;
                    offerPrice = clean(op);
                    image = document.querySelector('[data-testid="main-image-container"] img')?.src;

                    // EXTRAER DESCRIPCIÓN
                    const walmartDesc = document.querySelector('[data-testid="product-overview"]')?.innerText ||
                        document.querySelector('.product-description')?.innerText || '';
                    description = walmartDesc.substring(0, 400);
                }
                else if (window.location.hostname.includes('ebay.com')) {
                    title = document.querySelector('.x-item-title__mainTitle span')?.innerText;
                    const op = document.querySelector('.x-price-primary span')?.innerText;
                    offerPrice = clean(op);
                    image = document.querySelector('.ux-image-magnify__image--main')?.src || document.querySelector('#icImg')?.src;
                    isUnavailable = bodyText.includes('this item is out of stock') || bodyText.includes('ended');
                }
                else if (window.location.hostname.includes('bestbuy.com')) {
                    title = document.querySelector('.heading-container h1')?.innerText;
                    const op = document.querySelector('.priceView-customer-price span')?.innerText;
                    offerPrice = clean(op);
                    const listP = document.querySelector('.pricing-price__regular-price')?.innerText;
                    officialPrice = clean(listP);
                    image = document.querySelector('.main-media-container img')?.src;
                    isUnavailable = bodyText.includes('sold out') || bodyText.includes('unavailable');
                }
                else if (window.location.hostname.includes('target.com')) {
                    title = document.querySelector('[data-test="product-title"]')?.innerText;
                    const op = document.querySelector('[data-test="product-price"]')?.innerText;
                    offerPrice = clean(op);
                    const listP = document.querySelector('[data-test="reg-price-strike"]') || document.querySelector('.h-text-strikethrough');
                    officialPrice = clean(listP?.innerText);
                    image = document.querySelector('[data-test="product-image"] img')?.src;
                    isUnavailable = bodyText.includes('out of stock') || bodyText.includes('sold out');
                }
                else if (window.location.hostname.includes('newegg.com')) {
                    title = document.querySelector('.product-title')?.innerText;
                    const op = document.querySelector('.price-current strong')?.innerText;
                    const opCents = document.querySelector('.price-current sup')?.innerText;
                    offerPrice = clean(`${op}${opCents}`);
                    image = document.querySelector('.product-view-img-container img')?.src;
                    isUnavailable = bodyText.includes('out of stock') || bodyText.includes('sold out');
                }

                return { offerPrice, officialPrice, title, image, description, isUnavailable };
            });

            await browser.close();

            // Verificación final de seguridad en el backend
            if (data && data.offerPrice > 5000 && !url.includes('car') && !url.includes('house')) {
                logger.warn(`⚠️ Precio detectado sospechosamente alto ($${data.offerPrice}). Posible error de moneda regional.`);
                // No lo marcamos como válido para evitar el spam de $200k
                data.offerPrice = 0;
            }

            return data;

        } catch (error) {
            logger.error(`❌ DeepScraper Error: ${error.message}`);
            if (browser) await browser.close();
            return null;
        }
    }
}

module.exports = new DeepScraper();
