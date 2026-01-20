const axios = require('axios');
const logger = require('./logger');

class LinkResolver {

    /**
     * Resuelve redirecciones ligeras usando Axios (HTTP HEAD/GET).
     * Ideal para evitar cargar Puppeteer en servidores limitados.
     */
    async resolve(url) {
        if (!url) return null;

        // Atajo: Si ya es un destino conocido, no dar vueltas
        const directStores = ['amazon.com', 'ebay.com', 'walmart.com', 'bestbuy.com', 'target.com', 'newegg.com', 'bhphotovideo.com', 'homedepot.com'];
        if (directStores.some(ds => url.includes(ds))) return url;

        // 1. DESEMPAQUETADO DE PARÁMETROS (Sin peticiones HTTP)
        try {
            const lowUrl = url.toLowerCase();
            const uObj = new URL(url.startsWith('/') ? 'https://www.google.com' + url : url);

            // Parámetros comunes de redirección en sitios de ofertas
            const params = ['u', 'url', 'mpre', 'dest', 'reftag', 'u2', 'linkCode', 'ascsubtag'];
            for (const p of params) {
                const val = uObj.searchParams.get(p);
                if (val && (val.startsWith('http') || val.includes('.com') || val.includes('.net'))) {
                    const decoded = decodeURIComponent(val);
                    // Recursión simple para links dobles (ej: slickdeals -> cj -> walmar)
                    return await this.resolve(decoded);
                }
            }
        } catch (e) { }

        // 2. RESOLUCIÓN HTTP (Solo si lo anterior falla)
        try {
            const response = await axios.get(url, {
                maxRedirects: 3,
                timeout: 5000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            return response.request?.res?.responseUrl || response.config.url || url;
        } catch (error) {
            return url;
        }
    }
}

module.exports = new LinkResolver();
