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
            let response;
            try {
                // Intento 1: Request Directo con headers completos
                response = await axios.get(initialUrl, {
                    headers: {
                        'User-Agent': this.userAgent,
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Referer': 'https://www.google.com/'
                    },
                    timeout: 10000
                });
            } catch (e) {
                if (e.response && (e.response.status === 403 || e.response.status === 429)) {
                    logger.info(`🛡️ Slickdeals bloqueó acceso directo (403/429). Activando Google Proxy Bypass...`);
                    try {
                        const proxyUrl = `https://translate.google.com/translate?sl=auto&tl=en&u=${encodeURIComponent(initialUrl)}`;
                        response = await axios.get(proxyUrl, {
                            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                            timeout: 15000
                        });
                    } catch (proxyError) {
                        logger.error('❌ Proxy también falló. Abortando exploración profunda.');
                        throw e; // Rendirse si ambos fallan
                    }
                } else { throw e; }
            }

            const html = response.data;
            const $ = cheerio.load(html);

            // A. EXTRACCIÓN DE PRECIOS & CUPONES (PARIDAD TOTAL)
            const priceText = $('.dealPrice, .price, .itemPrice, .mainItemPrice').first().text().trim();
            if (priceText) {
                const match = priceText.match(/\$(\d+(?:\.\d{2})?)/);
                if (match) result.price_offer = parseFloat(match[1]);
            }

            const originalPriceText = $('.listPrice, .oldPrice, .regPrice, .strike, .msrp').first().text().trim();
            if (originalPriceText) {
                const match = originalPriceText.match(/\$(\d+(?:\.\d{2})?)/);
                if (match) result.price_official = parseFloat(match[1]);
            }

            result.image = $('.itemImage img, .mainImage img, .imageContainer img').attr('src') || $('meta[property="og:image"]').attr('content');
            if (result.image && result.image.startsWith('//')) result.image = 'https:' + result.image;

            result.coupon = $('.couponCode, .promoCode, [data-bhw="CouponCode"]').first().text().trim() ||
                $('button[data-clipboard-text]').attr('data-clipboard-text');

            if (!result.coupon) {
                const descText = $('.itemDetails, .description, .mainContent').text() || '';
                const couponMatches = descText.match(/(?:code|coupon|código|cupón)[:\s]?\s*([A-Z0-9]{4,15})/i);
                if (couponMatches) result.coupon = couponMatches[1].toUpperCase();
            }

            // E. SEGUIR EL RASTRO HASTA LA TIENDA REAL (Extracción Multifacética)
            let buyNowLink = null;

            // E.1. Búsqueda en Botones
            let buyNowLinks = $('a.buyNow, a.button--primary, a:contains("See Deal"), a:contains("Buy Now")');
            for (let i = 0; i < buyNowLinks.length; i++) {
                let href = $(buyNowLinks[i]).attr('href');
                if (href && !href.includes('product-reviews') && href !== '#') {
                    buyNowLink = href;
                    break;
                }
            }

            // E.2. Búsqueda en JSON-LD (Suele ser más fiable)
            if (!buyNowLink) {
                $('script[type="application/ld+json"]').each((i, el) => {
                    try {
                        const json = JSON.parse($(el).html());
                        if (json.offers && json.offers.url) buyNowLink = json.offers.url;
                        if (json.url && !json.url.includes('slickdeals.net')) buyNowLink = json.url;
                    } catch (e) { }
                });
            }

            // E.3. Búsqueda "Sucia" (Links ocultos en attributos data-u2)
            if (!buyNowLink) {
                $('a').each((i, el) => {
                    const h = $(el).attr('href');
                    if (h && h.includes('u2=')) {
                        buyNowLink = h;
                        return false;
                    }
                });
            }

            if (buyNowLink) {
                if (buyNowLink.startsWith('/')) buyNowLink = 'https://slickdeals.net' + buyNowLink;

                // --- EXTRACCIÓN ESTÁTICA BLINDADA ---
                try {
                    let temp = buyNowLink;
                    for (let k = 0; k < 3; k++) {
                        const u = new URL(temp.startsWith('/') ? 'https://slickdeals.net' + temp : temp);
                        const next = u.searchParams.get('u2') || u.searchParams.get('dest') || u.searchParams.get('url') || u.searchParams.get('pno');
                        if (next && next.startsWith('http')) {
                            temp = decodeURIComponent(next);
                            result.finalUrl = temp;
                        } else break;
                    }
                } catch (e) { }
            }

            // F. INFERIR TIENDA (Mismo de siempre)
            const domainMatch = result.finalUrl.match(/https?:\/\/(?:www\.)?([^/]+)/);
            if (domainMatch) {
                const d = domainMatch[1].toLowerCase();
                if (d.includes('amazon')) result.store = 'Amazon';
                else if (d.includes('walmart')) result.store = 'Walmart';
                else if (d.includes('ebay')) result.store = 'eBay';
                else if (d.includes('adorama') || result.finalUrl.includes('adorama')) result.store = 'Adorama';
                else if (d.includes('bhphoto')) result.store = 'B&H Photo';
                else if (d.includes('newegg')) result.store = 'Newegg';
            }

            return result;

        } catch (error) {
            logger.error(`❌ BOT 1 Error: ${error.message}`);
            return result;
        }
    }
}

module.exports = new DeepExplorerBot();
