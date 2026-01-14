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
            const prompt = `Actúa como un Director de Marketing experto en Ventas y Psicología del Consumidor.
Tu objetivo es redactar una promoción irresistible para Telegram sobre un "Chollazo Histórico".

ESTRATEGIA DE VENTA:
1. Usa gatillos de ESCASEZ y URGENCIA (¡Liquidación!, ¡Solo hoy!, ¡Se agotan!).
2. Enfócate en la PRUEBA SOCIAL: Menciona que es una oportunidad verificada manualmente.
3. El tono debe ser profesional pero electrizante, como alguien que acaba de descubrir un error de precio.
4. Indica que este precio rompe el mercado comparado con el histórico.

DATOS:
- Producto: ${deal.title}
- Precio Normal: $${deal.price_official}
- Precio Hoy: $${deal.price_offer}
- Descuento Directo: ${discount}%
- Tienda: ${deal.tienda}

SALIDA (Formato HTML):
🚀 <b>¡[TITULO EXPLOSIVO]!</b>

📦 <b>Producto:</b> ${deal.title}
🏢 <b>Tienda:</b> ${deal.tienda}

💰 <b>Antes:</b> <del>$${deal.price_official}</del>
🔥 <b>PÁGALO POR SOLO:</b> $${deal.price_offer}
📉 <b>AHORRO TOTAL:</b> $${discount}% (Ahorras $[valor_ahorro])

⭐ <i>Oportunidad Verificada por el equipo +BARATO</i>
━━━━━━━━━━━━━━━━━━
👉 <b>VER OFERTA AQUÍ:</b> [link]
━━━━━━━━━━━━━━━━━━

#MasbaratoDeals #OportunidadUnica #AhorroUSA`;

            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: this.model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7
            }, {
                headers: { 'Authorization': `Bearer ${this.apiKey}` }
            });

            return response.data.choices[0].message.content;
        } catch (error) {
            logger.error(`Error en IAProcessor: ${error.message}`);
            return this.fallbackRewrite(deal, discount);
        }
    }

    fallbackRewrite(deal, discount) {
        const ahorro = deal.price_official - deal.price_offer;
        const ahorroPorcentaje = discount || Math.round((ahorro / deal.price_official) * 100);

        return `🚀 <b>¡CHOLLAZO DETECTADO EN ${deal.tienda.toUpperCase()}!</b>

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
