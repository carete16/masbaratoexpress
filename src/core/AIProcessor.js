const axios = require('axios');
const logger = require('../utils/logger');
require('dotenv').config();

class AIProcessor {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
        this.model = 'gpt-3.5-turbo'; // O gpt-4o si tiene saldo
    }

    async rewriteViral(deal, discount) {
        if (!this.apiKey || this.apiKey === 'tu_key_aqui') {
            return this.fallbackRewrite(deal, discount);
        }

        try {
            const isHistoric = deal.isHistoricLow;

            let systemPrompt = `Actúa como un Director de Marketing experto en Ventas y Psicología del Consumidor para Telegram.`;

            let userPrompt = `
OBJETIVO: Redactar una promoción irresistible.

DATOS:
- Producto: ${deal.title}
- Precio Normal: $${deal.price_official}
- Precio Hoy: $${deal.price_offer}
- Descuento Directo: ${discount}%
- Tienda: ${deal.tienda}
${deal.coupon ? `- CUPÓN: ${deal.coupon} (MUY IMPORTANTE)` : ''}
${isHistoric ? '- CONTEXTO: ¡ES EL PRECIO MÁS BAJO DE LA HISTORIA (ALL TIME LOW)! 🔥💎' : '- Contexto: Buen descuento verificado.'}

ESTRATEGIA DE MENSAJE:
1. Tono: Urgente pero profesional. "Alguien se equivocó con este precio".
2. ${isHistoric ? 'DESTACA EN NEGRITA QUE ES MÍNIMO HISTÓRICO.' : 'Destaca el ahorro.'}
3. ${deal.coupon ? 'MENCIONA EL CUPÓN CLARAMENTE PARA QUE EL USUARIO LO COPIE.' : ''}
4. Usa emojis estratégicos (🔥, 💎, 🚨, 📉).

SALIDA (Formato HTML estricto):
${isHistoric ? '🚨 <b>¡MÍNIMO HISTÓRICO DETECTADO!</b>' : '🚀 <b>¡[TITULO EXPLOSIVO]!</b>'}

📦 <b>Producto:</b> ${deal.title}
🏢 <b>Tienda:</b> ${deal.tienda}

💰 <b>Antes:</b> <del>$${deal.price_official}</del>
🔥 <b>PÁGALO POR SOLO:</b> $${deal.price_offer}
📉 <b>AHORRO:</b> ${discount}% ${isHistoric ? '(¡PRECIO JAMÁS VISTO!)' : ''}

${deal.coupon ? `🎟️ <b>USA EL CUPÓN:</b> <code>${deal.coupon}</code> (Toca para copiar)` : ''}

⭐ <i>${isHistoric ? '💎 Oportunidad Única Verificada (ATL)' : 'Oportunidad Verificada por el equipo +BARATO'}</i>
━━━━━━━━━━━━━━━━━━
👉 <b>VER OFERTA AQUÍ:</b> [link]
━━━━━━━━━━━━━━━━━━

#MasbaratoDeals #OfertasUSA ${isHistoric ? '#MinimoHistorico #Ganga' : '#Descuentos'}`;

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

            const content = response.data.choices[0].message.content;
            // Fallback de seguridad por si la IA alucina y olvida el cupón
            if (deal.coupon && !content.includes(deal.coupon)) {
                return content.replace('━━━━━━━━━━━━━━━━━━', `🎟️ <b>CUPÓN EXTRA:</b> <code>${deal.coupon}</code>\n━━━━━━━━━━━━━━━━━━`);
            }
            return content;
        } catch (error) {
            logger.error(`Error en IAProcessor: ${error.message}`);
            return this.fallbackRewrite(deal, discount);
        }
    }

    fallbackRewrite(deal, discount) {
        const ahorro = deal.price_official - deal.price_offer;
        const ahorroPorcentaje = discount || Math.round((ahorro / deal.price_official) * 100);

        return `🚀 <b>¡OFERTA DETECTADA EN ${deal.tienda.toUpperCase()}!</b>

🔥 <b>${deal.title.toUpperCase()}</b>

💰 <b>Precio Normal:</b> <del>$${deal.price_official.toLocaleString()}</del>
✅ <b>PRECIO HOY:</b> $${deal.price_offer.toLocaleString()}
📉 <b>AHORRAS:</b> $${ahorro.toLocaleString()} (${ahorroPorcentaje}%)

⭐ <i>Oferta exclusiva verificada por +BARATO DEALS</i>
━━━━━━━━━━━━━━━━━━
👉 <b>COMPRA AQUÍ:</b> ${deal.link}
━━━━━━━━━━━━━━━━━━

#MasbaratoDeals #OfertasUSA #${deal.tienda.replace(/\s+/g, '')} #Ahorro`;
    }
}

module.exports = new AIProcessor();
