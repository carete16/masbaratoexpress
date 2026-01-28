const logger = require('../utils/logger');

/**
 * AIProcessor: Extrae y formatea descripciones directamente del producto
 * Sin necesidad de OpenAI - usa la info real del scraping
 */
class AIProcessor {
    async generateViralContent(deal) {
        try {
            const storeName = (deal.tienda || 'Oferta').toUpperCase();
            const discount = (deal.price_official && deal.price_offer && deal.price_official > deal.price_offer)
                ? Math.round(((deal.price_official - deal.price_offer) / deal.price_official) * 100)
                : 0;

            // Usar la descripción ya extraída del scraping o generar una básica
            let description = deal.description || deal.originalDescription || '';

            // Si no hay descripción del scraping, generar una profesional
            if (!description || description.length < 50) {
                description = this.generateProfessionalDescription(deal, discount, storeName);
            } else {
                // Limpiar y formatear la descripción extraída
                description = this.formatScrapedDescription(description, deal, discount, storeName);
            }

            return { content: description };
        } catch (e) {
            logger.error(`Error en AIProcessor: ${e.message}`);
            return { content: this.generateProfessionalDescription(deal, 0, 'USA Store') };
        }
    }

    formatScrapedDescription(rawDesc, deal, discount, storeName) {
        // Limpiar HTML y caracteres especiales
        let clean = rawDesc
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
            .trim();

        // Limitar longitud
        if (clean.length > 400) {
            clean = clean.substring(0, 397) + '...';
        }

        // Agregar encabezado con precio
        let formatted = `🔥 [${storeName}] ${deal.title}\n`;

        if (deal.coupon) {
            formatted += `🎟️ APLICA CUPÓN: ${deal.coupon}\n`;
        }

        formatted += `💰 PRECIO: $${deal.price_offer}\n\n`;

        if (discount > 0) {
            formatted += `📉 AHORRO DEL ${discount}% - Antes: $${deal.price_official}\n\n`;
        }

        formatted += clean;
        formatted += `\n\n⚠️ Oferta por tiempo limitado. Stock sujeto a disponibilidad.`;

        return formatted;
    }

    generateProfessionalDescription(deal, discount, storeName) {
        let desc = `🔥 [${storeName}] ${deal.title}\n`;

        if (deal.coupon) {
            desc += `🎟️ APLICA CUPÓN: ${deal.coupon}\n`;
        }

        desc += `💰 PRECIO: $${deal.price_offer}\n\n`;

        if (discount > 0) {
            desc += `💰 AHORRA ${discount}% - Antes: $${deal.price_official}\n\n`;
        }

        // Descripción profesional basada en el título
        desc += `${deal.title} representa una excelente oportunidad en ${storeName}. `;

        if (discount >= 30) {
            desc += `Con un descuento del ${discount}%, este es uno de los mejores precios disponibles. `;
        }

        if (deal.coupon) {
            desc += `Asegúrate de aplicar el cupón ${deal.coupon} al finalizar tu compra. `;
        }

        desc += `Producto verificado y en stock.\n\n`;

        // Beneficios genéricos
        desc += `✅ Producto auténtico\n`;
        desc += `✅ Envío disponible\n`;
        desc += `✅ Garantía del fabricante\n`;

        if (deal.categoria) {
            desc += `\n📦 Categoría: ${deal.categoria}\n`;
        }

        desc += `\n⚠️ Oferta por tiempo limitado. Stock sujeto a disponibilidad.`;

        return desc;
    }
}

module.exports = new AIProcessor();
