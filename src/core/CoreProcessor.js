const { isRecentlyPublished } = require('../database/db');
const logger = require('../utils/logger');
const LinkTransformer = require('../utils/LinkTransformer');
const VisualScraper = require('../utils/VisualScraper');
const AIProcessor = require('./AIProcessor');

class CoreProcessor {
    constructor() {
        this.minDiscount = 15; // MODO LANZAMIENTO: Más permisivo
        this.minScore = 15;    // MODO LANZAMIENTO
    }



    // --- INICIO DEL BUCLE AUTOMÁTICO ---
    async start() {
        // USAMOS EL MÓDULO GLOBAL (Slickdeals + TechBargains + BensBargains)
        const GlobalCollector = require('../collectors/GlobalDealsCollector');
        const Telegram = require('../notifiers/TelegramNotifier');
        const { db } = require('../database/db');

        logger.info('🚀 CoreProcessor RECARGADO. Escuchando múltiples fuentes (5 min).');

        const runCycle = async () => {
            try {
                logger.info('🔄 Iniciando ciclo de recolección GLOBAL...');
                // Obtener deals de TODAS las fuentes
                const rawDeals = await GlobalCollector.getDeals();
                const processedDeals = await this.processDeals(rawDeals);

                for (const deal of processedDeals) {
                    try {
                        // ULITMO CHEQUEO DB
                        const exists = db ? db.prepare('SELECT id FROM published_deals WHERE link = ? OR title = ?').get(deal.link, deal.title) : false;
                        if (exists) continue;

                        // GUARDAR Y PUBLICAR
                        if (db) {
                            const stmt = db.prepare(`
                                INSERT INTO published_deals (id, title, price_offer, price_official, link, image, tienda, categoria, description, posted_at, score)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
                            `);
                            stmt.run(deal.id, deal.title, deal.price_offer, deal.price_official || 0, deal.link, deal.image, deal.tienda, deal.categoria, deal.viralContent || '', deal.score);
                        }

                        await Telegram.sendDeal({
                            ...deal,
                            description: deal.viralContent
                        });

                        // Pequeña pausa para no floodear Telegram
                        await new Promise(r => setTimeout(r, 3000));

                    } catch (err) { logger.error(`Error publicando oferta ${deal.id}: ${err.message}`); }
                }

                logger.info('✅ Ciclo finalizado.');

            } catch (error) {
                logger.error(`❌ Error crítico en ciclo: ${error.message}`);
            }
        };

        // Ejecutar inmediatamente y luego cada 5 minutos
        runCycle();
        setInterval(runCycle, 5 * 60 * 1000); // 5 min
    }

    async processDeals(deals) {
        const validDeals = [];

        for (const deal of deals) {
            // 1. Detección implacable de Duplicados (Evitar repeticiones por link Y título)
            if (isRecentlyPublished(deal.link, deal.title)) {
                // logger.info(`⏭️ DUPLICADO DETECTADO: ${deal.title.substring(0, 50)}...`); 
                continue;
            }

            // 2. Transformar Link (Monetización + Bypass de Slickdeals)
            deal.link = await LinkTransformer.transform(deal.link);

            // 🚨 FILTRO ANTI-COMPETENCIA: Validar que NO quede ningún link de Slickdeals
            if (!deal.link || deal.link.includes('slickdeals.net')) {
                logger.warn(`⚠️ LINK DESCARTADO (Slickdeals o Nulo): ${deal.title.substring(0, 40)}...`);
                continue;
            }

            // 💰💰 KILL SWITCH DE MONETIZACIÓN (FACTURACIÓN SEGURA) 💰💰
            let isMonetized = false;
            // A. Amazon
            if (deal.link.includes('tag=masbaratodeal-20') || deal.link.includes(process.env.AMAZON_TAG)) isMonetized = true;
            // B. Sovrn (VigLink)
            else if (deal.link.includes('redirect.viglink.com')) isMonetized = true;
            // C. eBay (Campaign ID)
            else if (deal.link.includes('rover.ebay.com')) isMonetized = true; // LinkTransformer lo maneja
            // D. AliExpress
            else if (deal.link.includes('aff_short_key')) isMonetized = true;
            // E. Walmart (si tuvieramos ID) - asumiendo Sovrn si no
            else if (deal.link.includes('walmart') && deal.link.includes('viglink')) isMonetized = true;

            if (!isMonetized) {
                // logger.warn(`🛑 OFERTA DESCARTADA POR NO MONETIZABLE: ${deal.title}`);
                // logger.warn(`   Link: ${deal.link}`);
                continue; // ¡SE ACABÓ! NO PASARÁS.
            }


            // 📢 CORRECCIÓN DE NOMBRE DE TIENDA 📢
            // Si el link final es de Amazon, Walmart, etc., actualizar el nombre de la tienda.
            // Si venía como "Slickdeals", eliminarlo.
            if (deal.link) {
                if (deal.link.includes('amazon')) deal.tienda = 'Amazon';
                else if (deal.link.includes('walmart')) deal.tienda = 'Walmart';
                else if (deal.link.includes('ebay')) deal.tienda = 'eBay';
                else if (deal.link.includes('bestbuy')) deal.tienda = 'Best Buy';
                else if (deal.link.includes('target')) deal.tienda = 'Target';
                else if (deal.link.includes('nike')) deal.tienda = 'Nike';
                else deal.tienda = 'Tienda USA';
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

            // Ajustamos Score minimo
            const isHistoricLow = deal.is_historic_low || false;
            // Si es VIP (score > 100 por el collector), pasa directo
            const isVip = (deal.score || 0) > 150;

            // RELAJADO PARA LANZAMIENTO:
            // Si tiene descuento decente (>=15%) O Score mínimo (>=10), pasa.
            // Si es VIP o Histórico, pasa siempre.
            if (!isVip && !isHistoricLow && discount < 15 && deal.score < 10) {
                continue;
            }

            // 6. Formatear con Copywriting de Alto Impacto (IA)
            // Pasamos el flag isHistoricLow para que la IA lo sepa
            const viralContent = await AIProcessor.rewriteViral({ ...deal, isHistoricLow }, discount || 0);

            // 🚨 VALIDACIÓN FINAL CONTENIDO
            const cleanViralContent = viralContent
                .replace(/slickdeals?/gi, '')
                .replace(/\s{2,}/g, ' ')
                .trim();

            validDeals.push({ ...deal, viralContent: cleanViralContent });

            const tagsInfo = isHistoricLow ? '[💎 HISTORIC]' : (isVip ? '[🔥 VIP]' : '');
            logger.info(`✅ OFERTA APROBADA ($$$): ${deal.title} ${tagsInfo}`);
        }

        return validDeals;
    }

    calculateDiscount(original, offer) {
        if (!original || !offer || original <= offer) return 0;
        return Math.round(((original - offer) / original) * 100);
    }
}

module.exports = new CoreProcessor();
