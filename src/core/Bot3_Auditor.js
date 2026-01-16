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

        // Calcular ahorro
        const savings = deal.price_official > deal.price_offer ? deal.price_official - deal.price_offer : 0;
        const savingsPercent = deal.price_official > 0 ? Math.round((savings / deal.price_official) * 100) : 0;

        // Si no hay precio oficial detectado, o el precio de oferta es mayor o igual,
        // intentamos estimar un badge basado en el score (si existe)
        if (deal.price_official <= deal.price_offer || deal.price_official === 0) {
            report.isHistoricLow = false;
            // Asumiendo que deal.score puede existir para determinar el badge
            report.badge = deal.score && deal.score > 80 ? 'OFERTA DESTACADA' : 'TENDENCIA EN USA';
            report.confidenceScore = deal.score || 70; // Usar score si existe, sino un valor por defecto
            // No retornamos aquí, continuamos con el filtro de spam si es necesario
        } else {
            // 1. Validar el Margen de Ahorro
            if (savingsPercent >= 50) {
                report.badge = 'LIQUIDACIÓN RADICAL';
                report.confidenceScore = 100;
                report.isHistoricLow = true;
            } else if (savingsPercent >= 25) {
                report.badge = 'OFERTA VERIFICADA';
                report.confidenceScore = 80;
            } else if (savingsPercent > 0) {
                report.badge = 'AHORRO REAL';
                report.confidenceScore = 60;
            } else {
                report.isGoodDeal = true;
                report.badge = 'TENDENCIA EN USA';
                report.confidenceScore = 70;
            }
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
