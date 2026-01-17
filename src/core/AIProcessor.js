const axios = require('axios');
const logger = require('../utils/logger');
require('dotenv').config();

class AIProcessor {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
        this.model = 'gpt-4o'; // Recomendado para contenido editorial de alta calidad
    }

    async generateViralContent(deal) {
        const discount = (deal.price_official && deal.price_offer && deal.price_official > deal.price_offer)
            ? Math.round(((deal.price_official - deal.price_offer) / deal.price_official) * 100)
            : 0;

        // Si no hay API Key, usamos un fallback editorial básico
        if (!this.apiKey || this.apiKey === 'tu_key_aqui') {
            return { content: this.fallbackEditorial(deal, discount) };
        }

        try {
            const systemPrompt = `Eres un redactor editorial experto de MasbaratoDeals, un agregador de ofertas premium en español. 
Tu estilo es informativo, profesional y persuasivo, similar a Wirecutter o Xataka.
NO copies textos de terceros. Crea contenido 100% original.`;

            const userPrompt = `
Genera un post editorial para el siguiente producto:
- Producto: ${deal.title}
- Tienda: ${deal.tienda}
- Precio Final: $${deal.price_offer}
- Precio Original: $${deal.price_official || 'N/A'}
- Descuento: ${discount}%
${deal.coupon ? `- Cupón/Código: ${deal.coupon}` : ''}

REGLAS DE ESTRUCTURA (OBLIGATORIO):
1. Título EXACTO: 🔥 [${deal.tienda.toUpperCase()}] ${deal.title} – $${deal.price_offer} (Antes $${deal.price_official || '---'}) – ${discount}%OFF
2. Cuerpo (150-220 palabras estrictas): 
   - Una introducción sobre qué es el producto.
   - Un análisis de por qué es una buena oportunidad.
   - Instrucciones de cómo aplicar el ahorro.
   - Perfil ideal del comprador.
   - Nota sobre vigencia.
3. Disclaimer: Mención sutil de independencia.

Usa español neutro. NO menciones Slickdeals.`;

            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 800,
                temperature: 0.7
            }, {
                headers: { 'Authorization': `Bearer ${this.apiKey}` }
            });

            return { content: response.data.choices[0].message.content };
        } catch (error) {
            logger.error(`Error en IAProcessor Editorial: ${error.message}`);
            return { content: this.fallbackEditorial(deal, discount) };
        }
    }

    fallbackEditorial(deal, discount) {
        return `🔥 [${deal.tienda.toUpperCase()}] ${deal.title} – $${deal.price_offer} (Antes $${deal.price_official || '---'}) – ${discount}%OFF

El ${deal.title} es una solución líder en su categoría, diseñada para simplificar las tareas diarias con una eficiencia superior. Este producto destaca por su durabilidad y la calidad de sus componentes, lo que lo convierte en una inversión inteligente para cualquier hogar o usuario profesional que busque resultados consistentes a largo plazo.

En cuanto a su valor de mercado, esta es una oportunidad excepcional. Normalmente, este artículo se encuentra a un precio bastante más elevado, pero gracias a la oferta actual en ${deal.tienda}, puedes adquirirlo con un ahorro del ${discount}%. Es una de las rebajas más significativas detectadas en las últimas semanas, lo que lo posiciona como una "mejor compra" dentro de su segmento.

Para aprovechar este precio, simplemente debes seguir el enlace a la tienda oficial, donde el descuento ya está aplicado o se verá reflejado al finalizar tu pedido. No requiere códigos adicionales complejos, lo que facilita enormemente el proceso de compra. Este artículo es ideal para quienes valoran la relación calidad-precio y desean adquirir tecnología o productos de consumo masivo con garantías oficiales.

Ten en cuenta que estas ofertas son volátiles y están sujetas a la disponibilidad de stock en el sitio de destino. 

👉 Ver oferta
💡 Precio sujeto a cambios y disponibilidad. MasbaratoDeals participa en programas de afiliación para mantener su operación independiente.`;
    }
}

module.exports = new AIProcessor();
