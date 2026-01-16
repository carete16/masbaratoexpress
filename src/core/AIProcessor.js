const axios = require('axios');
const logger = require('../utils/logger');
require('dotenv').config();

class AIProcessor {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
        this.model = 'gpt-3.5-turbo'; // O gpt-4o si tiene saldo
    }

    /**
     * MÉTODO INTEGRAL DE GENERACIÓN VIRAL
     * Sincronizado con CoreProcessor.js
     */
    async generateViralContent(deal) {
        // Calcular descuento si no viene pre-calculado
        const discount = (deal.price_official && deal.price_offer && deal.price_official > deal.price_offer)
            ? Math.round(((deal.price_official - deal.price_offer) / deal.price_official) * 100)
            : 0;

        if (!this.apiKey || this.apiKey === 'tu_key_aqui') {
            return { content: this.fallbackRewrite(deal, discount) };
        }

        try {
            const isHistoric = deal.is_historic_low || deal.badge === 'MÍNIMO HISTÓRICO';
            let systemPrompt = `Actúa como un Director de Marketing experto en Ventas para Telegram.`;

            let userPrompt = `
OBJETIVO: Redactar una promoción irresistible.

DATOS:
- Producto: ${deal.title}
- Precio Normal: $${deal.price_official || 'N/A'}
- Precio Hoy: $${deal.price_offer}
- Ahorro: ${discount}%
- Tienda: ${deal.tienda}
${deal.coupon ? `- CUPÓN: ${deal.coupon}` : ''}

SALIDA (HTML): 🚀 <b>¡OFERTA EN ${deal.tienda.toUpperCase()}!</b>
📦 <b>Producto:</b> ${deal.title}
💰 <b>Antes:</b> <del>$${deal.price_official || '---'}</del>
🔥 <b>HOY:</b> $${deal.price_offer}
📉 <b>AHORRO:</b> ${discount}%

${deal.coupon ? `🎟️ <b>CUPÓN:</b> <code>${deal.coupon}</code>` : ''}
👉 <b>VER OFERTA:</b> [link]
#MasbaratoDeals #OfertasUSA`;

            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.7
            }, {
                headers: { 'Authorization': `Bearer ${this.apiKey}` }
            });

            return { content: response.data.choices[0].message.content };
        } catch (error) {
            logger.error(`Error en IAProcessor: ${error.message}`);
            return { content: this.fallbackRewrite(deal, discount) };
        }
    }

    fallbackRewrite(deal, discount) {
        const ahorro = (deal.price_official && deal.price_official > deal.price_offer) ? (deal.price_official - deal.price_offer) : 0;
        const compHtml = deal.price_official > 0 ? `<del>$${deal.price_official.toLocaleString()}</del>` : '---';

        return `🚀 <b>¡NUEVA OFERTA EN ${deal.tienda.toUpperCase()}!</b>

🔥 <b>${deal.title.toUpperCase()}</b>

💰 <b>Antes:</b> ${compHtml}
✅ <b>PRECIO HOY:</b> $${deal.price_offer.toLocaleString()}
📉 <b>DESCUENTO:</b> ${discount}%

⭐ <i>Oferta verificada por el equipo +BARATO DEALS</i>
━━━━━━━━━━━━━━━━━━
👉 <b>COMPRA AQUÍ:</b> ${deal.link}
━━━━━━━━━━━━━━━━━━

#MasbaratoDeals #OfertasUSA #${deal.tienda.replace(/\s+/g, '')}`;
    }
}

module.exports = new AIProcessor();
