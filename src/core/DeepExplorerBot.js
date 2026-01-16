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
            store: 'Desconocida'
        };

        try {
            // 1. CARGAR PÁGINA INTERNA DE SLICKDEALS (Para cupones y validación)
            const response = await axios.get(initialUrl, {
                headers: { 'User-Agent': this.userAgent },
                timeout: 10000,
                maxRedirects: 10
            });

            const $ = cheerio.load(response.data);

            // A. DETECTAR CUPÓN (Búsqueda profunda en detalles y notas)
            result.coupon = $('.couponCode, .promoCode, [data-bhw="CouponCode"]').first().text().trim() ||
                $('.itemPriceLine:contains("Code")').text().match(/Code\s*([A-Z0-9]+)/i)?.[1] ||
                $('.communityNotesBox:contains("Code")').text().match(/code:\s*([A-Z0-9]+)/i)?.[1];

            // B. VERIFICAR SI ESTÁ EXPIRADA
            const expiredSignals = $('.expired, .dealExpired, :contains("Deal is Expired")').length > 0;
            if (expiredSignals) {
                logger.warn(`⚠️ Oferta detectada como EXPIRADA en Slickdeals.`);
                result.isExpired = true;
                return result;
            }

            // C. LLEGAR A LA TIENDA REAL (Seguir el botón "Buy Now")
            let buyNowLink = $('a.buyNow, a.button--primary, a.button--checkout').attr('data-href') ||
                $('a.buyNow, a.button--primary, a.button--checkout').attr('href');

            if (buyNowLink) {
                if (buyNowLink.startsWith('/')) buyNowLink = 'https://slickdeals.net' + buyNowLink;

                // Seguir la redirección hasta la tienda final
                logger.debug(`Seguindo botón de compra: ${buyNowLink}`);
                const shopRes = await axios.head(buyNowLink, {
                    headers: { 'User-Agent': this.userAgent },
                    maxRedirects: 15,
                    timeout: 10000,
                    validateStatus: (status) => status < 400
                }).catch(e => {
                    // Si HEAD falla (algunas tiendas lo bloquean), intentar GET ligero
                    return axios.get(buyNowLink, {
                        headers: { 'User-Agent': this.userAgent },
                        maxRedirects: 10,
                        timeout: 10000
                    });
                });

                result.finalUrl = shopRes.request?.res?.responseUrl || shopRes.config?.url || buyNowLink;

                // Limpiar trackers de Slickdeals que queden en la URL final
                if (result.finalUrl.includes('u2=')) {
                    const u2 = new URL(result.finalUrl).searchParams.get('u2');
                    if (u2) result.finalUrl = decodeURIComponent(u2);
                }
            }

            // D. DETECTAR TIENDA REAL
            if (result.finalUrl.includes('amazon.com')) result.store = 'Amazon';
            else if (result.finalUrl.includes('walmart.com')) result.store = 'Walmart';
            else if (result.finalUrl.includes('ebay.com')) result.store = 'eBay';
            else if (result.finalUrl.includes('target.com')) result.store = 'Target';
            else if (result.finalUrl.includes('bestbuy.com')) result.store = 'Best Buy';

            logger.info(`✅ BOT 1 completado. Tienda: ${result.store} | Cupón: ${result.coupon || 'Ninguno'}`);
            return result;

        } catch (error) {
            logger.error(`❌ BOT 1 falló en exploración profunda: ${error.message}`);
            return result; // Devolver lo que tengamos hasta el fallo
        }
    }
}

module.exports = new DeepExplorerBot();
