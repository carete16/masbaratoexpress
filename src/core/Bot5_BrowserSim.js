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
            // TÉCNICA 1: Simular clic en el botón "See Deal" siguiendo redirecciones
            // Slickdeals usa un endpoint /f/XXXXX/click que redirige a la tienda
            const dealId = slickdealsUrl.match(/\/f\/(\d+)/)?.[1];
            if (!dealId) throw new Error('No se pudo extraer Deal ID');

            // Intentar varios endpoints conocidos de Slickdeals
            const endpoints = [
                `https://slickdeals.net/f/${dealId}/click`,
                `https://slickdeals.net/e/v1/deal/${dealId}/click`,
                `https://slickdeals.net/redirect/deal/${dealId}`
            ];

            for (const endpoint of endpoints) {
                try {
                    const response = await axios.get(endpoint, {
                        maxRedirects: 0, // No seguir automáticamente
                        validateStatus: status => status >= 200 && status < 400,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Referer': slickdealsUrl,
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                        },
                        timeout: 5000
                    });

                    // Si hay Location header, ese es el link real
                    if (response.headers.location) {
                        const realLink = response.headers.location;
                        if (!realLink.includes('slickdeals.net')) {
                            logger.info(`✅ BOT 5 extrajo link limpio: ${realLink}`);
                            return { success: true, link: realLink };
                        }
                    }
                } catch (e) {
                    // Intentar siguiente endpoint
                    continue;
                }
            }

            // TÉCNICA 2: Parsear el HTML buscando data-attributes ocultos
            const htmlResponse = await axios.get(slickdealsUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15',
                    'Accept': 'text/html,application/xhtml+xml'
                },
                timeout: 8000
            });

            const $ = cheerio.load(htmlResponse.data);

            // Buscar en atributos data-*
            const dataUrl = $('[data-url]').attr('data-url') ||
                $('[data-href]').attr('data-href') ||
                $('[data-deal-url]').attr('data-deal-url');

            if (dataUrl && !dataUrl.includes('slickdeals.net')) {
                logger.info(`✅ BOT 5 extrajo link de data-attribute: ${dataUrl}`);
                return { success: true, link: decodeURIComponent(dataUrl) };
            }

            logger.warn(`⚠️ BOT 5 no pudo extraer link limpio`);
            return { success: false, link: slickdealsUrl };

        } catch (error) {
            logger.error(`❌ BOT 5 Error: ${error.message}`);
            return { success: false, link: slickdealsUrl };
        }
    }
}

module.exports = new BrowserSimulator();
