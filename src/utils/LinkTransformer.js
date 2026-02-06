const logger = require('./logger');
const axios = require('axios');
const { URL } = require('url');

/**
 * LinkTransformer: Motor de Limpieza Cosmética y Monetización MASBARATO EXPRESS
 * Diseñado por Antigravity para alineación total con PRD de Afiliación.
 */
class LinkTransformer {
    constructor() {
        // Códigos oficiales solicitados por el usuario
        this.affiliates = {
            amazon: 'MASBARATO-20',
            newegg: 'masbaratoexpress',
            walmart: 'masbaratoexpress',
            bestbuy: 'MBEXPRESS'
        };
    }

    /**
     * Resuelve redirecciones solo si es estrictamente necesario (Slickdeals, redirectores).
     * Evitamos tocar Amazon/BestBuy directamente para prevenir bloqueos de IP.
     */
    async resolveLink(url) {
        const lowUrl = url.toLowerCase();
        // Si ya es un link directo de tienda, no lo rastreamos (evitar 403)
        if (lowUrl.includes('amazon.') || lowUrl.includes('newegg.') || lowUrl.includes('walmart.') || lowUrl.includes('bestbuy.')) {
            return url;
        }

        try {
            // Usamos un timeout corto para redirecciones
            const response = await axios.get(url, {
                maxRedirects: 10,
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
        // Regex mejorada para capturar ASIN en diferentes formatos
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

        // 1. Resolver redirecciones (Evitando tiendas directas)
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
            else if (lowUrl.includes('newegg.com')) {
                urlObj.searchParams.set('cm_sp', this.affiliates.newegg);
                finalUrl = urlObj.toString();
            }
            else if (lowUrl.includes('walmart.com')) {
                urlObj.searchParams.set('affp1', this.affiliates.walmart);
                finalUrl = urlObj.toString();
            }
            else if (lowUrl.includes('bestbuy.com')) {
                urlObj.searchParams.set('ref', this.affiliates.bestbuy);
                finalUrl = urlObj.toString();
            }
        } catch (e) {
            finalUrl = cleanUrl.split('?')[0];
        }

        logger.info(`🔗 Transformación: [IN] ${inputUrl.substring(0, 30)}... -> [OUT] ${finalUrl.substring(0, 50)}...`);
        return finalUrl;
    }
}

module.exports = new LinkTransformer();
