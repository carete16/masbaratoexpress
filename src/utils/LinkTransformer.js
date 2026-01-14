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

    transform(url) {
        if (!url) return url;

        try {
            // Manejar links de redirección de Slickdeals si llegan
            if (url.includes('slickdeals.net') && url.includes('u2=')) {
                const u2 = new URL(url).searchParams.get('u2');
                if (u2) url = decodeURIComponent(u2);
            }

            const urlObj = new URL(url);

            // 1. Amazon USA / Global
            if (urlObj.hostname.includes('amazon')) {
                // Eliminar cualquier rastro de tracking de terceros
                ['tag', 'ascsubtag', 'ref_', 'ref', 'qid', 'sr', 'linkCode', 'psc'].forEach(p => urlObj.searchParams.delete(p));
                urlObj.searchParams.set('tag', this.tags.amazon);
                return urlObj.toString();
            }

            // 2. eBay USA (EPN - eBay Partner Network)
            if (urlObj.hostname.includes('ebay.com')) {
                const match = url.match(/\/itm\/(\d+)/);
                if (match) {
                    const itemId = match[1];
                    // Formato optimizado para eBay Partner Network
                    return `https://www.ebay.com/itm/${itemId}?mkcid=1&mkrid=711-53200-19255-0&siteid=0&campid=${this.tags.ebay}&customid=masbarato&toolid=10001&mkevt=1`;
                }
            }

            // 3. Walmart
            if (urlObj.hostname.includes('walmart.com')) {
                urlObj.searchParams.set('affp1', this.tags.walmart);
                return urlObj.toString();
            }

            // 4. AliExpress
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
