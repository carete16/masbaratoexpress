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
                        // Filtro: ¿Ya lo procesamos? (Check por Link y Título)
                        const alreadySeen = db.isRecentlyPublished(deal.link, deal.title);
                        if (alreadySeen) continue;

                        deal.original_link = deal.link; // Respaldar antes de transformar/monetizar

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
                        deal.tienda = (expedition.store && expedition.store !== 'Oferta USA') ? expedition.store : deal.tienda;

                        // PRECIOS: Actualizar con lo verificado por el Bot 1
                        if (expedition.price_offer) deal.price_offer = expedition.price_offer;
                        if (expedition.price_official) deal.price_official = expedition.price_official;

                        // LOG DE PRECIOS PARA DEBUG
                        logger.info(`💰 Análisis de Precios: Oferta $${deal.price_offer} | Antes $${deal.price_official || 'N/A'}`);

                        // IMAGEN: Priorizar la de alta calidad encontrada por el bot
                        if (expedition.image && !expedition.image.includes('placehold.co')) {
                            deal.image = expedition.image;
                        }

                        // --- 🤖 FASE BOT 3: AUDITORÍA DE PRECIO ---
                        const AuditorBot = require('./PriceAuditorBot');
                        const audit = await AuditorBot.audit(deal);

                        if (!audit.isGoodDeal) {
                            logger.warn(`🛑 BOT 3 no certificó esta oferta. Descartando.`);
                            continue;
                        }

                        // Añadir sellos de calidad
                        deal.badge = audit.badge;
                        deal.is_historic_low = audit.isHistoricLow;

                        // --- 🤖 FASE BOT 2: MONETIZACIÓN Y PUBLICACIÓN ---
                        logger.info(`💰 BOT 2 procesando monetización para: ${deal.tienda} (${deal.price_offer}$)`);

                        // A. Monetización Real
                        const monetizedLink = await LinkTransformer.transform(deal.link);
                        if (!monetizedLink) {
                            logger.error(`❌ Fallo crítico de monetización para ${deal.title}.`);
                            continue;
                        }

                        if (monetizedLink.includes('slickdeals.net')) {
                            logger.warn(`⚠️ Link aún contiene Slickdeals: ${monetizedLink.substring(0, 40)}... Se publicará con bypass parcial.`);
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
