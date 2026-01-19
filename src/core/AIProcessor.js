const axios = require('axios');
const logger = require('../utils/logger');
require('dotenv').config();

class AIProcessor {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
        this.model = 'gpt-4o';
    }

    async generateViralContent(deal) {
        const storeName = (deal.tienda || 'Oferta').toUpperCase();
        const discount = (deal.price_official && deal.price_offer && deal.price_official > deal.price_offer)
            ? Math.round(((deal.price_official - deal.price_offer) / deal.price_official) * 100)
            : 0;

        if (!this.apiKey || this.apiKey === 'tu_key_aqui') {
            return { content: this.fallbackEditorial(deal, discount, storeName) };
        }

        try {
            const systemPrompt = `Eres un redactor editorial experto de MasbaratoDeals. Estilo profesional y persuasivo.`;
            const userPrompt = `
Genera un post editorial para:
- Producto: ${deal.title}
- Tienda: ${storeName}
- Precio Final: $${deal.price_offer}
- Precio Original: $${deal.price_official || '---'}
- Descuento: ${discount}%

Estructura:
1. Título: 🔥 [${storeName}] ${deal.title} – $${deal.price_offer}
2. Análisis de oportunidad (150 palabras).
`;

            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 800
            }, {
                headers: { 'Authorization': `Bearer ${this.apiKey}` }
            });

            return { content: response.data.choices[0].message.content };
        } catch (error) {
            logger.error(`Error IA: ${error.message}`);
            return { content: this.fallbackEditorial(deal, discount, storeName) };
        }
    }

    fallbackEditorial(deal, discount, storeName) {
        return `🔥 [${storeName}] ${deal.title} – $${deal.price_offer}
    
Este ${deal.title} representa una oportunidad excepcional en el mercado actual. Con un descuento verificado, se posiciona como una de las mejores opciones en cuanto a relación calidad-precio.

La durabilidad y el rendimiento de este modelo han sido destacados en múltiples análisis técnicos, lo que garantiza una compra segura. Para aprovechar este precio, haz clic en el botón de abajo. Stock limitado.`;
    }
}

module.exports = new AIProcessor();
