const logger = require('./logger');

/**
 * Este módulo se encarga de convertir links normales en links de afiliado.
 * Actúa bajo una lógica de "Multi-Tienda" para ocultar el origen (Slickdeals, etc).
 */
class LinkTransformer {
    constructor() {
        require('dotenv').config();
        this.tags = {
            amazon: process.env.AMAZON_TAG || 'masbaratodeal-20',
            ebay: process.env.EBAY_CAMPAIGN_ID || '',
            walmart: process.env.WALMART_ID || '',
            // Clave REAL de Sovrn hardcodeada para asegurar monetización inmediata en Render
            sovrn_prefix: process.env.SOVRN_URL_PREFIX || 'https://redirect.viglink.com?key=168bdd181cfb276b05d8527e1d4cd03e&u='
        };
    }

    async transform(url) {
        if (!url) return url;

        const originalUrl = url; // Guardar para logging

        try {
            // 1. "DESMANTELAR" Slickdeals: Obtener la tienda real
            if (url.includes('slickdeals.net')) {
                logger.info(`🕵️ BYPASS SLICKDEALS INICIADO: ${url.substring(0, 80)}...`);

                // Opción A: Extraer de u2 (Rápido)
                if (url.includes('u2=')) {
                    const u2 = new URL(url).searchParams.get('u2');
                    if (u2) {
                        url = decodeURIComponent(u2);
                        logger.info(`✅ Bypass por u2: ${url}`);
                    }
                } else {
                    // Opción B: Scraping de emergencia (Seguir el rastro)
                    try {
                        const axios = require('axios');
                        console.log(`[DEBUG] Solicitando página: ${url}`);
                        const res = await axios.get(url, {
                            maxRedirects: 5,
                            timeout: 10000,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                            }
                        });

                        console.log(`[DEBUG] Respuesta recibida (${res.data.length} bytes)`);

                        // 1. Intentar ver si terminó en una tienda conocida
                        const finalUrl = res.request.res.responseUrl || res.config.url;
                        console.log(`[DEBUG] URL Final despues de redirects: ${finalUrl}`);

                        if (finalUrl && !finalUrl.includes('slickdeals.net') && finalUrl.includes('http')) {
                            url = finalUrl;
                            console.log(`✅ Bypass por Redireccion Final: ${url}`);
                        } else {
                            // 2. Si sigue en Slickdeals, buscar un link retail en el HTML (Búsqueda agresiva)
                            const html = res.data;
                            // logger.info(`📄 HTML recibido: ${html.length} bytes`); // This line was removed as per instruction
                            // Regex ampliado con más tiendas USA
                            const storeRegex = /href="([^"]*?(?:amazon|walmart|ebay|target|bestbuy|walgreens|cvs|macys|kohls|homedepot|lowes|newegg|costco|bhphotovideo|gamestop|adidas|nike|puma|gap|oldnavy|apple)\.(?:com|net|org)[^"]*?)"/i;
                            const retailMatch = html.match(storeRegex);

                            if (retailMatch) {
                                url = retailMatch[1].replace(/&amp;/g, '&');
                                if (url.startsWith('/')) url = 'https://slickdeals.net' + url;
                                // Si este link interno a su vez tiene u2, lo limpiamos recursivamente
                                if (url.includes('u2=')) {
                                    url = decodeURIComponent(new URL(url).searchParams.get('u2'));
                                }
                                console.log(`✅ Bypass por Scraping de HTML: ${url}`);
                            } else {
                                console.log(`[DEBUG] No se encontró ningún link retail en el HTML.`);
                            }
                        }
                    } catch (err) {
                        console.log(`[DEBUG] Error en bypass: ${err.message}`);
                        logger.warn(`⚠️ Error Bypass: ${err.message}`);
                    }
                }
            }

            // 2. MONETIZACIÓN LIMPIA (Ocultar origen)

            // PASO PREVIO: Limpieza Profunda de Afiliados Ajenos
            // Quitamos parámetros conocidos de otros marketers para que no interfieran
            try {
                const urlObj = new URL(url);
                const badParams = [
                    'tag', 'ascsubtag', 'ref', 'ref_', 'campid', 'mkcid', 'mkrid', 'customid', 'toolid',
                    'mkevt', 'aff', 'affiliate', 'adgroupid', 'u1', 'u2', 'aid', 'qid', 'sr', 'linkCode'
                ];
                badParams.forEach(p => urlObj.searchParams.delete(p));
                url = urlObj.toString();
            } catch (e) { /* Si falla parsing, seguimos con url raw */ }

            // 5. Monetización de Tiendas Específicas (Directa)
            if (url.includes('amazon')) {
                // Amazon ya está limpio arriba, solo insertamos nuestro tag
                const urlObj = new URL(url);
                urlObj.searchParams.set('tag', this.tags.amazon);
                return urlObj.toString();

            } else if (url.includes('ebay') && this.tags.ebay) {
                // Formato directo eBay Partner Network
                // La URL 'url' ya viene limpia de 'campid', 'customid', etc.
                return `https://www.ebay.com/rover/1/${this.tags.ebay}/1?mpre=${encodeURIComponent(url)}`;

            } else if (url.includes('walmart') && this.tags.walmart) {
                return `https://walmart.com/ip/${this.tags.walmart}?u=${encodeURIComponent(url)}`;

            } else if (url.includes('aliexpress') && this.tags.aliexpress) {
                const urlObj = new URL(url);
                urlObj.searchParams.set('aff_short_key', this.tags.aliexpress);
                urlObj.searchParams.set('aff_platform', 'api-new');
                return urlObj.toString();
            }

            // 6. Monetización UNIVERSAL (Microcenter, BestBuy, Target, Nike...)
            if (this.tags.sovrn_prefix) {
                return `${this.tags.sovrn_prefix}${encodeURIComponent(url)}`;
            }

            // 🚨 VALIDACIÓN FINAL: Asegurar que NO se devuelva un link de Slickdeals
            if (url.includes('slickdeals.net')) {
                logger.error(`❌ FALLO EN BYPASS: El link sigue siendo de Slickdeals: ${url}`);
                logger.error(`   Link original era: ${originalUrl}`);
                return null; // Devolver null para que CoreProcessor lo descarte
            }

            // ✅ Log de éxito si venía de Slickdeals
            if (originalUrl.includes('slickdeals.net') && !url.includes('slickdeals.net')) {
                logger.info(`✅ BYPASS EXITOSO: ${originalUrl.substring(0, 50)}... → ${url.substring(0, 50)}...`);
            }

            return url;
        } catch (e) {
            logger.error(`Error en LinkTransformer: ${e.message}`);
            return url;
        }
    }
}

module.exports = new LinkTransformer();
