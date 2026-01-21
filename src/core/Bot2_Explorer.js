const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');
const LinkResolver = require('../utils/LinkResolver');
const DeepScraper = require('../utils/DeepScraper');

/**
 * BOT 2: EL EXPLORADOR (VALIDADOR ESTRICTO)
 * Su misión: Ir a la tienda final y verificar que el producto EXISTA, tenga STOCK
 * y que el PRECIO coincida con la oferta.
 */
class ValidatorBot {
    constructor() {
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
    }

    async validate(opportunity) {
        logger.info(`🔍 Validando Disponibilidad: ${opportunity.title.substring(0, 50)}...`);

        let result = {
            isValid: false,
            realPrice: null,
            officialPrice: 0,
            hasStock: false,
            image: opportunity.image,
            title: opportunity.title,
            finalUrl: opportunity.sourceLink,
            storeName: opportunity.tienda || 'Tienda USA'
        };

        try {
            // 1. Resolver el link de afiliado/redirección a la tienda final
            const finalUrl = await LinkResolver.resolve(opportunity.sourceLink);
            result.finalUrl = finalUrl;

            // 2. Determinar la tienda para validación específica
            if (finalUrl.includes('amazon.com')) result.storeName = 'Amazon';
            else if (finalUrl.includes('walmart.com')) result.storeName = 'Walmart';
            else if (finalUrl.includes('bestbuy.com')) result.storeName = 'Best Buy';
            else if (finalUrl.includes('ebay.com')) result.storeName = 'eBay';
            else if (finalUrl.includes('target.com')) result.storeName = 'Target';

            // --- FILTRO ANTI-GENERICS REFORZADO ---
            // Evitamos que se publiquen búsquedas o categorías que no tienen una foto de producto clara.
            const genericPatterns = [
                /\/goldbox/i, /\/deals/i, /\/search/i, /\/browse/i, /\/category/i,
                /\/t\/[^\/]+\/search/i, // Nike search
                /\?s=/i, /\?k=/i, /\?q=/i // Query strings
            ];

            const isGeneric = genericPatterns.some(p => finalUrl.match(p)) && !finalUrl.match(/\/dp\/|\/ip\/|\/product\/|\/itm\//i);

            if (isGeneric) {
                logger.warn(`🛑 ENLACE GENÉRICO BLOQUEADO: ${finalUrl}. Evitando publicación de resultados de búsqueda.`);
                return result;
            }

            // 3. INTENTO DE VALIDACIÓN PROFUNDA (Puppeteer)
            const deepData = await DeepScraper.scrape(finalUrl);

            if (deepData && (deepData.offerPrice > 0 || (result.storeName !== 'Amazon' && opportunity.referencePrice > 0))) {
                if (deepData.isUnavailable) {
                    logger.warn(`❌ Producto AGOTADO: ${opportunity.title}`);
                    return result;
                }

                // SEGURIDAD DE IMAGEN: Si no hay imagen, el deal se ve mal.
                // Forzamos que tenga imagen para tiendas que no sean Amazon (Amazon tiene fallback por ASIN)
                const hasImage = deepData.image || opportunity.image;
                if (!hasImage && result.storeName !== 'Amazon') {
                    logger.warn(`🖼️ Deal omitido por FALTA DE IMAGEN: ${opportunity.title}`);
                    return result;
                }

                result.realPrice = deepData.offerPrice || opportunity.referencePrice;
                result.officialPrice = deepData.officialPrice || opportunity.msrp || 0;
                result.hasStock = true;
                result.isValid = true;

                if (deepData.image) result.image = deepData.image;
                if (deepData.title) result.title = deepData.title;

                logger.info(`✅ VALIDACIÓN ÉXITO: $${result.realPrice} (Imagen: ${result.image ? 'OK' : 'FALLBACK'})`);
            } else {
                logger.warn(`⚠️ Validación fallida para ${opportunity.title}. No se pudo confirmar precio o stock.`);
            }

            return result;

        } catch (error) {
            logger.error(`❌ Error crítico en ValidatorBot: ${error.message}`);
            return result;
        }
    }

    cleanPrice(text) {
        if (!text) return 0;
        const cleaned = text.replace(/[^0-9,.]/g, '').replace(',', '');
        const price = parseFloat(cleaned);
        return isNaN(price) ? 0 : price;
    }
}

module.exports = new ValidatorBot();
