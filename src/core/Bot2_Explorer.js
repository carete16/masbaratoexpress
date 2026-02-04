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

            const isGeneric = !opportunity.isManual && genericPatterns.some(p => finalUrl.match(p)) && !finalUrl.match(/\/dp\/|\/ip\/|\/product\/|\/itm\//i);

            if (isGeneric) {
                logger.warn(`🛑 ENLACE GENÉRICO BLOQUEADO: ${finalUrl}. Evitando publicación de resultados de búsqueda.`);
                return result;
            }

            // 3. INTENTO DE VALIDACIÓN PROFUNDA (Puppeteer)
            const deepData = await DeepScraper.scrape(finalUrl);

            if (deepData) {
                if (deepData.finalUrl) result.finalUrl = deepData.finalUrl;

                // Si después del scrape profundo seguimos en Slickdeals, bloqueamos.
                // EXCEPCIÓN: Si es manual, permitimos que el usuario lo vea aunque no resuelva (él decidirá si borrar o no)
                if (result.finalUrl.includes('slickdeals.net') && !opportunity.isManual) {
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
                result.weight = deepData.weight || 0;

                if (deepData.image) result.image = deepData.image;
                if (deepData.title) result.title = deepData.title;

                logger.info(`✅ VALIDACIÓN ÉXITO: $${result.realPrice} (Imagen: ${result.image ? 'OK' : 'FALLBACK'}, Peso: ${result.weight} lbs)`);
            } else {
                // --- MANEJO DE FALLOS Y MANUALES ---
                if (opportunity.isManual) {
                    logger.info(`🛡️ Manual Post detectado: Procesando rescate de info via URL.`);
                    result.isValid = true;
                    result.hasStock = true;
                    result.realPrice = providedPrice || 0;

                    // A. Rescate de Título (Mejorado para Amazon y Walmart)
                    if (!result.title || result.title.includes('Manual') || result.title === 'Analysis' || result.title.length < 5 || result.title === "Oferta Express") {
                        try {
                            const urlObj = new URL(result.finalUrl);
                            const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0);

                            // Caso Amazon DP: /Nombre-Producto/dp/ASIN
                            const dpIndex = pathParts.findIndex(p => p.toLowerCase() === 'dp');
                            if (dpIndex > 0) {
                                result.title = decodeURIComponent(pathParts[dpIndex - 1]).replace(/-/g, ' ');
                            }
                            // Caso genérico: Primer segmento significativo
                            else if (pathParts[0] && !['dp', 'gp', 'ip', 'itm', 'product'].includes(pathParts[0].toLowerCase())) {
                                result.title = decodeURIComponent(pathParts[0]).replace(/-/g, ' ');
                            }

                            if (!result.title || result.title.length < 3) result.title = "Producto Express";
                        } catch (e) { result.title = "Producto Express"; }
                    }

                    // B. Rescate de Imagen (Amazon / Walmart)
                    if (!result.image || result.image.includes('placehold')) {
                        if (result.finalUrl.includes('amazon.com')) {
                            const asinMatch = result.finalUrl.match(/\/(dp|gp\/product)\/([A-Z0-9]{10})/i);
                            if (asinMatch) result.image = `https://images-na.ssl-images-amazon.com/images/P/${asinMatch[2]}.01.LZZZZZZZ.jpg`;
                        } else if (result.finalUrl.includes('walmart.com')) {
                            result.image = 'https://placehold.co/400?text=Walmart+Product';
                        }
                    }

                    // C. Rescate de Peso y Categoría Inteligente (NUEVO & MEJORADO)
                    const t = result.title.toLowerCase();

                    // 1. Detección de Categoría (Restringido a las 3 oficiales)
                    if (t.match(/laptop|notebook|macbook|computer|ssd|cpu|gpu|monitor|keyboard|mouse|headset|gaming|tech|electronics|pc|component/)) {
                        result.categoria = "Electrónica Premium";
                    } else if (t.match(/watch|reloj|smartwatch|galaxy watch|apple watch|casio|rolex|invicta|citizen|seiko/)) {
                        result.categoria = "Relojes & Wearables";
                    } else {
                        // Fallback a Lifestyle si no es tech o relojes
                        result.categoria = "Lifestyle & Street";
                    }

                    // 2. Estimación de Peso (Heurística Senior)
                    if (!result.weight || result.weight <= 0) {
                        if (t.includes('laptop') || t.includes('macbook')) result.weight = 5.0;
                        else if (t.includes('monitor')) {
                            if (t.includes('27')) result.weight = 14.0;
                            else result.weight = 10.0;
                        }
                        else if (t.includes('iphone') || t.includes('phone') || t.includes('smartphone')) result.weight = 0.8;
                        else if (t.includes('tablet') || t.includes('ipad')) result.weight = 1.5;
                        else if (t.includes('watch') || t.includes('smartwatch')) result.weight = 0.5;
                        else if (t.match(/shoe|sneaker|tenis|nike|adidas/)) result.weight = 3.5;
                        else if (t.includes('headphone') || t.includes('earbuds')) result.weight = 0.6;
                        else if (t.includes('perfume') || t.includes('cologne')) result.weight = 1.2;
                        else if (t.includes('keyboard')) result.weight = 2.0;
                        else if (t.includes('backpack')) result.weight = 2.5;
                        else if (t.includes('camera')) result.weight = 4.0;
                        else result.weight = 2.0; // Default moderado

                        logger.info(`⚖️ IA ESTIMADORA: Peso ${result.weight} lbs y Cat: ${result.categoria} para "${result.title}"`);
                    }
                } else if (providedPrice > 0 && opportunity.image && !['Amazon', 'Walmart'].includes(result.storeName)) {
                    // Fallback para RSS regular
                    result.realPrice = providedPrice;
                    result.hasStock = true;
                    result.isValid = true;
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
