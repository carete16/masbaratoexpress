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

        let currentUrl = url;
        logger.info(`🚀 INICIANDO HYPER-BYPASS PARA: ${url.substring(0, 50)}...`);

        try {
            // 1. RECURSIVE BYPASS (Seguir el rastro hasta el final)
            let iterations = 0;
            const maxIterations = 5;

            while (iterations < maxIterations) {
                const urlObj = new URL(currentUrl);

                // A. Extraer de parámetros comunes de redes de afiliados
                const affiliateParams = ['u2', 'url', 'mpre', 'u', 'link', 'dest', 'target', 'lno', 'v', 'out'];
                let foundParam = false;

                for (const param of affiliateParams) {
                    const val = urlObj.searchParams.get(param);
                    if (val && val.startsWith('http')) {
                        currentUrl = decodeURIComponent(val);
                        foundParam = true;
                        break;
                    }
                }

                if (!foundParam && (currentUrl.includes('slickdeals.net') || currentUrl.includes('redirect.viglink.com') || currentUrl.includes('tkqlhce.com'))) {
                    // B. Resolución física por HEAD/GET si el parámetro no funciona
                    try {
                        const axios = require('axios');
                        const res = await axios.head(currentUrl, {
                            maxRedirects: 5,
                            timeout: 5000,
                            headers: { 'User-Agent': 'Mozilla/5.0' }
                        });
                        const resolved = res.request?.res?.responseUrl || res.config?.url;
                        if (resolved && resolved !== currentUrl) {
                            currentUrl = resolved;
                            foundParam = true;
                        }
                    } catch (e) { break; }
                }

                if (!foundParam) break;
                iterations++;
            }

            // 🚨 LIMPIEZA QUIRÚRGICA (Remover CUALQUIER tracker conocido)
            try {
                // Caso especial Amazon: Si es review, convertir a producto directo
                if (currentUrl.includes('amazon.com') && (currentUrl.includes('/product-reviews/') || currentUrl.includes('/reviews/'))) {
                    const asinMatch = currentUrl.match(/\/([A-Z0-0]{10})/);
                    if (asinMatch) currentUrl = `https://www.amazon.com/dp/${asinMatch[1]}`;
                }

                const finalUrlObj = new URL(currentUrl);
                // Lista masiva de parámetros basura de marketing y afiliados
                const junkParams = [
                    'tag', 'ascsubtag', 'clickid', 'affid', 'u2', 'lno', 'utm_source', 'utm_medium',
                    'ref', 'ref_', 'th', 'psc', 'smid', 'camp', 'creative', 'linkCode', 'linkId',
                    'originalSub3', 'subId1', 'subid', 'sourceid', 'veh', 'aff_id'
                ];
                junkParams.forEach(p => finalUrlObj.searchParams.delete(p));
                currentUrl = finalUrlObj.toString().replace(/\?$/, '');
            } catch (e) { }

            // 2. RE-MONETIZACIÓN (Tus códigos)
            if (currentUrl.includes('amazon.com')) {
                const u = new URL(currentUrl);
                u.searchParams.set('tag', this.tags.amazon);
                return u.toString();
            } else if (currentUrl.includes('ebay.com')) {
                return `https://www.ebay.com/rover/1/${this.tags.ebay}/1?mpre=${encodeURIComponent(currentUrl)}`;
            } else if (currentUrl.includes('walmart.com')) {
                // Si tienes un ID real de Walmart, ponlo aquí
                return `https://goto.walmart.com/c/2003851/565706/9383?u=${encodeURIComponent(currentUrl)}`;
            }

            // Monetización Universal (Sovrn/Viglink propio)
            return `${this.tags.sovrn_prefix}${encodeURIComponent(currentUrl)}`;

        } catch (e) {
            logger.error(`Error en Hyper-Bypass: ${e.message}`);
            return currentUrl;
        }
    }
}

module.exports = new LinkTransformer();
