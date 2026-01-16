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
            verifiedPrice: null,
            store: 'Desconocida',
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

            // A. DETECTAR IMAGEN DE ALTA CALIDAD (Prioridad sobre RSS)
            result.image = $('.itemImage img, .mainImage img, .imageContainer img').attr('src') ||
                $('.imageCanvas img').attr('src') ||
                $('meta[property="og:image"]').attr('content');

            if (result.image && result.image.startsWith('//')) result.image = 'https:' + result.image;

            // B. DETECTAR CUPÓN
            result.coupon = $('.couponCode, .promoCode, [data-bhw="CouponCode"]').first().text().trim() ||
                $('.itemPriceLine:contains("Code")').text().match(/Code\s*([A-Z0-9]+)/i)?.[1] ||
                $('.communityNotesBox:contains("Code")').text().match(/code:\s*([A-Z0-9]+)/i)?.[1] ||
                $('button[data-clipboard-text]').attr('data-clipboard-text');

            // C. VERIFICAR SI ESTÁ EXPIRADA
            const expiredSignals = $('.expired, .dealExpired, :contains("Deal is Expired")').length > 0 ||
                $('.dealTitle .status').text().toLowerCase().includes('expired');
            if (expiredSignals) {
                logger.warn(`⚠️ Oferta detectada como EXPIRADA.`);
                result.isExpired = true;
                return result;
            }

            // D. BÚSQUEDA AGRESIVA DEL LINK DE COMPRA
            // 1. Botones estándar
            let buyNowLink = $('a.buyNow, a.button--primary, a.button--checkout, a[data-bhw="BuyNowButton"]').attr('data-href') ||
                $('a.buyNow, a.button--primary, a.button--checkout, a[data-bhw="BuyNowButton"]').attr('href');

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

            // E. SEGUIR EL RASTRO HASTA LA TIENDA REAL
            if (buyNowLink) {
                if (buyNowLink.startsWith('/')) buyNowLink = 'https://slickdeals.net' + buyNowLink;

                try {
                    const shopRes = await axios.get(buyNowLink, {
                        headers: { 'User-Agent': this.userAgent },
                        maxRedirects: 12,
                        timeout: 10000
                    });

                    result.finalUrl = shopRes.request?.res?.responseUrl || shopRes.config?.url || buyNowLink;
                } catch (e) {
                    result.finalUrl = buyNowLink;
                }

                // Limpieza Critica de u2 y otros trackers
                if (result.finalUrl.includes('u2=')) {
                    result.finalUrl = decodeURIComponent(new URL(result.finalUrl, 'https://slickdeals.net').searchParams.get('u2'));
                }
                if (result.finalUrl.includes('lno=')) {
                    result.finalUrl = decodeURIComponent(new URL(result.finalUrl, 'https://slickdeals.net').searchParams.get('url') || result.finalUrl);
                }
            }

            // F. DETECTAR TIENDA POR DOMINIO
            const domainMatch = result.finalUrl.match(/https?:\/\/(?:www\.)?([^/]+)/);
            if (domainMatch) {
                const domain = domainMatch[1].toLowerCase();
                if (domain.includes('amazon')) result.store = 'Amazon';
                else if (domain.includes('walmart')) result.store = 'Walmart';
                else if (domain.includes('ebay')) result.store = 'eBay';
                else if (domain.includes('target')) result.store = 'Target';
                else if (domain.includes('bestbuy')) result.store = 'Best Buy';
                else if (domain.includes('academy')) result.store = 'Academy Sports';
                else if (domain.includes('adidas')) result.store = 'Adidas';
                else if (domain.includes('nike')) result.store = 'Nike';
                else result.store = domain.split('.')[0].toUpperCase();
            }

            logger.info(`✅ BOT 1 completado. Tienda: ${result.store} | Cupon: ${result.coupon || 'No'}`);
            return result;

        } catch (error) {
            logger.error(`❌ BOT 1 Error Profundo: ${error.message}`);
            return result;
        }
    }
}

module.exports = new DeepExplorerBot();
