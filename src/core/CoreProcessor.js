const { isRecentlyPublished } = require('../database/db');
const logger = require('../utils/logger');
const LinkTransformer = require('../utils/LinkTransformer');
const VisualScraper = require('../utils/VisualScraper');
const AIProcessor = require('./AIProcessor');

class CoreProcessor {
    constructor() {
        this.minDiscount = 30; // Solo lo que de verdad vale la pena (Standard de Marketing)
        this.minScore = 50;    // Filtro de validación social (Reddit Ups / Slickdeals Heat)
    }

    async processDeals(deals) {
        const validDeals = [];

        for (const deal of deals) {
            // 1. Detección implacable de Duplicados (Evitar repeticiones)
            if (isRecentlyPublished(deal.link)) continue;

            // 2. Transformar Link (Monetización)
            deal.link = LinkTransformer.transform(deal.link);

            // 3. Mejora Visual (Extraer imagen HD original)
            deal.image = await VisualScraper.getHighResImage(deal.link, deal.image);

            // 4. Análisis de Oportunidad (Matemática de Venta)
            const discount = this.calculateDiscount(deal.price_official, deal.price_offer);

            // Lógica de "Ganga Real / Verdadero Chollazo": 
            // - O tiene un descuento masivo (>=30%)
            // - O es un producto con alta validación social (Score >= 50)
            const isLegendaryDeal = discount >= this.minDiscount;
            const isHighDemand = (deal.score || 0) >= this.minScore;

            if (!isLegendaryDeal && !isHighDemand) {
                // Si no cumple ninguno de los dos criterios de elite, se descarta
                continue;
            }

            // 4. Formatear con Copywriting de Alto Impacto (IA)
            const viralContent = await AIProcessor.rewriteViral(deal, discount || 0);
            validDeals.push({ ...deal, viralContent });

            logger.info(`✅ OFERTA VALIDADA: ${deal.title} [Dcto: ${discount}% | Score: ${deal.score}]`);
        }

        return validDeals;
    }

    calculateDiscount(original, offer) {
        if (!original || !offer) return 0;
        return Math.round(((original - offer) / original) * 100);
    }
}

module.exports = new CoreProcessor();
