const logger = require('../utils/logger');
const { saveDeal, isRecentlyPublished } = require('../database/db');

class CoreProcessor {
    constructor() {
        this.interval = 5 * 60 * 1000; // 5 minutos
    }

    // --- INICIO DEL SISTEMA DE CLONACIÓN ---
    async start() {
        const ProScraper = require('../collectors/SlickdealsProScraper');
        const QA = require('../utils/QualityAssurance');
        const Telegram = require('../notifiers/TelegramNotifier');
        const AIProcessor = require('./AIProcessor');
        const LinkTransformer = require('../utils/LinkTransformer');

        logger.info('🚀 SISTEMA DE CLONACIÓN PERFECTA ACTIVADO. Monitorizando Slickdeals (5 min).');

        const runCycle = async () => {
            try {
                logger.info('🔄 CICLO DE EXTRACCIÓN INICIADO...');

                // 1. Obtener ofertas del Scraper Profesional (Exactitud Slickdeals)
                const rawDeals = await ProScraper.getFrontpageDeals();
                logger.info(`📥 Recibidas ${rawDeals.length} ofertas base.`);

                for (const rawDeal of rawDeals) {
                    try {
                        // 2. Filtro preliminar: ¿Ya la tenemos?
                        if (isRecentlyPublished(rawDeal.link, rawDeal.title)) continue;

                        // 3. Transformación y Monetización Crítica
                        let deal = { ...rawDeal };
                        deal.link = await LinkTransformer.transform(deal.link);

                        // 4. Validación de Calidad (QA System)
                        const qaResult = await QA.validateOffer(deal);
                        if (!qaResult.passed) {
                            // logger.warn(`🛑 RECHAZADA por QA: ${deal.title}`);
                            continue;
                        }

                        // Actualizar deal con mejoras de QA (si las hay)
                        deal = qaResult.deal;

                        // 5. Inteligencia Artificial (Copywriting Impactante)
                        const discount = deal.discount || 0;
                        const isHistoricLow = deal.is_historic_low || false;

                        try {
                            const viralContent = await AIProcessor.rewriteViral({ ...deal, isHistoricLow }, discount);
                            deal.viralContent = viralContent
                                .replace(/slickdeals?/gi, '')
                                .replace(/\s{2,}/g, ' ')
                                .trim();
                        } catch (aiErr) {
                            deal.viralContent = deal.title; // Fallback
                        }

                        // 6. PERSISTENCIA Y PUBLICACIÓN
                        const saved = saveDeal(deal);
                        if (saved && saved.changes > 0) {
                            logger.info(`✅ PUBLICANDO: ${deal.title} [-$${(deal.price_official - deal.price_offer).toFixed(2)}]`);

                            // Telegram Notification
                            await Telegram.sendDeal({
                                ...deal,
                                description: deal.viralContent
                            });

                            // Pausa para evitar rate-limits
                            await new Promise(r => setTimeout(r, 4000));
                        }

                    } catch (dealErr) {
                        logger.error(`Error procesando deal ${rawDeal.id}: ${dealErr.message}`);
                    }
                }

                logger.info('🏁 CICLO COMPLETADO. Esperando 5 minutos...');

            } catch (error) {
                logger.error(`❌ ERROR CRÍTICO EN CICLO: ${error.message}`);
            }
        };

        // Ejecutar inmediatamente y luego por intervalo
        runCycle();
        setInterval(runCycle, this.interval);
    }
}

module.exports = new CoreProcessor();
