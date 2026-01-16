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
            sovrn_prefix: 'https://redirect.viglink.com?key=168bdd181cfb276b05d8527e1d4cd03e&u='
        };
    }

    async transform(url) {
        if (!url) return url;

        let currentUrl = url;
        logger.info(`🚀 INICIANDO LIMPIEZA TOTAL PARA: ${url.substring(0, 50)}...`);

        try {
            // 1. DESENMASCARAR Y LLEGAR A LA TIENDA REAL
            // Si el link tiene prefijos de afiliados externos, los rompemos para sacar la URL limpia
            if (currentUrl.includes('redirect.viglink.com') || currentUrl.includes('slickdeals.net') || currentUrl.includes('tkqlhce.com') || currentUrl.includes('anrdoezrs.net')) {
                try {
                    const urlObj = new URL(currentUrl);
                    // Buscamos la URL real en los parámetros típicos (u, u2, url, dest, v)
                    const extracted = urlObj.searchParams.get('u') ||
                        urlObj.searchParams.get('u2') ||
                        urlObj.searchParams.get('url') ||
                        urlObj.searchParams.get('mpre') ||
                        urlObj.searchParams.get('dest');

                    if (extracted && extracted.startsWith('http')) {
                        currentUrl = decodeURIComponent(extracted);
                    }
                } catch (e) { }
            }

            // 2. LIMPIEZA QUIRÚRGICA (Remover CUALQUIER tracker ajeno)
            try {
                // Caso Amazon Reviews -> Producto Directo
                if (currentUrl.includes('amazon.com') && (currentUrl.includes('/product-reviews/') || currentUrl.includes('/reviews/'))) {
                    const asinMatch = currentUrl.match(/\/([A-Z0-0]{10})/);
                    if (asinMatch) currentUrl = `https://www.amazon.com/dp/${asinMatch[1]}`;
                }

                // Dejar el link base sin parámetros basura de Slickdeals o redes
                const cleanUrl = currentUrl.split('?')[0];
                currentUrl = cleanUrl;
            } catch (e) { }

            // 3. RE-MONETIZACIÓN DIRECTA (Tu marca, sin intermediarios)
            if (currentUrl.includes('amazon.com')) {
                // Generar el link EXACTO de Amazon con tu tag
                return `${currentUrl}?tag=${this.tags.amazon}`;
            } else if (currentUrl.includes('ebay.com')) {
                // Link directo de eBay Partner Network con tu ID
                const campaign = this.tags.ebay || '5338634567';
                return `https://www.ebay.com/rover/1/${campaign}/1?mpre=${encodeURIComponent(currentUrl)}`;
            } else if (currentUrl.includes('walmart.com')) {
                // Link directo de Walmart con tu ID
                return `https://goto.walmart.com/c/2003851/565706/9383?u=${encodeURIComponent(currentUrl)}`;
            }

            // SOLO para tiendas menores o desconocidas usamos Sovrn como respaldo
            return `${this.tags.sovrn_prefix}${encodeURIComponent(currentUrl)}`;

        } catch (e) {
            logger.error(`Error en Transformación: ${e.message}`);
            return currentUrl;
        }
    }
}

module.exports = new LinkTransformer();
