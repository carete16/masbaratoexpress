const logger = require('../utils/logger');
const axios = require('axios');

/**
 * AIProcessor: Optimiza títulos y descripciones para maximizar ventas
 */
class AIProcessor {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
    }

    async generateOptimizedTitle(rawTitle) {
        // Recargar la llave por si no estaba lista en el constructor
        if (!this.apiKey) this.apiKey = process.env.OPENAI_API_KEY;

        if (!this.apiKey) {
            logger.warn("⚠️ OPENAI_API_KEY no detectada en .env. Usando traductor básico.");
            return this.pseudoTranslate(rawTitle);
        }

        try {
            const prompt = `Actúa como un experto en Growth Hacking y Ventas para un canal de ofertas.
Convierte este título de producto aburrido en un título MAGNÉTICO y CORTO (máximo 80 caracteres) que denote urgencia o gran oportunidad. 
Usa emojis adecuados. El idioma debe ser ESPAÑOL.
SOLO responde con el nuevo título, nada más.

Título original: ${rawTitle}`;

            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7,
                max_tokens: 60
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });

            let optimized = response.data.choices[0].message.content.trim();
            // Limpiar si la IA agregó comillas o "Título:"
            optimized = optimized.replace(/^["']|["']$/g, '').replace(/^Título:\s*/i, '');

            return optimized || this.pseudoTranslate(rawTitle);
        } catch (e) {
            logger.warn(`⚠️ OpenAI Title Error: ${e.message}. Usando fallback.`);
            return this.pseudoTranslate(rawTitle);
        }
    }

    pseudoTranslate(title) {
        if (!title) return "Oferta Exclusiva";

        let translated = title.toLowerCase();

        // 1. Reemplazos de frases comunes (Orden de importancia)
        const phrases = {
            'noise canceling': 'con cancelación de ruido',
            'noise cancelling': 'con cancelación de ruido',
            'wireless bluetooth': 'Bluetooth inalámbrico',
            'smart watch': 'Reloj Inteligente',
            'fast charging': 'Carga rápida',
            'stainless steel': 'Acero inoxidable',
            'limited edition': 'Edición limitada',
            'men\'s': 'para Hombre',
            'women\'s': 'para Mujer',
            'boy\'s': 'para Niño',
            'girl\'s': 'para Niña',
            'built-in': 'integrado',
            'high definition': 'Alta definición',
            'waterproof': 'Impermeable',
            'shockproof': 'Resistente a golpes'
        };

        for (let [eng, esp] of Object.entries(phrases)) {
            translated = translated.replace(new RegExp(eng, 'g'), esp);
        }

        // 2. Diccionario de palabras sueltas
        const dict = {
            'laptop': 'Portátil', 'purifier': 'Purificador', 'cool': 'Cool', 'fan': 'Ventilador',
            'smart': 'Inteligente', 'air': 'de Aire', 'watch': 'Reloj', 'shoes': 'Tenis',
            'sneakers': 'Tenis', 'headphones': 'Audífonos', 'earbuds': 'Audífonos',
            'monitor': 'Monitor', 'gaming': 'Gamer', 'shirt': 'Camisa', 'pant': 'Pantalón',
            'keyboard': 'Teclado', 'mouse': 'Mouse', 'cordless': 'Inalámbrico',
            'wireless': 'Inalámbrico', 'original': 'Original', 'clearance': '¡Remate!',
            'sale': 'Oferta', 'deal': 'Ganga', 'phone': 'Celular', 'camera': 'Cámara',
            'storage': 'Almacenamiento', 'fast': 'Rápido', 'pro': 'Pro', 'ultra': 'Ultra',
            'black': 'Negro', 'white': 'Blanco', 'blue': 'Azul', 'red': 'Rojo',
            'kit': 'Combo', 'pack': 'Paquete', 'new': 'Nuevo', 'off': 'de descuento',
            'discount': 'Descuento', 'free': 'Gratis', 'shipping': 'Envío', 'tv': 'Televisor',
            'ssd': 'Disco SSD', 'drive': 'Disco', 'leather': 'de Cuero', 'men': 'Hombre',
            'women': 'Mujer', 'kids': 'Niños', 'sport': 'Deportivo', 'running': 'para Correr',
            'speaker': 'Parlante', 'soundbar': 'Barra de Sonido', 'battery': 'Batería',
            'charger': 'Cargador', 'cable': 'Cable', 'case': 'Estuche', 'tablet': 'Tablet',
            'console': 'Consola', 'game': 'Juego', 'analog': 'Análogo', 'digital': 'Digital',
            'multi-function': 'Multifunción', 'light': 'Luz', 'heavy': 'Pesado',
            'and': 'y', 'for': 'para', 'with': 'con', 'set': 'Set de', 'inch': 'pulgadas'
        };

        let words = translated.split(' ');
        translated = words.map(w => {
            let clean = w.replace(/[^a-z-]/g, '');
            if (dict[clean]) return dict[clean];
            return w;
        }).join(' ');

        // Capitalizar la primera letra y limpiar espacios
        translated = translated.charAt(0).toUpperCase() + translated.slice(1);
        return translated.replace(/\s+/g, ' ').trim();
    }

    cleanTitle(title) {
        if (!title) return "Producto Exclusivo";
        // Limpiar marcas de agua de tiendas o textos largos innecesarios
        return title
            .replace(/Amazon.com\s*:|Wal-Mart\s*:|eBay\s*:/g, '')
            .split(' - ')[0]
            .split(' | ')[0]
            .trim();
    }

    async generateViralContent(deal) {
        try {
            const storeName = (deal.tienda || 'Oferta').toUpperCase();
            const discount = (deal.price_official && deal.price_offer && deal.price_official > deal.price_offer)
                ? Math.round(((deal.price_official - deal.price_offer) / deal.price_official) * 100)
                : 0;

            let description = deal.description || deal.originalDescription || '';

            if (!description || description.length < 50) {
                description = this.generateProfessionalDescription(deal, discount, storeName);
            } else {
                description = this.formatScrapedDescription(description, deal, discount, storeName);
            }

            return { content: description };
        } catch (e) {
            logger.error(`Error en AIProcessor: ${e.message}`);
            return { content: this.generateProfessionalDescription(deal, 0, 'USA Store') };
        }
    }

    formatScrapedDescription(rawDesc, deal, discount, storeName) {
        let clean = rawDesc
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
            .trim();

        if (clean.length > 400) {
            clean = clean.substring(0, 397) + '...';
        }

        let formatted = `🔥 [${storeName}] ${deal.title}\n`;
        if (deal.coupon) formatted += `🎟️ APLICA CUPÓN: ${deal.coupon}\n`;
        formatted += `💰 PRECIO: $${deal.price_offer}\n\n`;
        if (discount > 0) formatted += `📉 AHORRO DEL ${discount}% - Antes: $${deal.price_official}\n\n`;

        formatted += clean;
        formatted += `\n\n⚠️ Oferta por tiempo limitado. Stock sujeto a disponibilidad.`;
        return formatted;
    }

    generateProfessionalDescription(deal, discount, storeName) {
        let desc = `🔥 [${storeName}] ${deal.title}\n`;
        if (deal.coupon) desc += `🎟️ APLICA CUPÓN: ${deal.coupon}\n`;
        desc += `💰 PRECIO: $${deal.price_offer}\n\n`;
        if (discount > 0) desc += `💰 AHORRA ${discount}% - Antes: $${deal.price_official}\n\n`;

        desc += `${deal.title} representa una excelente oportunidad en ${storeName}. `;
        if (discount >= 30) desc += `Con un descuento del ${discount}%, este es uno de los mejores precios disponibles. `;
        desc += `Producto verificado y en stock.\n\n`;
        desc += `✅ Producto auténtico\n✅ Envío disponible\n✅ Garantía del fabricante\n`;
        if (deal.categoria) desc += `\n📦 Categoría: ${deal.categoria}\n`;
        desc += `\n⚠️ Oferta por tiempo limitado. Stock sujeto a disponibilidad.`;

        return desc;
    }
}

module.exports = new AIProcessor();
