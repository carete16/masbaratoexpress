const logger = require('../utils/logger');
const db = require('../database/db'); // También corrijo el db path si fallara later

/**
 * MOTOR DE PRECIOS MASBARATO EXPRESS
 */
class PriceEngine {
    static calculate(input) {
        const {
            price_usd = 0,
            weight_lb = 0,
            tax_usa_perc = 7,
            margin_perc = 30,
            trm = 3650,
            trm_offset = 300,
            cost_lb_usd = 6,
            min_weight = 4
        } = input;

        // 1. Asegurar tipos numéricos y peso mínimo
        const p_usd = parseFloat(price_usd) || 0;
        const w_lb = parseFloat(weight_lb) || 0;
        const m_weight = parseFloat(min_weight) || 4;

        const finalWeight = Math.max(w_lb, m_weight);

        // 2. Costos de importación
        const shippingCost = finalWeight * (parseFloat(cost_lb_usd) || 6);
        const taxCost = p_usd * (parseFloat(tax_usa_perc) || 7) / 100;
        const marginCost = p_usd * (parseFloat(margin_perc) || 30) / 100;

        // 3. Total USD
        const totalUsd = p_usd + shippingCost + taxCost + marginCost;

        // 4. Tasa Operativa
        const operationalTrm = parseFloat(trm) + parseFloat(trm_offset);

        // 5. Precio Final COP
        const rawCop = totalUsd * operationalTrm;
        const finalCop = Math.ceil(rawCop / 1000) * 1000;

        return {
            price_usd: p_usd,
            weight_used: finalWeight,
            shipping_usd: shippingCost,
            tax_usd: taxCost,
            margin_usd: marginCost,
            total_usd: totalUsd,
            trm_applied: operationalTrm,
            final_cop: finalCop
        };
    }
}

module.exports = PriceEngine;
