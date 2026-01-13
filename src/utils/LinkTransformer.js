/**
 * Este módulo se encarga de convertir links normales en links de afiliado.
 */
class LinkTransformer {
    constructor() {
        require('dotenv').config();
        this.tags = {
            amazon: process.env.AMAZON_TAG || 'tu_tag_pendiente-20',
            aliexpress: process.env.ALIEXPRESS_KEY || '',
            walmart: process.env.WALMART_ID || ''
        };
    }

    transform(url) {
        try {
            const urlObj = new URL(url);

            // 1. Amazon Monetization Engine
            if (urlObj.hostname.includes('amazon')) {
                // Eliminar tags anteriores para evitar conflictos
                urlObj.searchParams.delete('tag');
                urlObj.searchParams.delete('ascsubtag');

                // Inyectar TU tag
                urlObj.searchParams.set('tag', this.tags.amazon);

                // Limpiar URL para que se vea profesional (eliminar parámetros de tracking espía)
                const cleanParams = ['dchild', 'keywords', 'qid', 'sr', 'ref'];
                cleanParams.forEach(p => urlObj.searchParams.delete(p));

                return urlObj.toString();
            }

            // Si es AliExpress
            if (urlObj.hostname.includes('aliexpress')) {
                // AliExpress suele requerir un portal, pero podemos añadir el tag base
                urlObj.searchParams.set('aff_platform', 'api-new');
                urlObj.searchParams.set('aff_short_key', this.tags.aliexpress);
                return urlObj.toString();
            }

            // Añadir más tiendas según necesites
            return url;
        } catch (e) {
            return url;
        }
    }
}

module.exports = new LinkTransformer();
