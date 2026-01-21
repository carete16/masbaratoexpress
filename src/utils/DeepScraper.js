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
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            });

            // Forzar región USA en tiendas comunes
            if (targetUrl.includes('nike.com')) {
                await page.setCookie(
                    { name: 'NIKE_COMMERCE_COUNTRY', value: 'US', domain: '.nike.com' },
                    { name: 'NIKE_COMMERCE_LANG_LOCALE', value: 'en_US', domain: '.nike.com' },
                    { name: 'preferred_location', value: 'US', domain: '.nike.com' }
                );
                // Si es nike.com pura, forzar US
                if (!targetUrl.toLowerCase().includes('nike.com/us/')) {
                    targetUrl = targetUrl.replace('nike.com/t/', 'nike.com/us/en_us/t/');
                }
            }

            if (targetUrl.includes('amazon.com')) {
                await page.setCookie({ name: 'sp-cdn', value: '"L5Z9:CO"', domain: '.amazon.com' });
            }

            await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 50000 });

            // Cerrar posibles modales de localización (Nike, etc)
            try {
                await page.evaluate(() => {
                    const closeBtns = document.querySelectorAll('button[aria-label="Close"], .modal-close, .close-button, #hf_modal_close_btn');
                    closeBtns.forEach(b => b.click());
                });
            } catch (e) { }

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

                // --- BYPASS SLICKDEALS (Si caemos en su landing en vez de redirigir) ---
                if (window.location.hostname.includes('slickdeals.net')) {
                    const seeDealBtn = document.querySelector('a.buyNow, a.seeDeal, .dealBuyButton, a[data-type="deal-button"]');
                    if (seeDealBtn && (seeDealBtn.href || seeDealBtn.innerText.includes('See Deal'))) {
                        if (seeDealBtn.href) {
                            window.location.href = seeDealBtn.href;
                            return { isRedirecting: true };
                        }
                    }
                }

                if (window.location.hostname.includes('amazon.com')) {
                    title = document.querySelector('#productTitle')?.innerText.trim();

                    const opElement = document.querySelector('.a-price .a-offscreen') ||
                        document.querySelector('#priceblock_ourprice') ||
                        document.querySelector('#priceblock_dealprice') ||
                        document.querySelector('.a-price-whole') ||
                        document.querySelector('.priceToPay span.a-offscreen');

                    let opText = opElement?.innerText || opElement?.textContent || "";
                    if (!opText && document.querySelector('.a-price-whole')) {
                        opText = document.querySelector('.a-price-whole').innerText + '.' +
                            (document.querySelector('.a-price-fraction')?.innerText || '00');
                    }
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

                    const lp = document.querySelector('.price--was')?.innerText || document.querySelector('[data-testid="list-price"]')?.innerText;
                    officialPrice = clean(lp);

                    image = document.querySelector('[data-testid="main-image-container"] img')?.src;

                    const walmartDesc = document.querySelector('[data-testid="product-overview"]')?.innerText ||
                        document.querySelector('.product-description')?.innerText || '';
                    description = walmartDesc.substring(0, 400);
                }
                else if (window.location.hostname.includes('ebay.com')) {
                    title = document.querySelector('.x-item-title__mainTitle span')?.innerText || document.querySelector('#itemTitle')?.innerText;
                    const op = document.querySelector('.x-price-primary span')?.innerText ||
                        document.querySelector('.display-price')?.innerText ||
                        document.querySelector('#prcIsum')?.innerText;
                    offerPrice = clean(op);

                    const lp = document.querySelector('.ux-textspans--STRIKETHROUGH')?.innerText ||
                        document.querySelector('.x-additional-info__text-strike span')?.innerText ||
                        document.querySelector('.strikethrough')?.innerText ||
                        document.querySelector('#mm-saleDscPrc')?.innerText;
                    officialPrice = clean(lp);

                    image = document.querySelector('.ux-image-magnify__image--main')?.src || document.querySelector('#icImg')?.src;
                    isUnavailable = bodyText.includes('this item is out of stock') || bodyText.includes('ended');
                }
                else if (window.location.hostname.includes('nike.com')) {
                    title = document.querySelector('#pdp_product_title')?.innerText || document.querySelector('h1')?.innerText;
                    const op = document.querySelector('[data-test="product-price"]')?.innerText ||
                        document.querySelector('.is--current-price')?.innerText;
                    offerPrice = clean(op);

                    const lp = document.querySelector('[data-test="product-price-reduced"]')?.innerText ||
                        document.querySelector('.is--strikethrough')?.innerText;
                    officialPrice = clean(lp);

                    const nikeImg = document.querySelector('img[data-fade-in]') ||
                        document.querySelector('.pdp-6-grid img') ||
                        document.querySelector('picture img');
                    image = nikeImg?.src || document.querySelector('meta[property="og:image"]')?.content;
                }

                // FALLBACK UNIVERSAL (Si los selectores fallan)
                if (!image) {
                    image = document.querySelector('meta[property="og:image"]')?.content ||
                        document.querySelector('meta[name="twitter:image"]')?.content ||
                        document.querySelector('link[rel="image_src"]')?.href;
                }

                if (!title) {
                    title = document.querySelector('meta[property="og:title"]')?.content ||
                        document.querySelector('h1')?.innerText ||
                        document.title;
                }

                return { offerPrice, officialPrice, title, image, description, isUnavailable };
            });

            // Manejar redirección interna (ej: Slickdeals button click)
            if (data && data.isRedirecting) {
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => { });
                const nextUrl = page.url();
                await browser.close();
                return await this.scrape(nextUrl);
            }

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
