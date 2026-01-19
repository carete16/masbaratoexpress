const logger = require('../utils/logger');
const { db, isRecentlyPublished } = require('../database/db');

class CoreProcessor {
    constructor() {
        this.interval = 15 * 60 * 1000;
        this.dailyLimit = 100;
    }

    async processDeal(opp) {
        const Validator = require('./Bot2_Explorer');
        const Auditor = require('./Bot3_Auditor');
        const AI = require('./AIProcessor');
        const Publisher = require('./Bot4_Publisher');
        const LinkTransformer = require('../utils/LinkTransformer');
        const crypto = require('crypto');

        try {
            // Evitar duplicados
            if (isRecentlyPublished(opp.sourceLink, opp.title)) {
                logger.info(`⏭️ Duplicado omitido: ${opp.title}`);
                return false;
            }

            // 2. VALIDACIÓN OBLIGATORIA (Tienda Origen)
            const validation = await Validator.validate(opp);
            if (!validation.isValid) {
                logger.warn(`❌ Validación fallida (Link/Precio): ${opp.title}`);
                return false;
            }
            if (!validation.hasStock) {
                logger.warn(`❌ Producto sin Stock: ${opp.title}`);
                return false;
            }

            // 3. AUDITORÍA (Verificación de Ganga)
            const dealData = {
                title: opp.title,
                price_offer: validation.realPrice,
                price_official: validation.officialPrice || 0,
                image: validation.image || opp.image,
                tienda: validation.storeName
            };

            const audit = await Auditor.audit(dealData);
            if (!audit.isGoodDeal) {
                logger.warn(`📉 Descuento insuficiente (${audit.discount}%): ${opp.title}`);
                return false;
            }

            // 4. GENERACIÓN DE CONTENIDO EDITORIAL (100% Original)
            logger.info(`✍️ Generando contenido editorial para: ${opp.title}`);
            const editorial = await AI.generateViralContent(dealData);
            dealData.viralContent = editorial.content;

            // 5. MONETIZACIÓN
            const monetizedLink = await LinkTransformer.transform(validation.finalUrl, dealData);
            dealData.link = monetizedLink;
            dealData.tienda = validation.storeName;

            // 6. PUBLICACIÓN
            dealData.id = crypto.createHash('md5').update(monetizedLink).digest('hex').substring(0, 12);

            const success = await Publisher.sendOffer(dealData);
            if (success) {
                logger.info(`🏆 POST EDITORIAL PUBLICADO: ${opp.title}`);
                return true;
            }
            return false;

        } catch (e) {
            logger.error(`❌ Fallo crítico en ítem "${opp.title || 'Unknown'}": ${e.message}`);
            return false;
        }
    }

    async start() {
        const Radar = require('./Bot1_Scraper');
        logger.info('🏛️ ARQUITECTURA EDITORIAL ACTIVADA (Calidad sobre Cantidad)');

        let isRunning = false;
        const runCycle = async () => {
            if (isRunning) return;

            const todayStats = db.prepare("SELECT COUNT(*) as total FROM published_deals WHERE date(posted_at) = date('now')").get();
            if (todayStats.total >= this.dailyLimit) {
                logger.info(`✅ Límite diario alcanzado (${todayStats.total}/${this.dailyLimit}). Esperando al próximo día.`);
                return;
            }

            isRunning = true;
            logger.info('\n--- 🚀 INICIANDO CICLO EDITORIAL (ENFOQUE GOOGLE DISCOVER) ---');

            try {
                const opportunities = await Radar.getMarketOpportunities();
                for (let opp of opportunities) {
                    const success = await this.processDeal(opp);
                    if (success) {
                        await new Promise(r => setTimeout(r, 10000));
                    }

                    const currentCount = db.prepare("SELECT COUNT(*) as total FROM published_deals WHERE date(posted_at) = date('now')").get();
                    if (currentCount.total >= this.dailyLimit) break;
                }

                isRunning = false;
                logger.info('🧹 Iniciando limpieza de ofertas caducas (ventana de 3 días)...');
                db.prepare("DELETE FROM published_deals WHERE posted_at < datetime('now', '-72 hours')").run();

            } catch (e) {
                logger.error(`Error general en el ciclo: ${e.message}`);
                isRunning = false;
            }
        };

        runCycle();
        setInterval(runCycle, this.interval);
    }
}

module.exports = new CoreProcessor();
