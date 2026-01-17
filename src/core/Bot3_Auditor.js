const logger = require('../utils/logger');

/**
 * BOT 3: EL AUDITOR DE PRECIOS
 * Su misión: Verificar que el descuento no sea un engaño y certificar la oferta.
 */
class PriceAuditorBot {

    async audit(deal) {
        logger.info(`⚖️ BOT 3 (Análisis de Calidad) inspeccionando: ${deal.title.substring(0, 40)}...`);

        let report = {
            isGoodDeal: true,
            isHistoricLow: false,
            confidenceScore: 0,
            badge: null
        };

        const { price_offer, price_official, title, image } = deal;

        // 1. ANÁLISIS DE PUREZA (Anti-Competencia)
        if (title.toLowerCase().includes('slickdeals') || title.toLowerCase().includes('deal')) {
            // Limpieza agresiva de marcas de la competencia
            deal.title = deal.title.replace(/Slickdeals/gi, '').replace(/\[.*?\]/g, '').trim();
        }

        // 2. ANÁLISIS VISUAL (Calidad de Imagen)
        if (!image || image.includes('placehold.co') || image === '') {
            logger.warn(`🛑 BOT 3: Imagen de baja calidad detectada. Rechazando por decoro visual.`);
            report.isGoodDeal = false;
            return report;
        }

        // 3. ANÁLISIS MATEMÁTICO (Filtro de Ganga Real)
        const savings = price_official > price_offer ? price_official - price_offer : 0;
        const savingsPercent = price_official > 0 ? Math.round((savings / price_official) * 100) : 0;

        if (savingsPercent < 10) {
            logger.warn(`🛑 BOT 3: Descuento insignificante (${savingsPercent}%). Rechazando por falta de impacto.`);
            report.isGoodDeal = false;
            return report;
        }

        // 4. CERTIFICACIÓN DE LA OFERTA
        if (savingsPercent >= 50) {
            report.badge = 'LIQUIDACIÓN TOTAL';
            report.isHistoricLow = true;
        } else if (savingsPercent >= 30) {
            report.badge = 'SUPER PRECIO';
        } else {
            report.badge = 'OFERTA VERIFICADA';
        }

        // 5. CATEGORIZACIÓN SEMÁNTICA (Análisis de Contenido)
        const t = title.toLowerCase();
        if (t.match(/laptop|tv|computer|monitor|ssd|drive|tech|gadget/)) deal.categoria = 'Tecnología';
        else if (t.match(/shoe|sneaker|shirt|pants|jacket|dress|nike|adidas/)) deal.categoria = 'Moda';
        else if (t.match(/tool|drill|saw|hammer|dewalt|milwaukee/)) deal.categoria = 'Herramientas';
        else if (t.match(/cooker|fryer|pot|knife|kitchen|home|table/)) deal.categoria = 'Hogar';
        else if (t.match(/ps5|xbox|gaming|switch|game/)) deal.categoria = 'Gamer';
        else deal.categoria = 'General';

        logger.info(`✅ BOT 3 completado. Categoría: ${deal.categoria} | Badge: ${report.badge}`);
        return report;
    }
}

module.exports = new PriceAuditorBot();
