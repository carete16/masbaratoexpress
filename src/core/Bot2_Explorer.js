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
            else if (finalUrl.includes('nike.com')) result.storeName = 'Nike';
            else {
                try {
                    const domain = new URL(finalUrl).hostname.replace('www.', '');
                    result.storeName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
                } catch (e) {
                    result.storeName = 'Tienda USA';
                }
            }


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

            if (deepData) {
                if (deepData.finalUrl) result.finalUrl = deepData.finalUrl;

                // Si después del scrape profundo seguimos en Slickdeals, bloqueamos.
                if (result.finalUrl.includes('slickdeals.net')) {
                    logger.warn(`🛑 SCRAPER TERMINÓ EN SLICKDEALS: ${result.finalUrl}. Omitiendo.`);
                    return result;
                }
            }

            const providedPrice = opportunity.price_offer || opportunity.referencePrice;

            if (deepData && (deepData.offerPrice > 0 || (result.storeName !== 'Amazon' && providedPrice > 0))) {
                if (deepData.isUnavailable) {
                    logger.warn(`❌ Producto AGOTADO: ${opportunity.title}`);
                    return result;
                }

                // SEGURIDAD DE IMAGEN: No permitimos publicaciones "ciegas".
                const finalImage = deepData.image || opportunity.image;
                const isBadImage = !finalImage ||
                    finalImage.includes('favicon') ||
                    finalImage.includes('placehold.co') ||
                    finalImage.includes('logo');

                if (isBadImage && !opportunity.isManual) {
                    logger.warn(`🖼️ Deal omitido por IMAGEN INVÁLIDA: "${opportunity.title}" | Img: ${finalImage || 'MISSING'}`);
                    return result;
                }


                result.realPrice = deepData.offerPrice || providedPrice;
                result.officialPrice = deepData.officialPrice || opportunity.msrp || 0;
                result.hasStock = true;
                result.isValid = true;

                if (deepData.image) result.image = deepData.image;
                if (deepData.title) result.title = deepData.title;

                logger.info(`✅ VALIDACIÓN ÉXITO: $${result.realPrice} (Imagen: ${result.image ? 'OK' : 'FALLBACK'})`);
            } else {
                // --- FALLBACK: SI EL SCRAPE PROFUNDO FALLA PERO TENEMOS INFO ---
                const canUseFallback = (providedPrice > 0) && (opportunity.image || opportunity.isManual);

                if (canUseFallback && (opportunity.isManual || !['Amazon', 'Walmart'].includes(result.storeName))) {
                    logger.info(`⚠️ Falló DeepScrape pero ${opportunity.isManual ? 'es MANUAL' : 'tenemos info de RSS'}. Procediendo con datos proporcionados.`);
                    result.realPrice = providedPrice;
                    result.hasStock = true;
                    result.isValid = true;

                    // Si no tenemos título real, intentar extraerlo del URL
                    if (!result.title || result.title === 'Manual Order') {
                        try {
                            const urlObj = new URL(result.finalUrl);
                            const pathParts = urlObj.pathname.split('/');
                            // Amazon: /Product-Title/dp/ASIN
                            const dpIndex = pathParts.findIndex(p => p.toLowerCase() === 'dp');
                            if (dpIndex > 0 && pathParts[dpIndex - 1]) {
                                result.title = decodeURIComponent(pathParts[dpIndex - 1]).replace(/-/g, ' ').substring(0, 80);
                            } else if (pathParts[1] && pathParts[1] !== 'dp' && pathParts[1] !== 'ip') {
                                result.title = decodeURIComponent(pathParts[1]).replace(/-/g, ' ').substring(0, 80);
                            }
                        } catch (e) { }
                    }

                    // Si es manual y no hay imagen, intentar una imagen genérica si es Amazon
                    if (!result.image && opportunity.sourceLink.includes('amazon.com')) {
                        const asinMatch = opportunity.sourceLink.match(/\/dp\/([A-Z0-9]{10})/i) || opportunity.sourceLink.match(/\/gp\/product\/([A-Z0-9]{10})/i);
                        if (asinMatch) {
                            result.image = `https://images-na.ssl-images-amazon.com/images/P/${asinMatch[1]}.01.LZZZZZZZ.jpg`;
                        }
                    }
                } else {
                    logger.warn(`⚠️ Validación totalmente fallida para ${opportunity.title}.`);
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
