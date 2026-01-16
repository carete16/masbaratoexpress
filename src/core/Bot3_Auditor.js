const logger = require('../utils/logger');

/**
 * BOT 3: EL AUDITOR DE PRECIOS
 * Su misión: Verificar que el descuento no sea un engaño y certificar la oferta.
 */
class PriceAuditorBot {

    async audit(deal) {
        logger.info(`⚖️ BOT 3 (Auditor) analizando competitividad: ${deal.title.substring(0, 40)}...`);

        let report = {
            isGoodDeal: true,
            isHistoricLow: false,
            confidenceScore: 0,
            badge: null
        };

        const { price_offer, price_official } = deal;

        // 1. Validar el Margen de Ahorro
        if (price_official > 0) {
            const savings = ((price_official - price_offer) / price_official) * 100;

            if (savings >= 50) {
                report.badge = 'LIQUIDACIÓN RADICAL';
                report.confidenceScore = 100;
                report.isHistoricLow = true;
            } else if (savings >= 25) {
                report.badge = 'OFERTA VERIFICADA';
                report.confidenceScore = 80;
            } else if (savings > 0) {
                report.badge = 'AHORRO REAL';
                report.confidenceScore = 60;
            } else {
                report.isGoodDeal = false; // No hay ahorro real detectado
            }
        } else {
            // Si no hay precio oficial, pero la oferta viene de Frontpage de Slickdeals, es buena por defecto
            report.badge = 'TENDENCIA EN USA';
            report.confidenceScore = 70;
        }

        // 2. Filtro de Spam (Precios demasiado bajos que suelen ser errores o estafas)
        if (price_offer < 0.50) {
            logger.warn(`🛑 BOT 3: Precio sospechoso ($${price_offer}). Posible error de sistema. Rehusando.`);
            report.isGoodDeal = false;
        }

        logger.info(`✅ BOT 3 completado. Resultado: ${report.badge || 'Normal'}`);
        return report;
    }
}

module.exports = new PriceAuditorBot();
