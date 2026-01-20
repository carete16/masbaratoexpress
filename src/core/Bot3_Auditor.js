const logger = require('../utils/logger');

/**
 * BOT 3: EL AUDITOR DE ÉLITE
 * Evalúa la calidad de la ganga, asigna puntuaciones de confianza 
 * y badges premium basados en algoritmos de ahorro.
 */
class PriceAuditorBot {

    async audit(deal) {
        logger.info(`⚖️ Auditoría de Élite: ${deal.title.substring(0, 40)}...`);

        let report = {
            isGoodDeal: true,
            isHistoricLow: false,
            confidenceScore: 0,
            badge: null,
            reason: null,
            discount: 0,
            quality: 'Standard'
        };

        const { price_offer, price_official, title } = deal;

        // 1. LIMPIEZA DE TÍTULO PROFESIONAL
        deal.title = deal.title
            .replace(/Slickdeals/gi, '')
            .replace(/\[.*?\]/g, '')
            .replace(/\(\d+.*?\)/g, '')
            .trim();

        // 2. CÁLCULOS DE PRECISIÓN
        if (price_offer <= 0 || price_offer > 5000) { // Bloqueo de precios basura o regionales
            report.isGoodDeal = false;
            report.reason = 'Precio fuera de rango lógico para ofertas';
            return report;
        }

        const savings = (price_official > price_offer) ? price_official - price_offer : 0;
        const savingsPercent = price_official > 0 ? Math.round((savings / price_official) * 100) : 0;
        report.discount = savingsPercent;

        // 3. FILTRO DE CALIDAD ESTRICTO: SOLO DESCUENTOS REALES
        if (price_official <= 0) {
            report.isGoodDeal = false;
            report.reason = 'Sin precio oficial de referencia. No se puede verificar descuento.';
            return report;
        }

        if (savingsPercent < 15) {
            report.isGoodDeal = false;
            report.reason = `Ahorro insuficiente (${savingsPercent}%). El estándar mínimo es 15%.`;
            return report;
        }

        // 4. ALGORITMO DE PUNTUACIÓN (Confidence Score 0-100)
        let score = 50; // Base
        if (savingsPercent >= 50) score += 40;
        else if (savingsPercent >= 30) score += 25;

        // Bonus por tiendas top
        if (deal.tienda === 'Amazon' || deal.tienda === 'Best Buy') score += 10;

        report.confidenceScore = Math.min(score, 100);

        // 5. ASIGNACIÓN DE BADGES PREMIUM
        if (savingsPercent >= 60) {
            report.badge = 'LIQUIDACIÓN';
            report.quality = 'Epic';
        } else if (savingsPercent >= 40) {
            report.badge = 'SUPER PRECIO';
            report.quality = 'Premium';
        } else if (savingsPercent >= 20) {
            report.badge = 'OFERTA VERIFICADA';
            report.quality = 'Good';
        } else {
            report.badge = 'PRECIO BAJO';
        }

        // 6. CATEGORIZACIÓN SEMÁNTICA AVANZADA
        const t = title.toLowerCase();
        if (t.match(/laptop|tv|computer|monitor|ssd|drive|tech|gadget|iphone|samsung|galaxy|phone|ipad|tablet/)) deal.categoria = 'Tecnología';
        else if (t.match(/shoe|sneaker|shirt|pants|jacket|dress|nike|adidas|clothing|watch/)) deal.categoria = 'Moda';
        else if (t.match(/tool|drill|saw|hammer|dewalt|milwaukee|makita/)) deal.categoria = 'Herramientas';
        else if (t.match(/cooker|fryer|pot|knife|kitchen|home|table|furniture|vacuum|dyson/)) deal.categoria = 'Hogar';
        else if (t.match(/ps5|xbox|gaming|switch|game|nintendo|controller/)) deal.categoria = 'Gamer';
        else if (t.match(/vitamin|protein|gym|fitness|makeup|skin|beauty/)) deal.categoria = 'Salud';
        else deal.categoria = 'General';

        deal.badge = report.badge;
        deal.score = report.confidenceScore;

        logger.info(`✅ Auditoría completa: Score ${report.confidenceScore} | Discount ${savingsPercent}%`);
        return report;
    }
}

module.exports = new PriceAuditorBot();
