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
        console.log(`[Scraper] Navigating to: ${targetUrl}`);
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
            });
            const page = await browser.newPage();
            page.on('console', msg => console.log(`[Browser] ${msg.text()}`));
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
                // Forzamos cookies de EE.UU. de forma agresiva
                await page.setCookie(
                    { name: 'sp-cdn', value: '"L5Z9:US"', domain: '.amazon.com' },
                    { name: 'i18n-prefs', value: 'USD', domain: '.amazon.com' },
                    { name: 'lc-main', value: 'en_US', domain: '.amazon.com' },
                    { name: 'skin', value: 'noskin', domain: '.amazon.com' }
                );
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
                    // Eliminar símbolos de moneda y espacios
                    let raw = txt.replace(/[^0-9,.]/g, '').trim();

                    // LÓGICA INTELIGENTE DE SEPARADORES:
                    if (raw.includes('.') && raw.includes(',')) {
                        const lastDot = raw.lastIndexOf('.');
                        const lastComma = raw.lastIndexOf(',');
                        if (lastDot > lastComma) { // Formato US: 1,234.56
                            raw = raw.replace(/,/g, '');
                        } else { // Formato EU/LATAM: 1.234,56
                            raw = raw.replace(/\./g, '').replace(',', '.');
                        }
                    } else if (raw.includes(',')) { // Solo comas (ej: 19,99 o 1,000)
                        const parts = raw.split(',');
                        if (parts[parts.length - 1].length <= 2) {
                            raw = raw.replace(',', '.');
                        } else {
                            raw = raw.replace(/,/g, '');
                        }
                    }

                    return parseFloat(raw) || 0;
                };

                const bodyText = document.body.innerText.toLowerCase();

                // Detector de stock
                if (bodyText.includes('out of stock') || bodyText.includes('currently unavailable') || bodyText.includes('agotado')) {
                    isUnavailable = true;
                }

                // --- BYPASS SLICKDEALS (Si caemos en su landing en vez de redirigir) ---
                if (window.location.hostname.includes('slickdeals.net')) {
                    let seeDealBtn = document.querySelector('a.buyNow, a.seeDeal, .dealBuyButton, a[data-type="deal-button"], .buy-now-button, button.buyNow');

                    if (!seeDealBtn) {
                        // Buscar por texto si los selectores fallan
                        const allButtons = Array.from(document.querySelectorAll('a, button'));
                        seeDealBtn = allButtons.find(el => {
                            const txt = el.innerText.toLowerCase();
                            return txt.includes('see deal') || txt.includes('buy now') || txt.includes('get deal') || txt.includes('tienda');
                        });
                    }

                    if (seeDealBtn) {
                        console.log('[Scraper] Bypassing Slickdeals: Button found with text: ' + seeDealBtn.innerText);
                        if (seeDealBtn.href) {
                            window.location.href = seeDealBtn.href;
                        } else {
                            seeDealBtn.click();
                        }
                        return { isRedirecting: true };
                    } else {
                        console.log('[Scraper] Warning: No "See Deal" button found on Slickdeals page.');
                    }
                }
                if (window.location.hostname.includes('amazon.com')) {
                    title = document.querySelector('#productTitle')?.innerText.trim();

                    const opElement = document.querySelector('#corePrice_feature_div .a-offscreen') ||
                        document.querySelector('#corePriceDisplay_desktop_feature_div .a-offscreen') ||
                        document.querySelector('.a-price .a-offscreen') ||
                        document.querySelector('.apexPriceToPay .a-offscreen') ||
                        document.querySelector('#priceblock_ourprice') ||
                        document.querySelector('.a-price-whole');

                    let opText = opElement?.innerText || opElement?.textContent || "";
                    console.log(`[Scraper] RAW Amazon Price Text: "${opText}"`);
                    if (!opText && document.querySelector('.a-price-whole')) {
                        opText = document.querySelector('.a-price-whole').innerText + '.' +
                            (document.querySelector('.a-price-fraction')?.innerText || '00');
                    }
                    offerPrice = clean(opText);

                    // --- ELIMINADA CONVERSIÓN COLOMBIA 4000 ---
                    // No dividimos por 4000. Los precios deben ser reales en USD.

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

                    const buyButtons = document.querySelector('#add-to-cart-button, #buy-now-button, [name="submit.add-to-cart"], [name="submit.buy-now"], .a-button-stack');
                    const hasBuyButton = buyButtons && buyButtons.offsetParent !== null;

                    if (!hasBuyButton && !bodyText.includes('in stock') && !bodyText.includes('available')) {
                        isUnavailable = true;
                    }

                }
                else if (window.location.hostname.includes('walmart.com')) {
                    title = document.querySelector('h1')?.innerText;
                    const op = document.querySelector('[data-testid="price-at-a-glance"] .f2')?.innerText ||
                        document.querySelector('[itemprop="price"]')?.content;
                    offerPrice = clean(op);

<<<<<<< HEAD
                    const lp = document.querySelector('.price--was')?.innerText || document.querySelector('[data-testid="list-price"]')?.innerText;
=======
                    const lp = document.querySelector('[data-testid="list-price"]')?.innerText ||
                        document.querySelector('.price--was')?.innerText;
>>>>>>> origin/experimental-features
                    officialPrice = clean(lp);

                    image = document.querySelector('[data-testid="main-image-container"] img')?.src;

                    const walmartDesc = document.querySelector('[data-testid="product-overview"]')?.innerText ||
                        document.querySelector('.product-description')?.innerText || '';
                    description = walmartDesc.substring(0, 400);
                }
                else if (window.location.hostname.includes('ebay.com')) {
<<<<<<< HEAD
                    title = document.querySelector('.x-item-title__mainTitle span')?.innerText || document.querySelector('#itemTitle')?.innerText;
                    const op = document.querySelector('.x-price-primary span')?.innerText ||
                        document.querySelector('.display-price')?.innerText ||
                        document.querySelector('#prcIsum')?.innerText;
                    offerPrice = clean(op);
=======
                    title = document.querySelector('.x-item-title__mainTitle span')?.innerText;
                    const op = document.querySelector('.x-price-primary span')?.innerText;
                    offerPrice = clean(op);

                    const lp = document.querySelector('.x-additional-info__text-strike span')?.innerText ||
                        document.querySelector('.ux-textspans--STRIKETHROUGH')?.innerText;
                    officialPrice = clean(lp);

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
>>>>>>> origin/experimental-features

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

                if (image && (image.includes('favicon') || image.includes('slickdeals.net/favicon') || image.includes('logo'))) {
                    image = "";
                }

                return { offerPrice, officialPrice, title, image, description, isUnavailable, finalUrl: window.location.href };
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
