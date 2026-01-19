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
                let isUnavailable = false;

                const clean = (txt) => {
                    if (!txt) return 0;
                    // --- DETECTOR DE MONEDA NO USD ---
                    // Si el texto contiene COP, EUR, MXN, etc., y no hemos logrado forzar USD
                    // tratamos de identificarlo.
                    const val = txt.toUpperCase();
                    if (val.includes('COP') || val.includes('CLP') || val.includes('ARS')) {
                        // Si está en pesos colombianos/chilenos, el valor será altísimo.
                        // La mejor forma es limpiar y luego validar en el bot2.
                    }

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

                    // Asegurarnos de que estamos leyendo el precio en el formato correcto
                    // Amazon a veces pone el símbolo después o usa formatos regionales
                    const opElement = document.querySelector('.a-price .a-offscreen') ||
                        document.querySelector('#priceblock_ourprice') ||
                        document.querySelector('#priceblock_dealprice');

                    const opText = opElement?.innerText || "";
                    offerPrice = clean(opText);

                    // Si el precio capturado es ridículamente alto (ej: > 10000 para un juguete)
                    // es probable que sea un error de moneda regional (COP)
                    if (offerPrice > 5000 && (title.toLowerCase().includes('lego') || title.toLowerCase().includes('toy'))) {
                        // Intento de emergencia: buscar un valor más pequeño en la página
                        offerPrice = offerPrice / 4000; // Conversión muy bruta si falló el parámetro USD
                    }

                    const lp = document.querySelector('.basisPrice .a-offscreen')?.innerText ||
                        document.querySelector('.a-price.a-text-price .a-offscreen')?.innerText;
                    officialPrice = clean(lp);

                    image = document.querySelector('#landingImage')?.src || document.querySelector('#main-image')?.src;

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
                }

                return { offerPrice, officialPrice, title, image, isUnavailable };
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
