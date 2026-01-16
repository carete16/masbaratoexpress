const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');

/**
 * BOT 1: EXPLORADOR DE PROFUNDIDAD
 * Su misión: Navegar hasta la tienda real, detectar cupones escondidos 
 * y verificar la veracidad de la oferta.
 */
class DeepExplorerBot {
    constructor() {
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }

    async explore(initialUrl) {
        logger.info(`🕵️ BOT 1 (Explorador) iniciando expedición: ${initialUrl.substring(0, 60)}...`);

        let result = {
            finalUrl: initialUrl,
            coupon: null,
            isExpired: false,
            price_offer: null,
            price_official: null,
            store: 'Oferta USA',
            image: null
        };

        try {
            // 1. CARGAR PÁGINA INTERNA DE SLICKDEALS
            const response = await axios.get(initialUrl, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                },
                timeout: 12000,
                maxRedirects: 5
            });

            const html = response.data;
            const $ = cheerio.load(html);

            // A. EXTRACCIÓN DE PRECIOS (PARIDAD TOTAL)
            const priceText = $('.dealPrice').first().text().trim() || $('.itemPrice').first().text().trim() || $('[data-bhw="Price"]').text().trim();
            if (priceText) {
                const match = priceText.match(/\$(\d+(?:\.\d{2})?)/);
                if (match) result.price_offer = parseFloat(match[1]);
            }

            // PRECIO ORIGINAL (MSRP / List Price / Reg Price / Was)
            // Agregando selectores PROFUNDOS de Slickdeals
            const originalPriceText = $('.listPrice').first().text().trim() ||
                $('.oldPrice').first().text().trim() ||
                $('.regPrice').first().text().trim() ||
                $('.strike').first().text().trim() ||
                $('.itemPrice.reg').text().trim() ||
                $('[data-bhw="ListPrice"]').text().trim() ||
                $('.strikethrough').first().text().trim();

            if (originalPriceText) {
                const match = originalPriceText.match(/\$(\d+(?:\.\d{2})?)/);
                if (match) result.price_official = parseFloat(match[1]);
            }

            // Si aún no tenemos precio oficial, buscar en el texto descriptivo (Reg., MSRP, Was)
            if (!result.price_official || result.price_official <= result.price_offer) {
                const text = $('.itemDetails, .description, .dealTitle, .mainContent').text();
                // Patrones comunes en Slickdeals: "List Price: $99.99", "Was $99.99", "$99.99 (Reg. $150)"
                const regMatch = text.match(/(?:Reg\.|Was|MSRP|List|List Price|Original)\s*[:\-]?\s*\$(\d+(?:\.\d{2})?)/i) ||
                    text.match(/\$(\d+(?:\.\d{2})?)\s*(?:Reg\.|Was|MSRP|List|Original)/i);
                if (regMatch) result.price_official = parseFloat(regMatch[1]);
            }

            // SEGURIDAD: Si no hay MSRP, intentar extraerlo del título si el scraper falló
            if (!result.price_official) {
                const pageTitle = $('title').text();
                const titleMatch = pageTitle.match(/(?:Reg\.|Was|MSRP|List)\s*\$(\d+(?:\.\d{2})?)/i);
                if (titleMatch) result.price_official = parseFloat(titleMatch[1]);
            }

            // Garantizar que si el precio oficial es menor o igual al de oferta, se anule (Data Sanitize)
            if (result.price_official <= result.price_offer) result.price_official = 0;

            // B. DETECTAR IMAGEN DE ALTA CALIDAD
            result.image = $('.itemImage img, .mainImage img, .imageContainer img').attr('src') ||
                $('.imageCanvas img').attr('src') ||
                $('meta[property="og:image"]').attr('content');

            if (result.image && result.image.startsWith('//')) result.image = 'https:' + result.image;

            // C. DETECTAR CUPÓN
            result.coupon = $('.couponCode, .promoCode, [data-bhw="CouponCode"]').first().text().trim() ||
                $('button[data-clipboard-text]').attr('data-clipboard-text');

            // D. VERIFICAR SI ESTÁ EXPIRADA
            const expiredSignals = $('.expired, .dealExpired, :contains("Deal is Expired")').length > 0;
            if (expiredSignals) {
                logger.warn(`⚠️ Oferta detectada como EXPIRADA.`);
                result.isExpired = true;
                return result;
            }

            // E. SEGUIR EL RASTRO HASTA LA TIENDA REAL
            let buyNowLinks = $('a.buyNow, a.button--primary, a.button--checkout, a[data-bhw="BuyNowButton"]');
            let buyNowLink = null;

            for (let i = 0; i < buyNowLinks.length; i++) {
                let href = $(buyNowLinks[i]).attr('data-href') || $(buyNowLinks[i]).attr('href');
                if (href && !href.includes('product-reviews') && !href.includes('/reviews/')) {
                    buyNowLink = href;
                    break;
                }
            }

            // 2. Si no hay, buscar en JSON-LD (Slickdeals suele ponerlo ahí)
            if (!buyNowLink) {
                const scripts = $('script[type="application/ld+json"]');
                scripts.each((i, el) => {
                    try {
                        const json = JSON.parse($(el).html());
                        if (json.url && !json.url.includes('slickdeals.net')) buyNowLink = json.url;
                        if (json.offers && json.offers.url) buyNowLink = json.offers.url;
                    } catch (e) { }
                });
            }

            if (buyNowLink) {
                if (buyNowLink.startsWith('/')) buyNowLink = 'https://slickdeals.net' + buyNowLink;

                // Intento de resolución profunda (u2 es el bypass más directo)
                try {
                    const params = new URL(buyNowLink, 'https://slickdeals.net').searchParams;
                    const u2 = params.get('u2') || params.get('url') || params.get('lno');
                    if (u2) result.finalUrl = decodeURIComponent(u2);
                } catch (e) { }

                // Si no se resolvió por parámetros, intentamos rastreo físico
                if (result.finalUrl.includes('slickdeals.net')) {
                    try {
                        const shopRes = await axios.get(buyNowLink, {
                            headers: {
                                'User-Agent': this.userAgent,
                                'Referer': 'https://slickdeals.net/'
                            },
                            maxRedirects: 10,
                            timeout: 10000
                        });
                        result.finalUrl = shopRes.request?.res?.responseUrl || shopRes.config?.url || buyNowLink;
                    } catch (e) {
                        logger.warn(`⚠️ Error resolviendo link físico: ${e.message}`);
                        // Fallback: buscar cualquier URL externa en el cuerpo si falló el axios
                    }
                }
            }

            // F. DETECTAR TIENDA POR DOMINIO (Garantizar no poner "Slickdeals")
            const domainMatch = result.finalUrl.match(/https?:\/\/(?:www\.)?([^/]+)/);
            if (domainMatch) {
                const domain = domainMatch[1].toLowerCase();
                const storeMap = {
                    'amazon': 'Amazon', 'walmart': 'Walmart', 'ebay': 'eBay', 'target': 'Target',
                    'bestbuy': 'Best Buy', 'academy': 'Academy', 'adidas': 'Adidas', 'nike': 'Nike',
                    'puma': 'Puma', 'kohls': 'Kohls', 'macys': 'Macys', 'homedepot': 'Home Depot',
                    'lowes': 'Lowes', 'newegg': 'Newegg', 'costco': 'Costco'
                };

                for (const [key, value] of Object.entries(storeMap)) {
                    if (domain.includes(key)) {
                        result.store = value;
                        break;
                    }
                }

                if (result.store === 'Oferta USA' || result.store.toLowerCase().includes('slickdeals')) {
                    const parts = domain.split('.');
                    let name = parts.length > 2 ? parts[1] : parts[0];

                    // BLOQUEO ABSOLUTO: Prohibido decir Slickdeals
                    if (name.toLowerCase().includes('slickdeals')) {
                        name = 'Oferta USA';
                    }

                    result.store = name.charAt(0).toUpperCase() + name.slice(1);
                }
            }

            // G. LIMPIEZA FINAL DE SEGURIDAD (Doble Check)
            if (result.store.toLowerCase().includes('slickdeals')) {
                result.store = 'Oferta USA';
            }

            logger.info(`✅ BOT 1 completado. Tienda: ${result.store}`);
            return result;

        } catch (error) {
            logger.error(`❌ BOT 1 Error Profundo: ${error.message}`);
            return result;
        }
    }
}

module.exports = new DeepExplorerBot();
