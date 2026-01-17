const logger = require('../utils/logger');
const db = require('../database/db');

class CoreProcessor {
    constructor() {
        this.interval = 5 * 60 * 1000; // 5 minutos: Máxima frescura de ofertas
    }

    async start() {
        const Bot1 = require('./Bot1_Scraper');
        const Bot2 = require('./Bot2_Explorer');
        const Bot3 = require('./Bot3_Auditor');
        const Bot4 = require('./Bot4_Publisher');
        const Bot5 = require('./Bot5_BrowserSim');
        const QA = require('../utils/QualityAssurance');
        const AI = require('./AIProcessor');
        const LinkTransformer = require('../utils/LinkTransformer');

        logger.info('🛰️ ARQUITECTURA DE 5 BOTS ACTIVA (Sistema Profesional)');
        logger.info('🤖 BOT 1: RECOLECTOR (RSS Intelligence)');
        logger.info('🕵️ BOT 2: EXPLORADOR (Deep Trace + Proxy Scrubbing)');
        logger.info('⚖️ BOT 3: AUDITOR (Verificación de Ganga)');
        logger.info('🌐 BOT 5: FANTASMA (Browser Simulation Fallback)');
        logger.info('📱 BOT 4: PUBLICADOR (Monetización + Telegram)');

        let isRunning = false;
        const runCycle = async () => {
            if (isRunning) return;
            isRunning = true;
            logger.info('\n--- 🚀 INICIANDO CICLO DE ALTO RENDIMIENTO (5 BOTS) ---');

            try {
                // 1. BOT 1: RECOLECCIÓN
                const rawDeals = await Bot1.getFrontpageDeals();

                for (let deal of rawDeals) {
                    try {
                        if (db.isRecentlyPublished(deal.link, deal.title)) continue;
                        deal.original_link = deal.link;

                        // 2. BOT 2: EXPLORACIÓN PROFUNDA (Verdad de la Tienda)
                        const expedition = await Bot2.explore(deal.link);
                        if (expedition.isExpired) continue;

                        // Unificar precios: Priorizar Bot 2, si no, mantener Bot 1
                        if (expedition.price_offer) deal.price_offer = expedition.price_offer;
                        if (expedition.price_official) deal.price_official = expedition.price_official;

                        // Validar que el precio oficial sea realmente mayor (Comparativa Real)
                        if (deal.price_official <= deal.price_offer) deal.price_official = 0;

                        deal.link = expedition.finalUrl;
                        deal.coupon = expedition.coupon || deal.coupon;
                        deal.tienda = (expedition.store && expedition.store !== 'Oferta USA') ? expedition.store : deal.tienda;
                        if (expedition.image && !expedition.image.includes('placehold.co')) deal.image = expedition.image;

                        // 3. BOT 3: AUDITORÍA
                        const audit = await Bot3.audit(deal);
                        if (!audit.isGoodDeal) {
                            logger.warn(`❌ DESCARTADO (Auditoría): ${deal.title} - Motivo: ${audit.reason || 'No es buena oferta'}`);
                            continue;
                        }
                        deal.badge = audit.badge;
                        deal.is_historic_low = audit.isHistoricLow;

                        // 4. PRE-PROCESAMIENTO IA (Comparativa Tachada)
                        const discount = (deal.price_official > 0) ? Math.round(((deal.price_official - deal.price_offer) / deal.price_official) * 100) : 0;
                        const aiResult = await AI.generateViralContent(deal);
                        deal.viralContent = aiResult.content;

                        // 5. BOT 4: PUBLICACIÓN Y MONETIZACIÓN
                        let monetizedLink = await LinkTransformer.transform(deal.link, deal);

                        // 5.5. BOT 5: BROWSER SIMULATOR (Último Recurso)
                        if (monetizedLink && monetizedLink.includes('slickdeals.net')) {
                            logger.info(`🔄 Activando BOT 5 (Fantasma) para intentar rescate: ${deal.title}`);
                            const Bot5 = require('./Bot5_BrowserSim');
                            const bot5Result = await Bot5.extractRealLink(deal.original_link || deal.link);

                            if (bot5Result.success) {
                                monetizedLink = await LinkTransformer.transform(bot5Result.link, deal);
                                logger.info(`✅ BOT 5 rescató la oferta: ${deal.title}`);
                            }
                        }

                        // 6. VALIDACIÓN ESTRICTA (SISTEMA PROFESIONAL)
                        if (monetizedLink && (
                            monetizedLink.includes('slickdeals.net') ||
                            monetizedLink.includes('translate.google') ||
                            monetizedLink.includes('translate.googleusercontent')
                        )) {
                            logger.warn(`❌ DESCARTADO (Link Sucio Final): ${deal.title} -> ${monetizedLink.substring(0, 30)}`);
                            continue;
                        }

                        if (deal.tienda && (
                            deal.tienda.toLowerCase().includes('translate') ||
                            deal.tienda.toLowerCase().includes('google')
                        )) {
                            logger.warn(`❌ DESCARTADO (Tienda Corrupta): ${deal.title}`);
                            continue;
                        }

                        deal.link = monetizedLink;

                        // 7. LIMPIEZA ANTI-COMPETENCIA (RESGUARDO FINAL)
                        const blockRegex = /slickdeals|slick\s*deals|via\s+SD|SD\s+Exclusive/gi;
                        deal.title = deal.title.replace(blockRegex, '').replace(/\s{2,}/g, ' ').trim();

                        if (deal.tienda.toLowerCase().includes('slickdeals') || deal.tienda === 'Analizando...') {
                            deal.tienda = 'Oferta USA';
                        }

                        // Disparo final
                        const success = await Bot4.sendOffer(deal);
                        if (success) {
                            logger.info(`✅ [4 BOTS OK] Publicado: ${deal.title} ($${deal.price_offer} vs $${deal.price_official})`);
                            await new Promise(r => setTimeout(r, 6000));
                        }

                    } catch (innerE) { logger.error(`Error en item: ${innerE.message}`); }
                }

                logger.info('--- ✅ CICLO DE 5 BOTS FINALIZADO ---');
                isRunning = false;
            } catch (e) {
                logger.error(`❌ Error general: ${e.message}`);
                isRunning = false;
            }
        };

        runCycle();
        setInterval(runCycle, this.interval);
    }
}

module.exports = new CoreProcessor();
