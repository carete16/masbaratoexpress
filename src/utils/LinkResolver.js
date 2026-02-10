const axios = require('axios');
const logger = require('./logger');

class LinkResolver {

    /**
     * Resuelve redirecciones ligeras usando Axios (HTTP HEAD/GET).
     * Ideal para evitar cargar Puppeteer en servidores limitados.
     */
    async resolve(url) {
        if (!url) return null;

        const lowUrl = url.toLowerCase();

        // Atajo: Solo retornar si es un enlace DIRECTO a la tienda y NO un redirect
        const isRedirect = lowUrl.includes('redirect') || lowUrl.includes('viglink') || lowUrl.includes('tkqlhce') || lowUrl.includes('anrdoezrs');
        const directStores = ['amazon.com', 'ebay.com', 'walmart.com', 'bestbuy.com', 'target.com', 'nike.com', 'adidas.com'];

        if (!isRedirect && directStores.some(ds => lowUrl.includes(ds) && !lowUrl.includes('?u=') && !lowUrl.includes('&u='))) {
            return url;
        }

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
                maxRedirects: 8,
                timeout: 8000,
                validateStatus: null, // No lanzar error en 403/404 para ver si hay redirs
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': 'https://www.google.com/'
                }
            });

            // Si hay un refresh header o meta redirect
            const refresh = response.headers['refresh'];
            if (refresh) {
                const match = refresh.match(/url=(.*)/i);
                if (match && match[1]) return await this.resolve(match[1]);
            }

            return response.request?.res?.responseUrl || response.config.url || url;
        } catch (error) {
            return url;
        }

    }
}

module.exports = new LinkResolver();
