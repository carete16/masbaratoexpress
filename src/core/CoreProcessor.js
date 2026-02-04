const logger = require('../utils/logger');
const { db, isRecentlyPublished } = require('../database/db');

class CoreProcessor {
    constructor() {
        this.interval = 3 * 60 * 1000;
        this.dailyLimit = 500;
        this.lastCycle = null;
        this.lastSuccess = null;
        this.status = 'Iniciando...';
    }

    async processDeal(opp) {
        const Validator = require('./Bot2_Explorer');
        const Auditor = require('./Bot3_Auditor');
        const AI = require('./AIProcessor');
        const Publisher = require('./Bot4_Publisher');
        const LinkTransformer = require('../utils/LinkTransformer');
        const crypto = require('crypto');

        try {
            // Evitar duplicados (Omitir si es manual)
            if (!opp.isManual && isRecentlyPublished(opp.sourceLink, opp.title)) {
                logger.info(`⏭️ Duplicado omitido: ${opp.title}`);
                return false;
            }

            // 2. VALIDACIÓN (Reducida para manuales)
            let validation;
            try {
                validation = await Validator.validate(opp);
            } catch (vErr) {
                if (opp.isManual) {
                    validation = { isValid: true, hasStock: true, realPrice: opp.price_offer || 0, finalUrl: opp.sourceLink };
                } else throw vErr;
            }

            if (!validation.isValid && !opp.isManual) {
                logger.warn(`❌ Validación fallida (isValid=false): ${opp.title}`);
                return false;
            }

            // 3. AUDITORÍA (Verificación de Ganga)
            const dealData = {
                title: await AI.generateOptimizedTitle(validation.title || opp.title),
                price_offer: validation.realPrice,
                price_official: validation.officialPrice || 0,
                image: validation.image || opp.image,
                tienda: validation.storeName || opp.tienda,
                categoria: opp.categoria || validation.categoria || 'General',
                status: 'pending_express', // POR DEFECTO: Todo va a cola de aprobación (REGLA DE ORO)
                weight: (opp.weight !== undefined && opp.weight !== null) ? opp.weight : (validation.weight || 2.0)
            };

            // Auditoría solo falla para automáticos
            const audit = await Auditor.audit(dealData);
            if (!audit.isGoodDeal && !opp.isManual) {
                logger.warn(`📉 Auditoría rechazada: ${opp.title} | Razón: ${audit.reason || 'Descuento insuficiente'}`);
                return false;
            }

            // 4. GENERACIÓN DE CONTENIDO EDITORIAL
            logger.info(`✍️ Generando contenido editorial para: ${opp.title}`);
            const editorial = await AI.generateViralContent(dealData);
            dealData.viralContent = editorial.content;

            // 5. MONETIZACIÓN (Limpieza de links externos e inyección propia)
            const monetizedLink = await LinkTransformer.transform(validation.finalUrl || opp.sourceLink, dealData);
            dealData.link = monetizedLink;
            dealData.original_link = validation.finalUrl || opp.sourceLink;

            // 6. PUBLICACIÓN
            dealData.id = crypto.createHash('md5').update(monetizedLink).digest('hex').substring(0, 12);

            const success = await Publisher.sendOffer(dealData);
            if (success) {
                logger.info(`🏆 POST PROCESADO: ${opp.title}`);
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
        return balance[categoria] <= minCount + 2;
    }

    async start() {
        const Radar = require('./Bot1_Scraper');
        logger.info('🏛️ ARQUITECTURA EDITORIAL ACTIVADA');

        let isRunning = false;
        const runCycle = async () => {
            if (isRunning) return;
            this.lastCycle = new Date().toISOString();
            this.status = 'Escaneando...';

            const todayStats = db.prepare("SELECT COUNT(*) as total FROM published_deals WHERE date(posted_at) = date('now')").get();
            if (todayStats.total >= this.dailyLimit) {
                this.status = 'Límite diario alcanzado';
                return;
            }

            isRunning = true;
            try {
                const opportunities = await Radar.getMarketOpportunities();
                this.status = `Procesando ${opportunities.length} ofertas...`;

                for (let opp of opportunities) {
                    const success = await this.processDeal(opp);
                    if (success) {
                        this.lastSuccess = new Date().toISOString();
                        await new Promise(r => setTimeout(r, 8000));
                    }
                }
                this.status = 'Dormido (Intervalo)';
            } catch (e) {
                logger.error(`Error ciclo: ${e.message}`);
                this.status = `Error: ${e.message}`;
            }
            isRunning = false;
        };

        runCycle();
        setInterval(runCycle, this.interval);
    }
}

module.exports = new CoreProcessor();
