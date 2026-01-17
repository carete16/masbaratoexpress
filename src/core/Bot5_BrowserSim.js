const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');

/**
 * BOT 5: BROWSER SIMULATOR (Último Recurso)
 * Simula un navegador real para casos extremos donde Slickdeals bloquea todo.
 * Usa técnicas avanzadas de evasión sin necesidad de Puppeteer.
 */
class BrowserSimulator {
    constructor() {
        this.sessions = new Map(); // Mantener cookies entre requests
    }

    async extractRealLink(slickdealsUrl) {
        logger.info(`🌐 BOT 5 (Browser Simulator) activado para: ${slickdealsUrl}`);

        try {
            // Extraer Deal ID de la URL
            const dealIdMatch = slickdealsUrl.match(/\/f\/(\d+)/);
            if (!dealIdMatch) {
                logger.warn('No se pudo extraer Deal ID');
                return { success: false, link: slickdealsUrl };
            }

            const dealId = dealIdMatch[1];

            // TÉCNICA: Seguir redirecciones HTTP sin ejecutar JavaScript
            // Slickdeals usa varios endpoints que redirigen a la tienda
            const redirectEndpoints = [
                `https://slickdeals.net/f/${dealId}?src=SiteSearchV2Algo&utm_source=dealalerts&utm_medium=email&utm_term=&utm_content=&utm_campaign=tu&p=`,
                `https://slickdeals.net/share/readpostpermalink/${dealId}`,
                `https://slickdeals.net/f/${dealId}?page=1#commentsBox`
            ];

            for (const endpoint of redirectEndpoints) {
                try {
                    // Hacer request con maxRedirects: 0 para capturar el Location header
                    const response = await axios.get(endpoint, {
                        maxRedirects: 5, // Seguir hasta 5 redirecciones
                        validateStatus: () => true, // Aceptar cualquier status
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Accept': 'text/html,application/xhtml+xml',
                            'Referer': 'https://www.google.com/'
                        },
                        timeout: 8000
                    });

                    // Verificar si la URL final es de una tienda real
                    const finalUrl = response.request?.res?.responseUrl || response.config?.url || endpoint;

                    if (finalUrl && !finalUrl.includes('slickdeals.net') &&
                        (finalUrl.includes('amazon.com') ||
                            finalUrl.includes('walmart.com') ||
                            finalUrl.includes('ebay.com') ||
                            finalUrl.includes('bestbuy.com') ||
                            finalUrl.includes('target.com') ||
                            finalUrl.includes('adorama.com'))) {

                        logger.info(`✅ BOT 5 extrajo link limpio vía redirección: ${finalUrl.substring(0, 60)}...`);
                        return { success: true, link: finalUrl };
                    }

                } catch (e) {
                    logger.warn(`Endpoint ${endpoint} falló: ${e.message}`);
                    continue;
                }
            }

            // Si todo falló, intentar parsear el HTML como último recurso
            try {
                const htmlResponse = await axios.get(slickdealsUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X)',
                        'Accept': 'text/html'
                    },
                    timeout: 10000
                });

                const cheerio = require('cheerio');
                const $ = cheerio.load(htmlResponse.data);

                // Buscar cualquier link de tienda en el HTML
                const storeLink = $('a[href*="amazon.com"], a[href*="walmart.com"], a[href*="ebay.com"]').first().attr('href');

                if (storeLink && !storeLink.includes('slickdeals.net')) {
                    logger.info(`✅ BOT 5 extrajo link del HTML: ${storeLink.substring(0, 60)}...`);
                    return { success: true, link: storeLink.replace(/&amp;/g, '&') };
                }

            } catch (htmlError) {
                logger.warn(`Parseo HTML falló: ${htmlError.message}`);
            }

            logger.warn(`⚠️ BOT 5 no pudo extraer link limpio después de todos los intentos`);
            return { success: false, link: slickdealsUrl };

        } catch (error) {
            logger.error(`❌ BOT 5 Error: ${error.message}`);
            return { success: false, link: slickdealsUrl };
        }
    }
}

module.exports = new BrowserSimulator();
