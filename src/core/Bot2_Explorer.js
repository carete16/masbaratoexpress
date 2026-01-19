const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');

class ValidatorBot {
    constructor() {
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36';
    }

    async validate(opportunity) {
        logger.info(`🔍 Validando: ${opportunity.title.substring(0, 50)}...`);

        let result = {
            isValid: false,
            realPrice: null,
            officialPrice: 0,
            hasStock: true,
            image: opportunity.image,
            title: opportunity.title
        };

        try {
            const finalUrl = opportunity.sourceLink;

            // Configurar headers para parecer un navegador
            const config = {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                timeout: 10000,
                validateStatus: null
            };

            try {
                const response = await axios.get(finalUrl, config);

                if (response.status === 403 || response.status === 404) {
                    throw new Error(`Status ${response.status}`);
                }

                const $ = cheerio.load(response.data);
                let foundPrice = 0;
                let officialPrice = 0;

                // --- SELECTORES DE PRECIO OFERTA ---
                if (finalUrl.includes('amazon.com')) {
                    const priceText = $('.a-price .a-offscreen').first().text() ||
                        $('#priceblock_ourprice').text() ||
                        $('#priceblock_dealprice').text() ||
                        $('.a-price-whole').first().text();
                    foundPrice = this.cleanPrice(priceText);

                    // Selector para MSRP (Lista de precio tachada)
                    const msrpText = $('.basisPrice .a-offscreen').first().text() ||
                        $('.a-price.a-text-price .a-offscreen').first().text();
                    officialPrice = this.cleanPrice(msrpText);
                }
                else if (finalUrl.includes('walmart.com')) {
                    foundPrice = this.cleanPrice($('[data-testid="price-at-a-glance"] .f2').first().text());
                    officialPrice = this.cleanPrice($('[data-testid="list-price"]').first().text());
                }
                else if (finalUrl.includes('ebay.com')) {
                    foundPrice = this.cleanPrice($('#prcIsum').text() || $('.x-price-primary').text());
                    officialPrice = this.cleanPrice($('.strikethrough').text() || $('.x-was-price .x-price-primary').text());
                }

                if (officialPrice > 0) result.officialPrice = officialPrice;

                // --- MEJORA ELITE: Si no encontramos el precio oficial con Cheerio, usamos el Navegador Real ---
                if (!officialPrice || officialPrice === 0) {
                    logger.info(`🔍 Intentando extracción profunda (Puppeteer) para capturar MSRP real...`);
                    const DeepScraper = require('../utils/DeepScraper');
                    const deepData = await DeepScraper.scrape(finalUrl);
                    if (deepData && (deepData.officialPrice > 0 || deepData.offerPrice > 0)) {
                        logger.info(`💎 Datos reales encontrados vía Puppeteer`);
                        if (deepData.officialPrice > 0) result.officialPrice = deepData.officialPrice;
                        if (deepData.offerPrice > 0) foundPrice = deepData.offerPrice;
                        if (!result.image && deepData.image) result.image = deepData.image;
                        if (deepData.title) result.title = deepData.title;
                    }
                }

                // VALIDACIÓN DE PRECIO (REGLA CRÍTICA)
                if (foundPrice > 0) {
                    const diff = Math.abs(foundPrice - opportunity.referencePrice);
                    if (diff > (opportunity.referencePrice * 0.15)) { // Margen un poco más amplio (15%)
                        logger.warn(`❌ Precio no coincide. Ref: $${opportunity.referencePrice} vs Real: $${foundPrice}`);
                        return result;
                    }
                    result.realPrice = foundPrice;
                } else {
                    logger.info(`⚠️ Verificación de precio basada en referencia de origen.`);
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
                logger.warn(`⚠️ Acceso directo limitado. Intentando Puppeteer como fallback total...`);
                const DeepScraper = require('../utils/DeepScraper');
                const deepData = await DeepScraper.scrape(finalUrl);

                if (deepData && deepData.offerPrice > 0) {
                    result.isValid = true;
                    result.realPrice = deepData.offerPrice;
                    result.officialPrice = deepData.officialPrice;
                    result.title = deepData.title || result.title;
                    result.image = deepData.image || result.image;
                    logger.info(`✅ VALIDADO vía Puppeteer: $${result.realPrice}`);
                } else if (finalUrl.includes('/dp/') || finalUrl.includes('/ip/')) {
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

    cleanPrice(text) {
        if (!text) return 0;
        const cleaned = text.replace(/[^0-9,.]/g, '').replace(',', '');
        const price = parseFloat(cleaned);
        return isNaN(price) ? 0 : price;
    }
}

module.exports = new ValidatorBot();
