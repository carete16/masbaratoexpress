const logger = require('./logger');

/**
 * Este módulo se encarga de convertir links normales en links de afiliado.
 * Actúa bajo una lógica de "Multi-Tienda" para ocultar el origen (Slickdeals, etc).
 */
class LinkTransformer {
    constructor() {
        require('dotenv').config();
        this.tags = {
            amazon: process.env.AMAZON_TAG || 'masbaratodeal-20',
            ebay: process.env.EBAY_CAMPAIGN_ID || '',
            walmart: process.env.WALMART_ID || '',
            // Clave REAL de Sovrn hardcodeada para asegurar monetización inmediata en Render
            sovrn_prefix: process.env.SOVRN_URL_PREFIX || 'https://redirect.viglink.com?key=168bdd181cfb276b05d8527e1d4cd03e&u='
        };
    }

    async transform(url) {
        if (!url) return url;

        const originalUrl = url; // Guardar para logging

        try {
            // 1. "DESMANTELAR" Slickdeals: Obtener la tienda real
            if (url.includes('slickdeals.net')) {
                logger.info(`🕵️ BYPASS INICIADO: ${url.substring(0, 60)}...`);

                // A. Parámetros directos (u2 es el más común para externos)
                try {
                    const urlParsed = new URL(url);
                    let target = urlParsed.searchParams.get('u2') ||
                        urlParsed.searchParams.get('url') ||
                        urlParsed.searchParams.get('lno') ||
                        urlParsed.searchParams.get('mpre'); // eBay style

                    if (target && target.includes('http')) {
                        url = decodeURIComponent(target);
                        logger.info(`✅ Bypass por Parámetro: ${url.substring(0, 50)}...`);
                    }
                } catch (e) { }

                // B. Si sigue siendo Slickdeals, intentamos resolver redirección física
                if (url.includes('slickdeals.net')) {
                    try {
                        const axios = require('axios');
                        const res = await axios.get(url, {
                            maxRedirects: 10,
                            timeout: 8000,
                            headers: { 'User-Agent': 'Mozilla/5.0' }
                        });
                        const finalUrl = res.request?.res?.responseUrl || res.config?.url;
                        if (finalUrl && !finalUrl.includes('slickdeals.net')) {
                            url = finalUrl;
                        }
                    } catch (e) { }
                }
            }

            // 🚨 LIMPIEZA DE URL (Remover trackers antes de monetizar)
            try {
                // Caso especial Amazon: Si es review, convertir a producto directo
                if (url.includes('amazon.com') && (url.includes('/product-reviews/') || url.includes('/reviews/'))) {
                    const asinMatch = url.match(/\/([A-Z0-0]{10})/);
                    if (asinMatch) {
                        url = `https://www.amazon.com/dp/${asinMatch[1]}`;
                    }
                }

                const urlObj = new URL(url);
                const trackers = ['tag', 'ascsubtag', 'clickid', 'affid', 'u2', 'lno', 'utm_source', 'utm_medium', 'ref', 'ref_', 'th', 'psc'];
                trackers.forEach(t => urlObj.searchParams.delete(t));
                url = urlObj.toString();
            } catch (e) { }

            // 2. MONETIZACIÓN SEGÚN TIENDA
            if (url.includes('amazon.com')) {
                const u = new URL(url);
                u.searchParams.set('tag', this.tags.amazon);
                return u.toString();
            } else if (url.includes('ebay.com')) {
                return `https://www.ebay.com/rover/1/${this.tags.ebay}/1?mpre=${encodeURIComponent(url)}`;
            } else if (url.includes('walmart.com')) {
                return `https://goto.walmart.com/c/2003851/565706/9383?veh=aff&sourceid=imp_000011112222333344&u=${encodeURIComponent(url)}`;
            }

            // Monetización Universal (Resto de tiendas)
            return `${this.tags.sovrn_prefix}${encodeURIComponent(url)}`;

        } catch (e) {
            logger.error(`Error en LinkTransformer: ${e.message}`);
            return url;
        }
    }
}

module.exports = new LinkTransformer();
