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
            const prompt = `Actúa como un Copywriter experto en Marketing de Afiliación y SEO de ofertas.
Tu objetivo es convertir esta oferta en un post irresistible para Telegram que maximice los CLICS.

REGLAS DE ORO:
1. Títulos con GANCHO (FOMO/Urgencia). Ej: "¡PRECIO MÍNIMO!", "¡CHOLLAZO!", "Vuela 🚀".
2. Resalta el AHORRO REAL. El usuario debe sentir que pierde dinero si no compra.
3. Usa MÁXIMO 4 emojis para mantener el profesionalismo.
4. Idioma: Español neutro/latino.

DATOS:
- Nombre: ${deal.title}
- Precio Antes: $${deal.price_official}
- Precio Ahora: $${deal.price_offer}
- Descuento: ${discount}%
- Tienda: ${deal.tienda}

SALIDA (Formato HTML):
🔥 <b>[TITULO CON GANCHO]</b>

🛒 <b>Producto:</b> ${deal.title}
🏢 <b>Tienda:</b> ${deal.tienda}

💰 <b>Normal:</b> <del>$[precio_normal]</del>
✅ <b>HOY:</b> $[precio_oferta]
📉 <b>Ahorras:</b> $[valor_ahorro] ([porcentaje]%)

⚡ <i>¡Liquidación por tiempo limitado!</i>
👉 <b>COMPRA AQUÍ:</b> [link]

#BaratoDealsNET #Oferta #Ahorro`;

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
        return `🔥 ${deal.title.toUpperCase()} EN OFERTA

🛒 Producto: ${deal.title}

💰 Antes: $${deal.price_official.toLocaleString()}
🔥 Ahora: $${deal.price_offer.toLocaleString()}
💸 Ahorro: $${ahorro.toLocaleString()} (${discount}%)

⏰ Oferta por tiempo limitado
👉 Comprar aquí: ${deal.link}

#MasbaratoDeals #Ofertas #Descuentos`;
    }
}

module.exports = new AIProcessor();
