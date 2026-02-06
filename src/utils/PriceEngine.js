class PriceEngine {
    static calculate(params) {
        // params: { price_usd, weight_lb, trm, trm_offset, cost_lb_usd, min_weight, tax_usa_perc, margin_perc }

        const price = parseFloat(params.price_usd) || 0;
        const weightRaw = parseFloat(params.weight_lb) || 0;
        const trm = parseFloat(params.trm) || 3900;
        const trmOp = Math.ceil((trm + (parseFloat(params.trm_offset) || 300)) / 10) * 10;

        let weight = Math.ceil(weightRaw);
        if (weight < (parseFloat(params.min_weight) || 4)) weight = (parseFloat(params.min_weight) || 4);

        const taxVal = price * ((parseFloat(params.tax_usa_perc) || 7) / 100);
        const subtotal = price + taxVal;

        const shipping = weight * (parseFloat(params.cost_lb_usd) || 6); // Tarifa plana por libra
        const marginVal = subtotal * ((parseFloat(params.margin_perc) || 30) / 100);

        const totalUSD = subtotal + marginVal + shipping;

        const finalCOP = Math.ceil((totalUSD * trmOp) / 1000) * 1000; // Redondeo a mil

        return {
            trm_applied: trmOp,
            weight_used: weight,
            final_cop: finalCOP,
            total_usd: totalUSD,
            tax_val: taxVal,
            shipping_val: shipping,
            margin_val: marginVal
        };
    }
}

module.exports = PriceEngine;
