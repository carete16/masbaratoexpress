const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');

/**
 * BOT 2: EXPLORADOR DE PROFUNDIDAD (Protocolo de Rastro Puro)
 * Este bot no intenta scrapear HTML (que Slickdeals bloquea).
 * En su lugar, sigue las redirecciones de marketing que son menos protegidas.
 */
class DeepExplorerBot {
    constructor() {
        this.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
    }

    async explore(initialUrl) {
        logger.info(`🕵️ BOT 2 (Deep Trace) iniciando expedición: ${initialUrl.substring(0, 60)}...`);

        const result = {
            finalUrl: initialUrl,
            coupon: null,
            isExpired: false,
            price_offer: null,
            price_official: null,
            store: 'Oferta USA',
            image: null
        };

        try {
            // TÉCNICA 1: EXTRACCIÓN ESTÁTICA (Inmune a Bloqueos)
            // Si la URL ya contiene el destino en parámetros (común en RSS/Alertas)
            try {
                const uObj = new URL(initialUrl);
                const rawDest = uObj.searchParams.get('u2') || uObj.searchParams.get('url') || uObj.searchParams.get('dest') || uObj.searchParams.get('mpre');
                if (rawDest && rawDest.startsWith('http')) {
                    result.finalUrl = decodeURIComponent(rawDest);
                    logger.info(`🎯 EXTRACCIÓN ESTÁTICA EXITOSA: ${result.finalUrl.substring(0, 50)}...`);
                    // Seguir limpiando si el destino es otro redirector (CJ, Viglink, etc)
                    if (result.finalUrl.includes('cj.com') || result.finalUrl.includes('viglink')) {
                        const subUrl = new URL(result.finalUrl);
                        const subDest = subUrl.searchParams.get('url') || subUrl.searchParams.get('mpre') || subUrl.searchParams.get('dest');
                        if (subDest) result.finalUrl = decodeURIComponent(subDest);
                    }
                    return await this.finalizeResult(result);
                }
            } catch (e) { }

            const dealIdMatch = initialUrl.match(/\/f\/(\d+)/);
            if (!dealIdMatch) {
                // Intentar limpiar pno o u2 si vienen del RSS
                const uObj = new URL(initialUrl);
                const u2 = uObj.searchParams.get('u2');
                if (u2) result.finalUrl = decodeURIComponent(u2);
                return result;
            }

            const dealId = dealIdMatch[1];

            // ESTRATEGIA: CASCADA DE REDIRECCIÓN + PROXY LIMPIO
            const traceEndpoints = [
                `https://slickdeals.net/f/${dealId}?utm_source=dealalerts&utm_medium=email&utm_campaign=tu`,
                `https://slickdeals.net/share/readpostpermalink/${dealId}`
            ];

            let traceSuccess = false;

            for (const endpoint of traceEndpoints) {
                try {
                    // Intento 1: Redirección Directa
                    let traceRes = await axios.get(endpoint, {
                        maxRedirects: 10,
                        validateStatus: () => true,
                        timeout: 10000,
                        headers: { 'User-Agent': this.userAgent, 'Referer': 'https://www.google.com/' }
                    });

                    let finalUrl = traceRes.request?.res?.responseUrl || traceRes.config?.url;

                    // Intento 2: Fallback a Proxy de Google (Si hay 403)
                    if (!finalUrl || finalUrl.includes('slickdeals.net')) {
                        const proxyUrl = `https://translate.google.com/translate?sl=auto&tl=en&u=${encodeURIComponent(endpoint)}`;
                        const proxyRes = await axios.get(proxyUrl, { timeout: 12000, headers: { 'User-Agent': this.userAgent } });
                        const $ = cheerio.load(proxyRes.data);
                        // Buscar el link original dentro del frame de Google
                        const rawLink = $('a[href*="amazon.com"], a[href*="walmart.com"], a[href*="ebay.com"]').first().attr('href');
                        if (rawLink) finalUrl = decodeURIComponent(rawLink.split('u=')[1] || rawLink);
                    }

                    if (finalUrl && !finalUrl.includes('slickdeals.net') && !finalUrl.includes('google.com')) {
                        result.finalUrl = finalUrl;
                        traceSuccess = true;
                        logger.info(`✅ AUTOMATIZACIÓN EXITOSA: ${finalUrl.substring(0, 40)}...`);
                        break;
                    }
                } catch (e) { continue; }
            }

            return await this.finalizeResult(result);
        } catch (error) {
            logger.error(`❌ BOT 2 Error: ${error.message}`);
            return result;
        }
    }

    async finalizeResult(result) {
        // LIMPIEZA DE RASTROS DE PROXY
        if (result.finalUrl.includes('googleusercontent.com')) {
            const urlMatch = result.finalUrl.match(/u=(https?%3A%2F%2F[^&]+)/);
            if (urlMatch) result.finalUrl = decodeURIComponent(urlMatch[1]);
        }

        // ASIGNACIÓN DE TIENDA BASADA EN EL DOMINIO FINAL (LIMPIO)
        const domainMatch = result.finalUrl.match(/https?:\/\/(?:www\.)?([^/]+)/);
        if (domainMatch) {
            const d = domainMatch[1].toLowerCase();
            if (d.includes('amazon')) result.store = 'Amazon';
            else if (d.includes('walmart')) result.store = 'Walmart';
            else if (d.includes('ebay')) result.store = 'eBay';
            else if (d.includes('adorama')) result.store = 'Adorama';
            else if (d.includes('bestbuy')) result.store = 'Best Buy';
            else if (d.includes('target')) result.store = 'Target';
            else if (d.includes('homedepot')) result.store = 'Home Depot';
            else if (d.includes('newegg')) result.store = 'Newegg';
            else result.store = 'Oferta USA';
        }

        // NUNCA permitir que la tienda sea Translate
        if (result.store.includes('Translate') || result.store.includes('Google')) {
            result.store = 'Oferta USA';
        }

        return result;
    }
}

module.exports = new DeepExplorerBot();
