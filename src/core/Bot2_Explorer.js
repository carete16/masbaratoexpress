const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');
const LinkResolver = require('../utils/LinkResolver');

class ValidatorBot {
    constructor() {
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36';
    }

    async validate(opportunity) {
        logger.info(`🔍 Validando: ${opportunity.title.substring(0, 50)}...`);

        let result = {
            isValid: true, // Por defecto verdadero si viene de fuente confiable
            realPrice: opportunity.referencePrice || 0,
            officialPrice: 0,
            hasStock: true,
            image: opportunity.image,
            title: opportunity.title,
            finalUrl: opportunity.sourceLink
        };

        try {
            // 1. Intentar resolver la URL real (Slickdeals -> Store)
            const resolvedUrl = await LinkResolver.resolve(opportunity.sourceLink);
            result.finalUrl = resolvedUrl || opportunity.sourceLink;

            // 2. Intentar scraping ligero si es Amazon/Walmart
            const config = {
                headers: { 'User-Agent': this.userAgent },
                timeout: 5000,
                validateStatus: null
            };

            if (result.finalUrl.includes('amazon.com') || result.finalUrl.includes('walmart.com')) {
                try {
                    const response = await axios.get(result.finalUrl, config);
                    if (response.status === 200) {
                        const $ = cheerio.load(response.data);

                        // Extraer precio real si asoma
                        let scrapPrice = 0;
                        if (result.finalUrl.includes('amazon')) {
                            scrapPrice = this.cleanPrice($('.a-price .a-offscreen').first().text());
                            result.officialPrice = this.cleanPrice($('.basisPrice .a-offscreen').first().text());
                        }

                        if (scrapPrice > 0) result.realPrice = scrapPrice;

                        // Verificar stock
                        const text = response.data.toLowerCase();
                        if (text.includes('out of stock') || text.includes('unavailable')) {
                            result.hasStock = false;
                        }
                    }
                } catch (e) {
                    logger.warn(`Scraping ligero falló para ${result.finalUrl}, usando data de referencia.`);
                }
            }

            logger.info(`✅ Validado: $${result.realPrice} en ${result.finalUrl.substring(0, 40)}...`);
            return result;

        } catch (error) {
            logger.error(`Error en validación, procediendo con datos de origen: ${error.message}`);
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
