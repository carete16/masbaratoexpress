const logger = require('./logger');
const axios = require('axios');

/**
 * LinkTransformer: El motor de limpieza y monetización.
 * Versión MASBARATO EXPRESS - ULTRA FAST EDITION
 */
class LinkTransformer {
    constructor() {
        require('dotenv').config();
        this.tags = {
            sovrn_key: process.env.SOVRN_API_KEY || '',
            sovrn_subid: process.env.SOVRN_SUBID || 'masbarato_deals',
            amazon: process.env.AMAZON_TAG || 'masbaratodeals-20',
        };
    }

    async resolverRedirect(url) {
        if (!url) return url;
        if (url.includes('amazon.com') || url.includes('nike.com') || url.includes('ebay.com')) return url;

        try {
            const res = await axios.get(url, {
                maxRedirects: 3,
                timeout: 4000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            return res.request.res.responseUrl || res.config.url;
        } catch (e) {
            return url;
        }
    }

    detectarTienda(url) {
        const u = url.toLowerCase();
        if (u.includes("amazon.")) return "Amazon US";
        if (u.includes("walmart.")) return "Walmart";
        if (u.includes("ebay.")) return "eBay";
        if (u.includes("bestbuy.")) return "BestBuy";
        if (u.includes("nike.")) return "Nike";
        if (u.includes("adidas.")) return "Adidas";
        if (u.includes("target.")) return "Target";
        if (u.includes("newegg.")) return "Newegg";
        if (u.includes("homedepot.")) return "Home Depot";
        if (u.includes("apple.com")) return "Apple";
        if (u.includes("samsung.com")) return "Samsung";
        if (u.includes("sephora.com")) return "Sephora";
        return "Tienda USA";
    }

    limpiarURL(url) {
        if (!url) return '';
        // Eliminar parámetros de tracking comunes pero mantener la base
        const clean = url.split("?")[0];
        return clean;
    }

    extraerASIN(url) {
        // Regex permisivo para mayúsculas y minúsculas (a veces el navegador convierte URLs)
        const match = url.match(/\/dp\/([a-zA-Z0-9]{10})|\/gp\/product\/([a-zA-Z0-9]{10})/);
        return match ? (match[1] || match[2]) : null;
    }

    async transform(url) {
        if (!url) return url;

        // Claves que sabemos que están dando problemas (opcional)
        const problematicKeys = ['8ea30700d20d43f0'];

        // 1. LIMPIEZA INICIAL: Resolvemos link corto si existe
        let resolvedUrl = url;
        try {
            if (url.includes('bit.ly') || url.includes('t.co') || url.includes('tinyurl') || url.includes('amzn.to') || url.includes('redirect.viglink.com')) {
                const LinkResolver = require('./LinkResolver');
                resolvedUrl = await LinkResolver.resolve(url);
            }
        } catch (e) { console.warn("[TRANSFORM] Falló resolución inicial"); }

        const lowUrl = resolvedUrl.toLowerCase();

        // 2. CASO AMAZON: Usar TAG directo (Máxima compatibilidad)
        if (lowUrl.includes('amazon.com')) {
            const asin = this.extraerASIN(resolvedUrl);
            if (asin) return `https://www.amazon.com/dp/${asin}/?tag=${this.tags.amazon}`;
            return this.limpiarURL(resolvedUrl);
        }

        // 3. TODO LO DEMÁS: Aplicar SOVRN (Viglink)
        // Solo si la clave no está en la lista negra y existe
        if (this.tags.sovrn_key && !problematicKeys.includes(this.tags.sovrn_key)) {
            const clean = this.limpiarURL(resolvedUrl);

            // Si el link ya es un redirect de viglink, no lo volvemos a envolver
            if (clean.includes('redirect.viglink.com')) return clean;

            return `https://redirect.viglink.com?key=${this.tags.sovrn_key}&subId=${this.tags.sovrn_subid}&u=${encodeURIComponent(clean)}`;
        }

        // Fallback: Devolver link directo si no hay monetización segura disponible
        return this.limpiarURL(resolvedUrl);
    }
}

module.exports = new LinkTransformer();
