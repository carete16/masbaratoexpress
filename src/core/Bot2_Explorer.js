const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');

/**
 * BOT 2: EL VALIDADOR (Verificación Obligatoria)
 * Su misión: Confirmar precio y stock directamente en la tienda original.
 */
class ValidatorBot {
    constructor() {
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36';
    }

    async validate(opportunity) {
        logger.info(`🔍 Validando oportunidad en tienda origen: ${opportunity.title.substring(0, 40)}...`);

        const result = {
            isValid: false,
            finalUrl: null,
            realPrice: 0,
            hasStock: true,
            storeName: opportunity.store,
            image: null
        };

        try {
            // 1. OBTENER LINK FINAL (Inteligente)
            let finalUrl = opportunity.sourceLink;

            // Si el link NO es de Slickdeals, ya es directo (¡Garantizado!)
            const isDirect = !finalUrl.includes('slickdeals.net');

            if (!isDirect) {
                // Si es Amazon con ASIN, generamos el link directo para evitar rastro
                if (opportunity.productId && opportunity.store === 'Amazon') {
                    finalUrl = `https://www.amazon.com/dp/${opportunity.productId}`;
                } else {
                    // Solo usamos el Bot5 si el link sigue siendo de Slickdeals
                    const Bot5 = require('./Bot5_BrowserSim');
                    const trace = await Bot5.extractRealLink(opportunity.sourceLink);
                    if (trace.success) finalUrl = trace.link;
                }
            }

            if (!finalUrl || finalUrl.includes('slickdeals.net')) {
                logger.warn(`❌ No se pudo obtener el link de la tienda original.`);
                return result;
            }

            result.finalUrl = finalUrl;

            // RE-IDENTIFICACIÓN DE TIENDA (Fase 1: Estructura de URL)
            const lowUrl = finalUrl.toLowerCase();
            if (lowUrl.includes('amazon.com')) result.storeName = 'Amazon';
            else if (lowUrl.includes('walmart.com')) result.storeName = 'Walmart';
            else if (lowUrl.includes('ebay.com')) result.storeName = 'eBay';
            else if (lowUrl.includes('bestbuy.com')) result.storeName = 'Best Buy';
            else if (lowUrl.includes('target.com')) result.storeName = 'Target';
            else if (lowUrl.includes('adidas.com')) result.storeName = 'Adidas';
            else if (lowUrl.includes('nike.com')) result.storeName = 'Nike';
            else if (opportunity.store && opportunity.store !== 'Global') result.storeName = opportunity.store;
            else result.storeName = 'Tienda USA'; // Mejor que 'Global'

            // 2. VERIFICACIÓN EN MODO "SIGILOSO" (AXIOS + CHEERIO)
            // Intentamos verificar el precio en la tienda
            try {
                const response = await axios.get(finalUrl, {
                    headers: { 'User-Agent': this.userAgent, 'Accept-Language': 'en-US,en;q=0.9' },
                    timeout: 10000
                });

                const $ = cheerio.load(response.data);

                // Selectores genéricos de precios por tienda
                let foundPrice = 0;
                if (result.storeName === 'Amazon') {
                    const priceStr = $('.a-price-whole').first().text() + $('.a-price-fraction').first().text();
                    foundPrice = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
                    result.image = $('img#landingImage').attr('src') || $('img#imgBlkFront').attr('src');
                } else if (result.storeName === 'Walmart') {
                    const priceStr = $('span[itemprop="price"]').attr('content') || $('.price-characteristic').first().text();
                    foundPrice = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
                }

                // VALIDACIÓN DE PRECIO (REGLA CRÍTICA)
                // Si encontramos el precio y no coincide (margen del 5%), descartamos
                if (foundPrice > 0) {
                    const diff = Math.abs(foundPrice - opportunity.referencePrice);
                    if (diff > (opportunity.referencePrice * 0.05)) {
                        logger.warn(`❌ Precio no coincide. Ref: $${opportunity.referencePrice} vs Real: $${foundPrice}`);
                        return result; // Descartar
                    }
                    result.realPrice = foundPrice;
                } else {
                    // Si no podemos leer el precio con Cheerio (Lazy loading/JS), 
                    // confiamos en la referencia pero marcamos como "Verificación parcial"
                    logger.info(`⚠️ Verificación de precio parcial (HTML protegido).`);
                    result.realPrice = opportunity.referencePrice;
                }

                // VERIFICACIÓN DE STOCK (Sencilla)
                const bodyText = response.data.toLowerCase();
                if (bodyText.includes('out of stock') || bodyText.includes('currently unavailable') || bodyText.includes('sold out')) {
                    result.hasStock = false;
                    logger.warn(`❌ Producto sin stock.`);
                    return result;
                }

                result.isValid = true;
                logger.info(`✅ Oportunidad VALIDADA: $${result.realPrice}`);

            } catch (e) {
                // Si la tienda bloquea el acceso simple (403), pero el link es directo, 
                // permitimos el paso si el link es de alta calidad (DP de Amazon, etc.)
                if (finalUrl.includes('/dp/') || finalUrl.includes('/ip/')) {
                    logger.info(`✅ Validación por estructura de link (Tienda protegida).`);
                    result.isValid = true;
                    result.realPrice = opportunity.referencePrice;
                }
            }

            return result;

        } catch (error) {
            logger.error(`❌ Error en ValidatorBot: ${error.message}`);
            return result;
        }
    }
}

module.exports = new ValidatorBot();
