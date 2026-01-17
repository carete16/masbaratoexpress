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

    async transform(url, deal = null) {
        if (!url) return url;

        let currentUrl = url;

        // 1. INTENTO DE LIMPIEZA PROFUNDA (EXTRACCIÓN DE PARÁMETROS)
        try {
            if (currentUrl.includes('slickdeals.net') || currentUrl.includes('viglink') || currentUrl.includes('cj.com')) {
                // Decodificación recursiva de hasta 3 niveles
                let temp = currentUrl;
                for (let i = 0; i < 3; i++) {
                    try {
                        const uObj = new URL(temp.startsWith('/') ? 'https://slickdeals.net' + temp : temp);
                        const next = uObj.searchParams.get('u2') || uObj.searchParams.get('u') || uObj.searchParams.get('url') || uObj.searchParams.get('dest');
                        if (next && next.startsWith('http')) {
                            temp = decodeURIComponent(next);
                            currentUrl = temp; // Éxito parcial
                        } else break;
                    } catch (e) { break; }
                }
            }
        } catch (e) { }

        // 2. MONETIZACIÓN DIRECTA (Si ya tenemos el link limpio)
        if (currentUrl.includes('amazon.com') && !currentUrl.includes('slickdeals')) {
            if (currentUrl.includes('/product-reviews/')) {
                const asin = currentUrl.match(/\/([A-Z0-9]{10})/)?.[1];
                if (asin) currentUrl = `https://www.amazon.com/dp/${asin}`;
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

        // 3. RETORNO DE ENLACE LIMPIO MONETIZABLE
        // Según las reglas del 'Sistema Profesional', si no es Amazon, entregamos el enlace limpio 
        // de la tienda para que el script de Sovrn del sitio web lo monetice automáticamente,
        // o si es Telegram, esperamos que Bot4 lo maneje.
        // Pero para seguridad, si detectamos una tienda conocida, la devolvemos limpia.

        // Si sigue sucio (tiene slickdeals), aplicamos contingencia Sovrn para no perder tráfico.
        if (currentUrl.includes('slickdeals.net') || currentUrl.includes('viglink')) {
            logger.info(`⚠️ Link sucio persistente. Aplicando Wrapper Sovrn de seguridad: ${deal ? deal.title : 'Unknown'}`);
            return `${this.tags.sovrn_prefix}${encodeURIComponent(currentUrl)}`;
        }

        // Si es un link limpio de tienda (BestBuy, Walmart, etc.), lo devolvemos tal cual
        // asumiendo que el frontend tiene el script de Sovrn o que es mejor dar un link limpio que uno roto.
        return currentUrl;
    }
}
module.exports = new LinkTransformer();


