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
        return "Tienda USA";
    }

    limpiarURL(url) {
        if (!url) return '';
        // Eliminar parámetros de tracking comunes pero mantener la base
        const clean = url.split("?")[0];
        return clean;
    }

    extraerASIN(url) {
        const match = url.match(/\/dp\/([A-Z0-9]{10})|\/gp\/product\/([A-Z0-9]{10})/);
        return match ? (match[1] || match[2]) : null;
    }

    async transform(url) {
        if (!url) return url;

        // 1. Detección de Tienda
        const tiendaId = this.detectarTienda(url);

        // 2. BYPASS TOTAL PARA TIENDAS DIRECTAS (MÁXIMA VELOCIDAD)
        const isDirect = url.includes('amazon.com') || url.includes('walmart.com') || url.includes('bestbuy.com') || url.includes('nike.com') || url.includes('ebay.com');

        if (isDirect) {
            let final = url;
            if (url.includes('amazon.com')) {
                const asin = this.extraerASIN(url);
                if (asin) final = `https://www.amazon.com/dp/${asin}/?tag=${this.tags.amazon}`;
                else final = this.limpiarURL(url);
            } else {
                final = this.limpiarURL(url);
            }

            // Si hay Sovrn, envolverlo (opcional según el usuario, pero usualmente se prefiere Sovrn para todo lo no-Amazon)
            if (!url.includes('amazon.com') && this.tags.sovrn_key) {
                return `https://redirect.viglink.com?key=${this.tags.sovrn_key}&subId=${this.tags.sovrn_subid}&u=${encodeURIComponent(final)}`;
            }
            return final;
        }

        // 3. Resolver redirecciones para links cortos (bitly, etc)
        const urlFinal = await this.resolverRedirect(url);
        const tiendaFinal = this.detectarTienda(urlFinal);

        if (tiendaFinal === "Amazon US") {
            const asin = this.extraerASIN(urlFinal);
            if (asin) return `https://www.amazon.com/dp/${asin}/?tag=${this.tags.amazon}`;
        }

        if (this.tags.sovrn_key) {
            const limpia = this.limpiarURL(urlFinal);
            return `https://redirect.viglink.com?key=${this.tags.sovrn_key}&subId=${this.tags.sovrn_subid}&u=${encodeURIComponent(limpia)}`;
        }

        return this.limpiarURL(urlFinal);
    }
}

module.exports = new LinkTransformer();
