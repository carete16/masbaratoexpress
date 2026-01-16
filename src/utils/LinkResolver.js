const axios = require('axios');
const logger = require('./logger');

class LinkResolver {

    /**
     * Resuelve redirecciones ligeras usando Axios (HTTP HEAD/GET).
     * Ideal para evitar cargar Puppeteer en servidores limitados.
     */
    async resolve(url) {
        if (!url) return null;

        // Atajo: Si ya parece una tienda destino, devolverlo
        if (url.includes('amazon') || url.includes('ebay') || url.includes('walmart')) {
            return url;
        }

        try {
            const response = await axios.get(url, {
                maxRedirects: 5, // Seguir hasta 5 saltos
                validateStatus: function (status) {
                    return status >= 200 && status < 400; // Aceptar redirects como éxito para ver headers
                },
                timeout: 8000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            // Axios devuelve la URL final después de redirecciones en response.request.res.responseUrl 
            // O en response.config.url si no hubo cambios.
            const finalUrl = response.request?.res?.responseUrl || response.config.url || url;

            return finalUrl;

        } catch (error) {
            // Si es un error de timeout o red, devolvemos la original.
            // A veces Slickdeals bloquea bots, asi que mejor devolver el link original que fallar.
            logger.warn(`Fallo resolución ligera (${url}): ${error.message}. Usando original.`);
            return url;
        }
    }
}

module.exports = new LinkResolver();
