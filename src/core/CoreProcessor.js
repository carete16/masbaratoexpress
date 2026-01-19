const logger = require('../utils/logger');
const { db, isRecentlyPublished } = require('../database/db');

class CoreProcessor {
    constructor() {
        // Intervalo de 15 minutos para el inicio dinámico (luego volverá a 2h)
        this.interval = 15 * 60 * 1000;
        this.dailyLimit = 100;
    }

    async start() {
        const Radar = require('./Bot1_Scraper');
        const Validator = require('./Bot2_Explorer');
        const Auditor = require('./Bot3_Auditor');
        const AI = require('./AIProcessor');
        const Publisher = require('./Bot4_Publisher');
        const LinkTransformer = require('../utils/LinkTransformer');

        logger.info('🏛️ ARQUITECTURA EDITORIAL ACTIVADA (Calidad sobre Cantidad)');

        let isRunning = false;
        const runCycle = async () => {
            if (isRunning) return;

            // Verificar si ya alcanzamos el límite diario (opcional, por ahora procesamos por ciclo)
            const todayStats = db.prepare("SELECT COUNT(*) as total FROM published_deals WHERE date(posted_at) = date('now')").get();
            if (todayStats.total >= this.dailyLimit) {
                logger.info(`✅ Límite diario alcanzado (${todayStats.total}/${this.dailyLimit}). Esperando al próximo día.`);
                return;
            }

            isRunning = true;
            logger.info('\n--- 🚀 INICIANDO CICLO EDITORIAL (ENFOQUE GOOGLE DISCOVER) ---');

            try {
                // 1. DETECCIÓN (Solo Referencia)
                const opportunities = await Radar.getMarketOpportunities();

                for (let opp of opportunities) {
                    try {
                        // Evitar duplicados
                        if (isRecentlyPublished(opp.sourceLink, opp.title)) continue;

                        // 2. VALIDACIÓN OBLIGATORIA (Tienda Origen)
                        const validation = await Validator.validate(opp);
                        if (!validation.isValid) {
                            logger.warn(`❌ Validación fallida (Link/Precio): ${opp.title}`);
                            continue;
                        }
                        if (!validation.hasStock) {
                            logger.warn(`❌ Producto sin Stock: ${opp.title}`);
                            continue;
                        }

                        // 3. AUDITORÍA (Verificación de Ganga)
                        const dealData = {
                            title: opp.title,
                            price_offer: validation.realPrice,
                            price_official: validation.officialPrice || opp.msrp || (validation.realPrice > 0 ? (validation.realPrice * 1.3).toFixed(2) : 0),
                            image: validation.image || opp.image,
                            tienda: validation.storeName
                        };
                        const audit = await Auditor.audit(dealData);
                        if (!audit.isGoodDeal) continue;

                        // 4. GENERACIÓN DE CONTENIDO EDITORIAL (100% Original)
                        logger.info(`✍️ Generando contenido editorial para: ${opp.title}`);
                        const editorial = await AI.generateViralContent(dealData);
                        dealData.viralContent = editorial.content;

                        // 5. MONETIZACIÓN
                        const monetizedLink = await LinkTransformer.transform(validation.finalUrl, dealData);
                        dealData.link = monetizedLink;
                        dealData.tienda = validation.storeName;

                        // 6. PUBLICACIÓN
                        // Generar ID único limpio (hash MD5) para evitar problemas de routring con URLs
                        const crypto = require('crypto');
                        dealData.id = crypto.createHash('md5').update(monetizedLink).digest('hex').substring(0, 12);

                        const success = await Publisher.sendOffer(dealData);
                        if (success) {
                            logger.info(`🏆 POST EDITORIAL PUBLICADO: ${opp.title}`);
                            // Esperar entre publicaciones para parecer humano y editorial
                            await new Promise(r => setTimeout(r, 10000));
                        }

                        // Detener si alcanzamos el límite en este ciclo
                        const currentCount = db.prepare("SELECT COUNT(*) as total FROM published_deals WHERE date(posted_at) = date('now')").get();
                        if (currentCount.total >= this.dailyLimit) break;

                    } catch (e) {
                        logger.error(`❌ Fallo crítico en ítem "${opp.title || 'Unknown'}": ${e.message}`);
                        console.error(e);
                    }
                }

                isRunning = false;

                // 7. LIMPIEZA AUTOMÁTICA (Purge de ofertas antiguas > 72 horas / 3 días)
                logger.info('🧹 Iniciando limpieza de ofertas caducas (ventana de 3 días)...');
                const deleted = db.prepare("DELETE FROM published_deals WHERE posted_at < datetime('now', '-72 hours')").run();
                if (deleted.changes > 0) {
                    logger.info(`♻️ Se eliminaron ${deleted.changes} ofertas antiguas para mantener la frescura.`);
                }

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
