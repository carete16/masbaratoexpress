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

        // 2. MONETIZACIÓN DIRECTA (Solo si tenemos el link de la tienda)
        const isSlickdealsDomain = currentUrl.includes('slickdeals.net');

        if (currentUrl.includes('amazon.com') && !isSlickdealsDomain) {
            // Extraer ASIN (Patrón de 10 caracteres alfanuméricos)
            const asinMatch = currentUrl.match(/\/(dp|gp\/product|exec\/obidos\/ASIN)\/([A-Z0-9]{10})/i) || currentUrl.match(/[?&]asin=([A-Z0-9]{10})/i);
            const asin = asinMatch ? asinMatch[2] : null;

            if (asin) {
                return `https://www.amazon.com/dp/${asin}?tag=${this.tags.amazon}`;
            }
            // Si no hay ASIN, limpiamos parámetros y aplicamos tag
            const base = currentUrl.split('?')[0];
            return `${base}?tag=${this.tags.amazon}`;
        }

        if (currentUrl.includes('ebay.com') && !isSlickdealsDomain) {
            const base = currentUrl.split('?')[0];
            return `https://www.ebay.com/rover/1/${this.tags.ebay || '5338634567'}/1?mpre=${encodeURIComponent(base)}`;
        }

        if (currentUrl.includes('walmart.com') && !isSlickdealsDomain) {
            const base = currentUrl.split('?')[0];
            return `https://goto.walmart.com/c/${this.tags.walmart || '2003851'}/565706/9383?u=${encodeURIComponent(base)}`;
        }

        // 3. SEGURIDAD FINAL: NO PUBLICAR LINKS SUCIOS
        // Si el link todavía pertenece al dominio slickdeals.net, el CoreProcessor lo descartará.
        return currentUrl;
    }
}

module.exports = new LinkTransformer();
