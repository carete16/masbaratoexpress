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
                    { name: 'NIKE_COMMERCE_LANG_LOCALE', value: 'en_US', domain: '.nike.com' }
                );
            }

            if (targetUrl.includes('amazon.com')) {
                await page.setCookie(
                    { name: 'sp-cdn', value: '"L5Z9:US"', domain: '.amazon.com' },
                    { name: 'i18n-prefs', value: 'USD', domain: '.amazon.com' },
                    { name: 'lc-main', value: 'en_US', domain: '.amazon.com' }
                );
            }

            await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

            const data = await page.evaluate(() => {
                let offerPrice = 0;
                let officialPrice = 0;
                let title = "";
                let image = "";
                let description = "";
                let isUnavailable = false;
                let couponInfo = null;
                let weight = 0;

                const clean = (txt) => {
                    if (!txt) return 0;
                    let raw = txt.replace(/[^0-9,.]/g, '').trim();
                    if (raw.includes('.') && raw.includes(',')) {
                        const lastDot = raw.lastIndexOf('.');
                        const lastComma = raw.lastIndexOf(',');
                        if (lastDot > lastComma) raw = raw.replace(/,/g, '');
                        else raw = raw.replace(/\./g, '').replace(',', '.');
                    } else if (raw.includes(',')) {
                        const parts = raw.split(',');
                        if (parts[parts.length - 1].length <= 2) raw = raw.replace(',', '.');
                        else raw = raw.replace(/,/g, '');
                    }
                    return parseFloat(raw) || 0;
                };

                const bodyText = document.body.innerText.toLowerCase();
                if (bodyText.includes('out of stock') || bodyText.includes('currently unavailable') || bodyText.includes('agotado') || bodyText.includes('sold out')) {
                    isUnavailable = true;
                }

                if (window.location.hostname.includes('slickdeals.net')) {
                    // Buscar botones de "See Deal", "Buy Now", etc.
                    let seeDealBtn = document.querySelector('a.buyNow, a.seeDeal, .dealBuyButton, a[data-type="deal-button"], a[data-role="deal-button"], .blueprint .buy-now');

                    if (seeDealBtn) {
                        if (seeDealBtn.href && !seeDealBtn.href.includes('javascript')) {
                            window.location.href = seeDealBtn.href;
                            return { isRedirecting: true };
                        } else {
                            seeDealBtn.click();
                            // Esperar un poco a que ocurra el click/redir (evaluate no espera)
                            return { isRedirecting: true };
                        }
                    }
                }

                if (window.location.hostname.includes('amazon.com')) {
                    title = document.querySelector('#productTitle')?.innerText.trim();
                    const opElement = document.querySelector('#corePrice_feature_div .a-offscreen') ||
                        document.querySelector('#corePriceDisplay_desktop_feature_div .a-offscreen') ||
                        document.querySelector('.a-price .a-offscreen');
                    offerPrice = clean(opElement?.innerText || opElement?.textContent);
                    const lp = document.querySelector('.basisPrice .a-offscreen')?.innerText ||
                        document.querySelector('.a-price.a-text-price .a-offscreen')?.innerText;
                    officialPrice = clean(lp);
                    image = document.querySelector('#landingImage')?.src || document.querySelector('#main-image')?.src;

                    const features = Array.from(document.querySelectorAll('#feature-bullets li')).map(li => li.innerText.trim()).filter(t => t.length > 0).slice(0, 5);
                    description = features.join('\n');

                    // Buscar en tablas de especificaciones y bullets
                    const technicalSpecs = Array.from(document.querySelectorAll('tr, li, span, .a-list-item, .prodDetSectionEntry'));
                    for (let el of technicalSpecs) {
                        const txt = el.innerText.toLowerCase();
                        if (txt.includes('weight') || txt.includes('peso') || txt.includes('dimension') || txt.includes('ounces') || txt.includes('pounds')) {
                            const val = el.innerText;
                            const match = val.match(/(\d+\.?\d*)\s*(pounds|lbs|libra|oz|ounces|kg|gram|g\b)/i);
                            if (match) {
                                let wVal = parseFloat(match[1]);
                                let unit = match[2].toLowerCase();
                                if (unit.includes('oz')) wVal = wVal / 16;
                                if (unit.includes('kg')) wVal = wVal * 2.2;
                                if (unit.includes('gram') || (unit === 'g')) wVal = wVal / 453.6;
                                weight = wVal;
                                if (weight > 0.01) break;
                            }
                        }
                    }
                }
                else if (window.location.hostname.includes('walmart.com')) {
                    title = document.querySelector('h1')?.innerText;
                    const op = document.querySelector('[data-testid="price-at-a-glance"] .f2')?.innerText || document.querySelector('[itemprop="price"]')?.content;
                    offerPrice = clean(op);
                    const lp = document.querySelector('[data-testid="list-price"]')?.innerText || document.querySelector('.price--was')?.innerText;
                    officialPrice = clean(lp);
                    image = document.querySelector('[data-testid="main-image-container"] img')?.src;

                    // Walmart Weight (approximation)
                    const specText = document.body.innerText;
                    const wMatch = specText.match(/(\d+\.?\d*)\s*(lb|pounds)/i);
                    if (wMatch) weight = parseFloat(wMatch[1]);
                }
                else if (window.location.hostname.includes('ebay.com')) {
                    title = document.querySelector('.x-item-title__mainTitle span')?.innerText || document.querySelector('#itemTitle')?.innerText;
                    const op = document.querySelector('.x-price-primary span')?.innerText || document.querySelector('#prcIsum')?.innerText;
                    offerPrice = clean(op);
                    const lp = document.querySelector('.ux-textspans--STRIKETHROUGH')?.innerText || document.querySelector('.x-additional-info__text-strike span')?.innerText || document.querySelector('.ux-textspans--MSKU_STRIKETHROUGH')?.innerText;
                    officialPrice = clean(lp);
                    image = document.querySelector('.ux-image-magnify__image--main')?.src || document.querySelector('#icImg')?.src;

                    // eBay Weight
                    const specText = document.querySelector('.ux-layout-section--specification')?.innerText || '';
                    const wMatch = specText.match(/(\d+\.?\d*)\s*(lb|pounds)/i);
                    if (wMatch) weight = parseFloat(wMatch[1]);

                    // --- DETECTAR CUPONES EBAY (Adidas, etc) ---
                    const couponBox = document.querySelector('.ux-textspans--BOLD, .discount-info, .promo-banner-text');
                    if (couponBox && couponBox.innerText.includes('code')) {
                        const match = couponBox.innerText.match(/code ([A-Z0-9]+)/i);
                        if (match) {
                            couponInfo = match[1].toUpperCase();
                            const pctMatch = couponBox.innerText.match(/(\d+)%/);
                            if (pctMatch) {
                                const discountPct = parseInt(pctMatch[1]);
                                offerPrice = offerPrice * (1 - (discountPct / 100));
                            }
                        }
                    }
                }
                else if (window.location.hostname.includes('bestbuy.com')) {
                    title = document.querySelector('.heading-container h1')?.innerText;
                    offerPrice = clean(document.querySelector('.priceView-customer-price span')?.innerText);
                    officialPrice = clean(document.querySelector('.pricing-price__regular-price')?.innerText);
                    image = document.querySelector('.main-media-container img')?.src;

                    const spec = document.body.innerText;
                    const wMatch = spec.match(/(\d+\.?\d*)\s*(lb|pounds)/i);
                    if (wMatch) weight = parseFloat(wMatch[1]);
                }
                else if (window.location.hostname.includes('target.com')) {
                    title = document.querySelector('[data-test="product-title"]')?.innerText;
                    offerPrice = clean(document.querySelector('[data-test="product-price"]')?.innerText);
                    const lp = document.querySelector('[data-test="reg-price-strike"]') || document.querySelector('.h-text-strikethrough');
                    officialPrice = clean(lp?.innerText);
                    image = document.querySelector('[data-test="product-image"] img')?.src;

                    const spec = document.body.innerText;
                    const wMatch = spec.match(/(\d+\.?\d*)\s*(lb|pounds)/i);
                    if (wMatch) weight = parseFloat(wMatch[1]);
                }
                else if (window.location.hostname.includes('nike.com')) {
                    title = document.querySelector('#pdp_product_title')?.innerText || document.querySelector('h1')?.innerText;
                    offerPrice = clean(document.querySelector('[data-test="product-price"]')?.innerText);
                    officialPrice = clean(document.querySelector('[data-test="product-price-reduced"]')?.innerText || document.querySelector('.is--strikethrough')?.innerText);
                    image = document.querySelector('img[data-fade-in]')?.src || document.querySelector('meta[property="og:image"]')?.content;
                }

                // --- EXTRAER GALERÍA DE IMÁGENES ---
                let images = [];

                if (window.location.hostname.includes('amazon.com')) {
                    // Amazon Main Image
                    if (image) images.push(image);

                    // Amazon Alt Images (Thumbnails logic)
                    const thumbz = document.querySelectorAll('#altImages li.item img, #imageBlock .a-list-item img, .imageThumbnail img');
                    thumbz.forEach(img => {
                        let src = img.src;
                        // Convertir thumbnail a full res (Hack básico de Amazon URL)
                        // Ejemplo: ..._.jpg -> Quitar ._SS40_.jpg
                        // Las URLs de Amazon suelen tener ._AC_US40_.jpg o similar.
                        // Quitamos la parte del resize para obtener alta calidad.
                        if (src && !src.includes('play-icon-overlay')) {
                            const cleanSrc = src.replace(/\._[A-Z]{2,}\d+_/, ''); // Remover resize flag
                            if (!images.includes(cleanSrc)) images.push(cleanSrc);
                        }
                    });
                } else {
                    // Fallback genérico para otras tiendas
                    if (image) images.push(image);
                    const allImgs = document.querySelectorAll('.gallery img, .product-images img, [data-test="product-image"] img');
                    allImgs.forEach(i => {
                        if (i.src && !images.includes(i.src)) images.push(i.src);
                    });
                }

                // Limitar a max 5 imágenes para no saturar
                images = images.slice(0, 5);

                return { offerPrice, officialPrice, title, image, images, description, isUnavailable, weight, finalUrl: window.location.href, coupon: couponInfo };
            });

            if (data && data.isRedirecting) {
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => { });
                const nextUrl = page.url();
                await browser.close();
                return await this.scrape(nextUrl);
            }

            if (data && data.coupon) {
                data.title = `[CUPÓN: ${data.coupon}] ${data.title}`;
            }

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
