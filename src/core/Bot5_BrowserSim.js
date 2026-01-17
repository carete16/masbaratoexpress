const axios = require('axios');
const logger = require('../utils/logger');

/**
 * BOT 5: BROWSER SIMULATOR (El Fantasma)
 * Su misión: Obtener el link final de la tienda usando ingeniería inversa 
 * sobre los endpoints de redirección de Slickdeals.
 */
class BrowserSimulator {
    constructor() {
        this.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    }

    async extractRealLink(slickdealsUrl) {
        logger.info(`👻 BOT 5 (Fantasma) entrando en acción para: ${slickdealsUrl.substring(0, 50)}...`);

        try {
            // Extraer ID de la oferta
            const dealIdMatch = slickdealsUrl.match(/\/f\/(\d+)/);
            if (!dealIdMatch) return { success: false };
            const dealId = dealIdMatch[1];

            // ESTRATEGIA: REDIRECCIÓN POR CABECERAS (HEAD Request)
            // Intentamos engañar a Slickdeals usando endpoints de marketing/app
            const magicEndpoints = [
                `https://slickdeals.net/f/${dealId}?p=1&utm_source=dealalerts`,
                `https://slickdeals.net/f/${dealId}?utm_source=rss-portal`,
                `https://slickdeals.net/f/${dealId}?p=1`
            ];

            for (const endpoint of magicEndpoints) {
                try {
                    // El truco está en usar HEAD para obtener el Location sin que salte el reto de Cloudflare del HTML
                    const res = await axios.get(endpoint, {
                        maxRedirects: 15,
                        timeout: 12000,
                        validateStatus: (status) => status >= 200 && status < 400,
                        headers: {
                            'User-Agent': this.userAgent,
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                            'Accept-Language': 'en-US,en;q=0.5',
                            'Referer': 'https://www.google.com/',
                            'Cache-Control': 'no-cache'
                        }
                    });

                    let finalUrl = res.request?.res?.responseUrl || res.config?.url;

                    // Si logramos salir de slickdeals.net, ¡HEMOS GANADO!
                    if (finalUrl && !finalUrl.includes('slickdeals.net') && !finalUrl.includes('google.com')) {
                        // Limpieza de redirectores intermedios (Viglink, CJ, etc.)
                        finalUrl = this.deepClean(finalUrl);

                        logger.info(`💎 BOT 5 ÉXITO TOTAL: Link extraído quirúrgicamente.`);
                        return { success: true, link: finalUrl };
                    }
                } catch (e) {
                    continue; // Probar siguiente endpoint
                }
            }

            return { success: false };

        } catch (error) {
            logger.error(`❌ BOT 5 Error: ${error.message}`);
            return { success: false };
        }
    }

    deepClean(url) {
        try {
            const u = new URL(url);
            const clean = u.searchParams.get('u2') || u.searchParams.get('url') || u.searchParams.get('mpre') || u.searchParams.get('dest');
            return clean ? decodeURIComponent(clean) : url;
        } catch (e) {
            return url;
        }
    }
}

module.exports = new BrowserSimulator();
