/**
 * Este módulo se encarga de convertir links normales en links de afiliado.
 * Actúa bajo una lógica de "Multi-Tienda" para ocultar el origen (Slickdeals, etc).
 */
class LinkTransformer {
    constructor() {
        require('dotenv').config();
        this.tags = {
            amazon: process.env.AMAZON_TAG || 'masbaratodeal-20',
            ebay: process.env.EBAY_CAMPAIGN_ID || '5339000000', // Reemplazar con ID real de EPN
            walmart: process.env.WALMART_AFFILIATE_ID || '',
            aliexpress: process.env.ALIEXPRESS_KEY || ''
        };
    }

    async transform(url) {
        if (!url) return url;

        try {
            // 1. "DESMANTELAR" Slickdeals: Obtener la tienda real
            if (url.includes('slickdeals.net')) {
                // Si ya trae el destino en el parámetro u2, lo extraemos directamente (Ahorra tiempo)
                if (url.includes('u2=')) {
                    const u2 = new URL(url).searchParams.get('u2');
                    if (u2) url = decodeURIComponent(u2);
                } else {
                    // Si es un link corto o de foro, seguimos la redirección para ver a dónde va
                    try {
                        const axios = require('axios');
                        const res = await axios.get(url, {
                            maxRedirects: 5,
                            timeout: 5000,
                            headers: { 'User-Agent': 'Mozilla/5.0' }
                        });
                        url = res.request.res.responseUrl || url;
                    } catch (err) {
                        // Si falla la petición (bloqueo), intentar extraer del query original
                    }
                }
            }

            const urlObj = new URL(url);

            // 2. MONETIZACIÓN LIMPIA (Ocultar origen)
            // Amazon USA
            if (urlObj.hostname.includes('amazon')) {
                ['tag', 'ascsubtag', 'ref_', 'ref', 'qid', 'sr', 'linkCode', 'psc'].forEach(p => urlObj.searchParams.delete(p));
                urlObj.searchParams.set('tag', this.tags.amazon);
                return urlObj.toString();
            }

            // eBay (EPN)
            if (urlObj.hostname.includes('ebay.com')) {
                const match = url.match(/\/itm\/(\d+)/);
                if (match) {
                    const itemId = match[1];
                    return `https://www.ebay.com/itm/${itemId}?mkcid=1&mkrid=711-53200-19255-0&siteid=0&campid=${this.tags.ebay}&customid=masbarato&toolid=10001&mkevt=1`;
                }
            }

            // Walmart / AliExpress / etc.
            if (urlObj.hostname.includes('walmart.com')) {
                urlObj.searchParams.set('affp1', this.tags.walmart);
                return urlObj.toString();
            }

            if (urlObj.hostname.includes('aliexpress')) {
                urlObj.searchParams.set('aff_short_key', this.tags.aliexpress);
                urlObj.searchParams.set('aff_platform', 'api-new');
                return urlObj.toString();
            }

            return url;
        } catch (e) {
            return url;
        }
    }
}

module.exports = new LinkTransformer();
