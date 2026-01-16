const logger = require('../utils/logger');
const db = require('../database/db');

class CoreProcessor {
    constructor() {
        this.interval = 10 * 60 * 1000; // 10 minutos para dar tiempo a la exploración profunda
    }

    async start() {
        const ProScraper = require('../collectors/SlickdealsProScraper');
        const QA = require('../utils/QualityAssurance');
        const Telegram = require('../notifiers/TelegramNotifier');
        const AIProcessor = require('./AIProcessor');
        const LinkTransformer = require('../utils/LinkTransformer');
        const ExplorerBot = require('./DeepExplorerBot');

        logger.info('🚀 ARQUITECTURA DE DOBLE BOT ACTIVADA.');
        logger.info('🤖 BOT 1: Explorador de Profundidad (Validación y Cupones)');
        logger.info('🤖 BOT 2: Publicador Monetizado (Telegram + Web)');

        const runCycle = async () => {
            logger.info('\n--- 🤖 INICIANDO CICLO DE TRABAJO (Doble Bot) ---');

            try {
                // 1. RECOLECCIÓN INICIAL (Bot de Superficie)
                const rawDeals = await ProScraper.getFrontpageDeals();
                logger.info(`🔍 Encontradas ${rawDeals.length} ofertas en la superficie.`);

                for (let deal of rawDeals) {
                    try {
                        // Filtro: ¿Ya lo procesamos?
                        const alreadySeen = db.isRecentlyPublished(deal.link);
                        if (alreadySeen) continue;

                        // --- 🤖 FASE BOT 1: EXPLORACIÓN PROFUNDA ---
                        logger.info(`🕵️ BOT 1 explorando: ${deal.title.substring(0, 40)}...`);
                        const expedition = await ExplorerBot.explore(deal.link);

                        if (expedition.isExpired) {
                            logger.warn(`❌ Oferta expirada detectada por BOT 1. Ignorando.`);
                            continue;
                        }

                        // Actualizar datos con la verdad de la tienda real
                        deal.link = expedition.finalUrl;
                        deal.coupon = expedition.coupon || deal.coupon;
                        deal.tienda = expedition.store !== 'Desconocida' ? expedition.store : deal.tienda;

                        // --- 🤖 FASE BOT 2: MONETIZACIÓN Y PUBLICACIÓN ---
                        logger.info(`💰 BOT 2 procesando monetización para: ${deal.tienda}`);

                        // A. Monetización Real
                        const monetizedLink = await LinkTransformer.transform(deal.link);
                        if (!monetizedLink || monetizedLink.includes('slickdeals.net')) {
                            logger.error(`❌ Fallo de monetización para ${deal.title}. Link sigue siendo Slickdeals.`);
                            continue;
                        }
                        deal.link = monetizedLink;

                        // B. Control de Calidad
                        const qaReport = await QA.validateOffer(deal);
                        if (!qaReport.passed) {
                            logger.warn(`⚠️ QA Rechazó publicación: ${qaReport.report}`);
                            continue;
                        }

                        // C. IA Viral Branding
                        try {
                            const aiResult = await AIProcessor.generateViralContent(deal);
                            deal.viralContent = aiResult.content;
                        } catch (e) {
                            deal.viralContent = deal.title;
                        }

                        // D. Disparo Final a Canales
                        const success = await Telegram.sendOffer(deal);

                        if (success) {
                            logger.info(`✅ [BOTS OK] Oferta publicada con éxito: ${deal.title}`);
                            // Pausa táctica entre publicaciones
                            await new Promise(r => setTimeout(r, 5000));
                        }

                    } catch (innerError) {
                        logger.error(`Error procesando oferta: ${innerError.message}`);
                    }
                }

                logger.info('--- ✅ CICLO COMPLETADO. BOTS EN STANDBY. ---');

            } catch (error) {
                logger.error(`❌ Error en ciclo: ${error.message}`);
            }
        };

        // Iniciar
        runCycle();
        setInterval(runCycle, this.interval);
    }
}

module.exports = new CoreProcessor();
