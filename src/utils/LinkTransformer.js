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
            // Clave REAL de Sovrn hardcodeada
            sovrn_prefix: 'https://redirect.viglink.com?key=168bdd181cfb276b05d8527e1d4cd03e&u='
        };
    }

    async transform(url, deal = null) {
        if (!url) return url;

        let currentUrl = url;

        // 1. INTENTO DE LIMPIEZA PROFUNDA (EXTRACCIÓN DE PARÁMETROS)
        try {
            if (currentUrl.includes('slickdeals.net') || currentUrl.includes('viglink') || currentUrl.includes('cj.com')) {
                let temp = currentUrl;
                for (let i = 0; i < 3; i++) {
                    try {
                        const uObj = new URL(temp.startsWith('/') ? 'https://slickdeals.net' + temp : temp);
                        const next = uObj.searchParams.get('u2') || uObj.searchParams.get('u') || uObj.searchParams.get('url') || uObj.searchParams.get('mpre') || uObj.searchParams.get('dest');
                        if (next && next.startsWith('http')) {
                            temp = decodeURIComponent(next);
                            currentUrl = temp;
                        } else break;
                    } catch (e) { break; }
                }
            }
        } catch (e) { }

        // 2. MONETIZACIÓN DIRECTA (Solo si tenemos el link limpio)
        if (currentUrl.includes('amazon.com') && !currentUrl.includes('slickdeals')) {
            const asin = currentUrl.match(/\/([A-Z0-9]{10})/)?.[1];
            if (asin) {
                return `https://www.amazon.com/dp/${asin}?tag=${this.tags.amazon}`;
            }
            const clean = currentUrl.split('?')[0];
            return `${clean}?tag=${this.tags.amazon}`;
        }

        if (currentUrl.includes('ebay.com') && !currentUrl.includes('slickdeals')) {
            return `https://www.ebay.com/rover/1/${this.tags.ebay || '5338634567'}/1?mpre=${encodeURIComponent(currentUrl)}`;
        }

        if (currentUrl.includes('walmart.com') && !currentUrl.includes('slickdeals')) {
            return `https://goto.walmart.com/c/${this.tags.walmart || '2003851'}/565706/9383?u=${encodeURIComponent(currentUrl)}`;
        }

        // 3. SEGURIDAD FINAL: NO PUBLICAR LINKS SUCIOS
        // Si el link todavía tiene rastro de Slickdeals, lo devolvemos tal cual.
        // El CoreProcessor se encargará de descartarlo.
        return currentUrl;
    }
}

module.exports = new LinkTransformer();
