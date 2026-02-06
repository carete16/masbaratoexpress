const logger = require('./logger');
const axios = require('axios');
const { URL } = require('url');

/**
 * LinkTransformer: Motor de Limpieza Cosmética y Monetización MASBARATO EXPRESS
 * Corregido para evitar errores de sintaxis y cierres inesperados.
 */
class LinkTransformer {
    constructor() {
        this.affiliates = {
            amazon: 'MASBARATO-20',
            newegg: 'masbaratoexpress',
            walmart: 'masbaratoexpress',
            bestbuy: 'MBEXPRESS'
        };
    }

    /**
     * Resuelve redirecciones solo si es estrictamente necesario.
     */
    async resolveLink(url) {
        if (!url) return '';
        const lowUrl = url.toLowerCase();

        // No rastrear si ya es un link directo de tienda
        if (lowUrl.includes('amazon.') || lowUrl.includes('newegg.') || lowUrl.includes('walmart.') || lowUrl.includes('bestbuy.')) {
            return url;
        }

        try {
            const response = await axios.get(url, {
                maxRedirects: 8,
                timeout: 5000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
                }
            });
            return response.request.res.responseUrl || response.config.url || url;
        } catch (e) {
            return url;
        }
    }

    /**
     * Limpia parámetros de rastreo
     */
    cleanParams(urlStr) {
        try {
            const url = new URL(urlStr);
            const blacklist = [
                'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
                'tag', 'ref', 'ascsubtag', 'creative', 'camp', 'affid', 'affname',
                'asubid', 'asid', 'ranmid', 'raneaid', 'ransiteid', 'clickid',
                'gclid', 'fbclid', 'linkcode', 'linkid', 'afsrc', 'tr_id'
            ];

            const keysToDelete = [];
            url.searchParams.forEach((value, key) => {
                const lowKey = key.toLowerCase();
                if (blacklist.includes(lowKey) || lowKey.startsWith('utm_')) {
                    keysToDelete.push(key);
                }
            });

            keysToDelete.forEach(key => url.searchParams.delete(key));
            return url.toString();
        } catch (e) {
            return urlStr;
        }
    }

    /**
     * Extrae ID el producto para Amazon
     */
    getAmazonBase(urlStr) {
        const asinMatch = urlStr.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
        if (asinMatch) {
            return `https://www.amazon.com/dp/${asinMatch[1]}/`;
        }
        return urlStr;
    }

    /**
     * Proceso principal
     */
    async transform(inputUrl) {
        if (!inputUrl || typeof inputUrl !== 'string') return '';

        // 1. Resolver redirecciones
        let resolvedUrl = await this.resolveLink(inputUrl.trim());

        // 2. Limpieza de parámetros
        let cleanUrl = this.cleanParams(resolvedUrl);

        // 3. Inyectar afiliado
        let finalUrl = cleanUrl;
        try {
            const urlObj = new URL(cleanUrl);
            const lowUrl = cleanUrl.toLowerCase();

            if (lowUrl.includes('amazon.')) {
                const base = this.getAmazonBase(cleanUrl);
                const baseUrlObj = new URL(base);
                baseUrlObj.searchParams.set('tag', this.affiliates.amazon);
                finalUrl = baseUrlObj.toString();
            }
            // Otras tiendas: No insertar afiliados manuales (Usar Sovrn de forma externa/automática)
            // Simplemente devolvemos la URL limpia sin parámetros de terceros
            else {
                finalUrl = cleanUrl;
            }
        } catch (e) {
            // Fallback si no es una URL válida
            if (cleanUrl.includes('?')) {
                finalUrl = cleanUrl.split('?')[0];
            }
        }

        logger.info(`🔗 Transform: [OUT] ${finalUrl.substring(0, 60)}...`);
        return finalUrl;
    }
}

module.exports = new LinkTransformer();
