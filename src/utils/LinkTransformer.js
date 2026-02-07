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
        if (url.includes("amazon.")) return "amazon";
        if (url.includes("walmart.")) return "walmart";
        if (url.includes("ebay.")) return "ebay";
        return "otro";
    }

    limpiarURL(url) {
        return url.split("?")[0];
    }

    extraerASIN(url) {
        const match = url.match(/\/dp\/([A-Z0-9]{10})|\/gp\/product\/([A-Z0-9]{10})/);
        return match ? (match[1] || match[2]) : null;
    }

    async transform(url) {
        if (!url) return url;

        // 1. BYPASS TOTAL PARA TIENDAS DIRECTAS (MÁXIMA VELOCIDAD)
        if (url.includes('amazon.com') || url.includes('nike.com') || url.includes('ebay.com')) {
            if (url.includes('amazon.com')) {
                const asin = this.extraerASIN(url);
                if (asin) return `https://www.amazon.com/dp/${asin}/?tag=${this.tags.amazon}`;
            }
            return url.split('?')[0];
        }

        // 2. Resolver redirecciones
        const urlFinal = await this.resolverRedirect(url);
        const tienda = this.detectarTienda(urlFinal);

        if (tienda === "amazon") {
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
