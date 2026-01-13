const { isRecentlyPublished } = require('../database/db');
const logger = require('../utils/logger');
const LinkTransformer = require('../utils/LinkTransformer');
const AIProcessor = require('./AIProcessor');

class CoreProcessor {
    constructor() {
        this.minDiscount = 25;
    }

    async processDeals(deals) {
        const validDeals = [];

        for (const deal of deals) {
            // 1. Verificar duplicados
            if (isRecentlyPublished(deal.link)) {
                logger.info(`Producto duplicado omitido: ${deal.title}`);
                continue;
            }

            // 2. Transformar Link a Afiliado (Monetización)
            deal.link = LinkTransformer.transform(deal.link);

            // 3. Calcular descuento
            const discount = this.calculateDiscount(deal.price_official, deal.price_offer);

            // Filtro de descuento
            if (discount > 0 && discount < this.minDiscount) {
                logger.info(`Descuento insuficiente (${discount}%): ${deal.title}`);
                continue;
            }

            // 4. Formatear para Telegram con IA (Viralización)
            const viralContent = await AIProcessor.rewriteViral(deal, discount || 0);
            validDeals.push({ ...deal, viralContent });
        }

        return validDeals;
    }

    calculateDiscount(original, offer) {
        if (!original || !offer) return 0;
        return Math.round(((original - offer) / original) * 100);
    }
}

module.exports = new CoreProcessor();
