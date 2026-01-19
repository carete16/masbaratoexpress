const axios = require('axios');
const RSSParser = require('rss-parser');
const parser = new RSSParser({
    customFields: {
        item: ['vendorname', 'imagelink'],
    }
});
const logger = require('../utils/logger');

/**
 * BOT 1: EL RADAR (Referencia de Mercado)
 * Detecta oportunidades basándose en TechBargains RSS.
 */
class RadarBot {
    constructor() {
        this.rssUrl = 'https://feeds.feedburner.com/Techbargains';
    }

    async getMarketOpportunities() {
        try {
            logger.info(`📡 Escaneando radar: ${this.rssUrl}`);

            const response = await axios.get(this.rssUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 15000
            });

            const feed = await parser.parseString(response.data);
            const opportunities = [];

            for (const item of feed.items) {
                try {
                    const opp = await this.parseReference(item);
                    if (opp && this.validateReference(opp)) {
                        opportunities.push(opp);
                    }
                } catch (e) {
                    logger.warn(`Error en radar item: ${e.message}`);
                }
            }
            logger.info(`✅ Radar detectó ${opportunities.length} oportunidades potenciales.`);
            return opportunities;
        } catch (error) {
            logger.error(`❌ Error en RadarBot: ${error.message}`);
            return [];
        }
    }

    async parseReference(item) {
        try {
            const title = item.title || '';
            const link = item.link || item.guid || '';

            // TechBargains ofrece datos muy limpios en tags personalizados
            const storeName = item.vendorname || 'Global';
            const imageUrl = item.imagelink || '';

            // Extraer precio del título (suele estar al final: "Product Name $99")
            let priceOffer = 0;
            const priceMatch = title.match(/\$(\d+\.?\d*)/);
            if (priceMatch) {
                priceOffer = parseFloat(priceMatch[1]);
            }

            // Limpiar el título quitando el precio al final
            const cleanTitle = title.replace(/\s*\$\d+\.?\d*\s*$/, '').trim();

            return {
                title: cleanTitle,
                sourceLink: link,
                referencePrice: priceOffer,
                msrp: 0, // Sin estimación falsa. Dejamos que el Validador encuentre el real.
                store: storeName,
                image: imageUrl,
                description: item.contentSnippet || item.content || '',
                pubDate: item.pubDate,
                productId: null // TechBargains no da ASIN directo, se sacará del link si es Amazon
            };
        } catch (error) {
            logger.error(`Error parseando item: ${error.message}`);
            return null;
        }
    }

    validateReference(opp) {
        return opp.title && opp.sourceLink && opp.referencePrice > 0;
    }
}

module.exports = new RadarBot();
