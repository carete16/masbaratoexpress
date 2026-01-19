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
                logger.warn(`❌ Validación fallida (isValid=false): ${opp.title}`);
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
                tienda: validation.storeName || opp.tienda
            };

            const audit = await Auditor.audit(dealData);
            if (!audit.isGoodDeal) {
                logger.warn(`📉 Auditoría rechazada: ${opp.title} | Razón: ${audit.reason || 'Descuento insuficiente'}`);
                return false;
            }

            // 4. GENERACIÓN DE CONTENIDO EDITORIAL (100% Original)
            logger.info(`✍️ Generando contenido editorial para: ${opp.title}`);
            const editorial = await AI.generateViralContent(dealData);
            dealData.viralContent = editorial.content;

            // 5. MONETIZACIÓN
            const monetizedLink = await LinkTransformer.transform(validation.finalUrl || opp.sourceLink, dealData);
            dealData.link = monetizedLink;
            dealData.original_link = validation.finalUrl || opp.sourceLink;

            // 6. PUBLICACIÓN
            dealData.id = crypto.createHash('md5').update(monetizedLink).digest('hex').substring(0, 12);

            const success = await Publisher.sendOffer(dealData);
            if (success) {
                logger.info(`🏆 POST PUBLICADO: ${opp.title}`);
                return true;
            }
            return false;

        } catch (e) {
            logger.error(`❌ Fallo crítico en ítem "${opp.title || 'Unknown'}": ${e.message}`);
            return false;
        }
    }

    getCategoryBalance() {
        const categories = ['Tecnología', 'Moda', 'Hogar', 'Gamer', 'Salud'];
        const counts = {};

        categories.forEach(cat => {
            const result = db.prepare('SELECT COUNT(*) as count FROM published_deals WHERE categoria = ?').get(cat);
            counts[cat] = result.count;
        });

        return counts;
    }

    needsCategory(categoria) {
        const balance = this.getCategoryBalance();
        const minCount = Math.min(...Object.values(balance));
        return balance[categoria] <= minCount + 2; // Priorizar categorías con menos ofertas
    }

    async start() {
        const Radar = require('./Bot1_Scraper');
        logger.info('🏛️ ARQUITECTURA EDITORIAL ACTIVADA');
        logger.info('📊 Sistema de Diversificación de Categorías: ACTIVO');

        let isRunning = false;
        const runCycle = async () => {
            if (isRunning) return;

            const todayStats = db.prepare("SELECT COUNT(*) as total FROM published_deals WHERE date(posted_at) = date('now')").get();
            if (todayStats.total >= this.dailyLimit) return;

            isRunning = true;
            try {
                // Mostrar balance actual
                const balance = this.getCategoryBalance();
                logger.info(`📊 Balance de Categorías: ${JSON.stringify(balance)}`);

                const opportunities = await Radar.getMarketOpportunities();

                // Priorizar oportunidades de categorías con menos representación
                const prioritized = opportunities.sort((a, b) => {
                    const catA = a.categoria || 'General';
                    const catB = b.categoria || 'General';
                    const needsA = this.needsCategory(catA) ? 1 : 0;
                    const needsB = this.needsCategory(catB) ? 1 : 0;
                    return needsB - needsA;
                });

                for (let opp of prioritized) {
                    const success = await this.processDeal(opp);
                    if (success) await new Promise(r => setTimeout(r, 8000));
                }
            } catch (e) {
                logger.error(`Error ciclo: ${e.message}`);
            }
            isRunning = false;
        };

        runCycle();
        setInterval(runCycle, this.interval);
    }
}

module.exports = new CoreProcessor();
