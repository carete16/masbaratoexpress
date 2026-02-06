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

        // PROMPT TÉCNICO: precio_usd + 30% margen + 7% tax + envío (peso * tarifa)
        const p_usd = parseFloat(price_usd) || 0;
        const w_lb = parseFloat(weight_lb) || 0;
        const m_weight = parseFloat(min_weight) || 4;

        // 1. Aplicar margen del 30% (Multiplicador 1.30)
        const price_with_margin = p_usd * 1.30;

        // 2. Aplicar Tax USA del 7% (sobre precio con margen)
        const price_with_tax = price_with_margin * 1.07;

        // 3. Calcular peso con +1 libra de seguridad (según requerimiento técnico)
        // Usamos el peso mayor entre (real + 1) y el mínimo legal (4lbs)
        const finalWeight = Math.max(w_lb + 1, m_weight);
        const shippingCost = finalWeight * (parseFloat(cost_lb_usd) || 6);

        // 4. Subtotal USD final
        const totalUsd = price_with_tax + shippingCost;

        // 5. Tasa Operativa (TRM + 300)
        const operationalTrm = parseFloat(trm) + parseFloat(trm_offset);

        // 6. Precio Final COP (Redondeado SIEMPRE hacia arriba a la milena)
        const rawCop = totalUsd * operationalTrm;
        const finalCop = Math.ceil(rawCop / 1000) * 1000;

        return {
            price_usd: p_usd,
            weight_used: finalWeight,
            shipping_usd: shippingCost,
            tax_usd: price_with_tax - price_with_margin, // Informativo
            margin_usd: price_with_margin - p_usd, // Informativo
            total_usd: totalUsd,
            trm_applied: operationalTrm,
            final_cop: finalCop
        };
    }
}

module.exports = PriceEngine;
