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
            // 1. Detección implacable de Duplicados (Evitar repeticiones por link Y título)
            if (isRecentlyPublished(deal.link, deal.title)) {
                logger.info(`⏭️ DUPLICADO DETECTADO: ${deal.title.substring(0, 50)}...`);
                continue;
            }

            // 2. Transformar Link (Monetización + Bypass de Slickdeals)
            deal.link = await LinkTransformer.transform(deal.link);

            // 🚨 FILTRO ANTI-COMPETENCIA: Validar que NO quede ningún link de Slickdeals
            if (deal.link && deal.link.includes('slickdeals.net')) {
                logger.warn(`⚠️ LINK DE SLICKDEALS DETECTADO Y BLOQUEADO: ${deal.title.substring(0, 50)}...`);
                logger.warn(`   Link problemático: ${deal.link}`);
                continue; // DESCARTAR esta oferta completamente
            }

            // 3. Mejora Visual (Extraer imagen HD original)
            deal.image = await VisualScraper.getHighResImage(deal.link, deal.image);

            // 4. Limpieza de Título (Eliminar palabras prohibidas + Referencias a competencia)
            deal.title = deal.title
                .replace(/chollazo|chollo|chollito/gi, 'Oferta')
                .replace(/slickdeals?/gi, '') // Eliminar "Slickdeals" o "Slickdeal"
                .replace(/\s{2,}/g, ' ') // Limpiar espacios dobles
                .trim();

            // 🚨 Limpieza adicional de descripción si existe
            if (deal.description) {
                deal.description = deal.description
                    .replace(/slickdeals?/gi, '')
                    .replace(/\s{2,}/g, ' ')
                    .trim();
            }

            // 5. Análisis de Oportunidad (Matemática de Venta)
            const discount = this.calculateDiscount(deal.price_official, deal.price_offer);

            // Lógica de "Ganga Real / Verdadero Chollazo": 
            // - O tiene un descuento masivo (>=30%)
            // - O es un producto con alta validación social (Score >= 50)
            // - O es un MÍNIMO HISTÓRICO (is_historic_low) -> Prioridad Absoluta

            const isHistoricLow = deal.is_historic_low || false;

            // Si es mínimo histórico, somos más flexibles con el descuento (hasta 15% es bueno en marcas top)
            const minDiscountAdjusted = isHistoricLow ? 15 : this.minDiscount;

            const isLegendaryDeal = discount >= minDiscountAdjusted;
            const isHighDemand = (deal.score || 0) >= this.minScore;

            if (!isLegendaryDeal && !isHighDemand && !isHistoricLow) {
                // Si no cumple ninguno de los tres criterios de elite, se descarta
                continue;
            }

            // 6. Formatear con Copywriting de Alto Impacto (IA)
            // Pasamos el flag isHistoricLow para que la IA lo sepa
            const viralContent = await AIProcessor.rewriteViral({ ...deal, isHistoricLow }, discount || 0);

            // 🚨 VALIDACIÓN FINAL: Asegurar que el contenido viral NO mencione Slickdeals
            const cleanViralContent = viralContent
                .replace(/slickdeals?/gi, '')
                .replace(/\s{2,}/g, ' ')
                .trim();

            validDeals.push({ ...deal, viralContent: cleanViralContent });

            const tagsInfo = isHistoricLow ? '[💎 HISTORIC LOW]' : `[Dcto: ${discount}%]`;
            logger.info(`✅ OFERTA VALIDADA Y LIMPIA: ${deal.title} ${tagsInfo} [Score: ${deal.score}]`);
        }

        return validDeals;
    }

    calculateDiscount(original, offer) {
        if (!original || !offer || original <= offer) return 0;
        return Math.round(((original - offer) / original) * 100);
    }
}

module.exports = new CoreProcessor();
