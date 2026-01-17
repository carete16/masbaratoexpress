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

        // 3. ESTRATEGIA DE BÚSQUEDA INTELIGENTE (Smart Search Fallback)
        // Si falló la limpieza y seguimos en Slickdeals, creamos una búsqueda en la tienda
        if (deal && (currentUrl.includes('slickdeals.net') || currentUrl.includes('viglink'))) {

            // INTENTO DE INFERIR TIENDA DESDE EL TÍTULO SI ES GENÉRICA
            let targetStore = deal.tienda ? deal.tienda.toLowerCase() : '';
            const titleLower = deal.title.toLowerCase();

            if (targetStore === 'oferta usa' || targetStore === 'general' || !targetStore) {
                if (titleLower.includes('amazon') || titleLower.includes('subscribe')) targetStore = 'amazon';
                else if (titleLower.includes('walmart')) targetStore = 'walmart';
                else if (titleLower.includes('ebay')) targetStore = 'ebay';
                else if (titleLower.includes('best buy')) targetStore = 'best buy';
                else if (titleLower.includes('target')) targetStore = 'target';
                else if (titleLower.includes('home depot')) targetStore = 'home depot';
            }

            logger.info(`🔄 Activando Smart Search Redirect para: ${deal.title} (Tienda: ${targetStore})`);
            const query = deal.title
                .replace(/\$\d+(\.\d{2})?/g, '') // Quitar precios
                .replace(/store|pickup|shipping|free/gi, '') // Quitar ruido
                .replace(/[^\w\s]/gi, '') // Quitar caracteres raros
                .split(' ').slice(0, 6).join(' '); // Primeras 6 palabras

            if (targetStore.includes('amazon')) {
                return `https://www.amazon.com/s?k=${encodeURIComponent(query)}&tag=${this.tags.amazon}`;
            }
            if (targetStore.includes('ebay')) {
                return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&mkcid=1&mkrid=711-53200-19255-0&siteid=0&campid=${this.tags.ebay || '5338634567'}&customid=&toolid=10001&mkevt=1`;
            }
            if (targetStore.includes('walmart')) {
                return `https://goto.walmart.com/c/${this.tags.walmart || '2003851'}/565706/9383?u=${encodeURIComponent('https://www.walmart.com/search?q=' + query)}`;
            }
        }

        // 4. ÚLTIMO RECURSO: Sovrn Wrapper
        return `${this.tags.sovrn_prefix}${encodeURIComponent(currentUrl)}`;
    }
}

module.exports = new LinkTransformer();
