const logger = require('./logger');

/**
 * LinkTransformer: El motor de limpieza y monetización.
 * Diseñado para borrar rastros de otros afiliados e inyectar los tuyos.
 */
class LinkTransformer {
    constructor() {
        require('dotenv').config();
        this.tags = {
            // Sovrn Commerce (VigLink) - Monetiza TODAS las tiendas automáticamente
            sovrn_key: process.env.SOVRN_API_KEY || '',
            sovrn_subid: process.env.SOVRN_SUBID || 'masbarato',

            // Fallbacks directos (si no usas Sovrn)
            amazon: process.env.AMAZON_TAG || 'masbaratodeal-20',
            ebay: process.env.EBAY_CAMPAIGN_ID || '5338634567',
            walmart: process.env.WALMART_ID || '',
        };
    }

    async transform(url) {
        if (!url) return url;

        let currentUrl = url;

        // 1. DESEMPAQUETADO PROFUNDO (Extraer link real de redireccionadores)
        try {
            const redirectParams = ['u2', 'u', 'url', 'mpre', 'dest', 'reftag', 'linkCode', 'ascsubtag'];
            let temp = currentUrl;

            // Intentar hasta 4 niveles de redirección (ej: Slickdeals -> CJ -> Store)
            for (let i = 0; i < 4; i++) {
                try {
                    const uObj = new URL(temp.startsWith('/') ? 'https://www.google.com' + temp : temp);
                    let found = false;
                    for (const param of redirectParams) {
                        const val = uObj.searchParams.get(param);
                        if (val && (val.startsWith('http') || val.includes('.com'))) {
                            temp = decodeURIComponent(val);
                            currentUrl = temp;
                            found = true;
                            break;
                        }
                    }
                    if (!found) break;
                } catch (e) { break; }
            }
        } catch (e) { }

        // 2. MONETIZACIÓN ESPECÍFICA (Prioridad: AMAZON DIRECTO)
        // --- AMAZON ---
        if (currentUrl.includes('amazon.com') || currentUrl.includes('amzn.to')) {
            try {
                const cleanObj = new URL(currentUrl);
                cleanObj.searchParams.delete('tag');
                cleanObj.searchParams.delete('ascsubtag');
                currentUrl = cleanObj.toString();
            } catch (e) { }

            const asinMatch = currentUrl.match(/\/(dp|gp\/product|exec\/obidos\/ASIN)\/([A-Z0-9]{10})/i);
            const asin = asinMatch ? asinMatch[2] : null;

            if (asin) {
                return `https://www.amazon.com/dp/${asin}?tag=${this.tags.amazon}`;
            }
            const separator = currentUrl.includes('?') ? '&' : '?';
            return `${currentUrl}${separator}tag=${this.tags.amazon}`;
        }

        // --- EBAY ---
        if (currentUrl.includes('ebay.com')) {
            const itemMatch = currentUrl.match(/\/itm\/(?:[^\/]+\/)?(\d+)/);
            const itemId = itemMatch ? itemMatch[1] : null;
            const baseUrl = itemId ? `https://www.ebay.com/itm/${itemId}` : currentUrl.split('?')[0];
            return `https://www.ebay.com/rover/1/711-53200-19255-0/1?mpre=${encodeURIComponent(baseUrl)}&campid=${this.tags.ebay}&toolid=20008`;
        }

        // --- WALMART ---
        if (currentUrl.includes('walmart.com')) {
            if (this.tags.walmart) {
                const base = currentUrl.split('?')[0];
                return `https://goto.walmart.com/c/${this.tags.walmart}/565706/9383?u=${encodeURIComponent(base)}`;
            }
        }

        // 3. MONETIZACIÓN CON SOVRN (Para el resto: Best Buy, Target, Newegg, etc.)
        if (this.tags.sovrn_key) {
            // Limpieza previa para mejores resultados en Sovrn
            const topStores = ['bestbuy.com', 'target.com', 'newegg.com', 'ebay.com', 'walmart.com'];
            if (topStores.some(s => currentUrl.includes(s))) {
                try {
                    const u = new URL(currentUrl);
                    ['ref', 'loc', 'tag', 'clickid', 'irclickid', 'aff_id', 'aff_sub'].forEach(p => u.searchParams.delete(p));
                    currentUrl = u.toString();
                } catch (e) { }
            }
            return `https://redirect.viglink.com/?key=${this.tags.sovrn_key}&subId=${this.tags.sovrn_subid}&u=${encodeURIComponent(currentUrl)}`;
        }

        // FALLBACK: Limpieza básica de parámetros de rastreo
        try {
            const cleanUrl = new URL(currentUrl);
            const paramsToStrip = ['tag', 'clickid', 'irclickid', 'aff_id', 'aff_sub', 'utm_source', 'utm_medium', 'utm_campaign', 'v_id'];
            paramsToStrip.forEach(p => cleanUrl.searchParams.delete(p));
            return cleanUrl.toString();
        } catch (e) {
            return currentUrl;
        }
    }
}

module.exports = new LinkTransformer();
