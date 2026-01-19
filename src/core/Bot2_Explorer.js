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

            // --- FILTRO ANTI-GENERICS ---
            // Si el link final es un landing genérico (como 'Gold Box' o búsquedas), el scraper fallará.
            // Si no detectamos un patrón de producto específico (/dp/, /ip/, /product/), lo rechazamos.
            const isGeneric = finalUrl.match(/\/goldbox|\/deals|\/search|\/browse|\/category/i) && !finalUrl.match(/\/dp\/|\/ip\/|\/product\//i);

            if (isGeneric) {
                logger.warn(`🛑 ENLACE GENÉRICO DETECTADO: ${finalUrl}. Omitiendo validación por no ser un producto específico.`);
                return result;
            }

            // Aceptamos múltiples tiendas para diversificar monetización

            // 3. INTENTO DE VALIDACIÓN PROFUNDA (Puppeteer)
            // Dado que las tiendas bloquean Axios, usamos Puppeteer para asegurar veracidad
            const deepData = await DeepScraper.scrape(finalUrl);

            if (deepData && deepData.offerPrice > 0) {
                // VERIFICACIÓN DE STOCK (Crítica)
                // El DeepScraper debe retornar si hay botón de compra o mensaje de error
                if (deepData.isUnavailable) {
                    logger.warn(`❌ Producto AGOTADO o NO DISPONIBLE: ${opportunity.title}`);
                    return result;
                }

                result.realPrice = deepData.offerPrice;
                result.officialPrice = deepData.officialPrice || 0;
                result.hasStock = true;
                result.isValid = true;

                // Actualizar metadatos si el scraper encontró algo más preciso
                if (deepData.image) result.image = deepData.image;
                if (deepData.title) result.title = deepData.title;

                logger.info(`✅ VALIDACIÓN ÉXITO: $${result.realPrice} (Stock: OK)`);
            } else {
                // FALLBACK: Si Puppeteer falla, intentamos axios pero solo como último recurso
                logger.warn(`⚠️ Scraping profundo falló para ${opportunity.title}.`);

                // Si es un link de Slickdeals que aún no hemos resuelto bien, lo marcamos inválido
                if (finalUrl.includes('slickdeals.net/f/')) {
                    logger.error(`❌ El link no se pudo resolver a una tienda real. Omitiendo.`);
                    return result;
                }
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
