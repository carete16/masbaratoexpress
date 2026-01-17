const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');

/**
 * BOT 1: EXPLORADOR DE PROFUNDIDAD
 * Su misión: Navegar hasta la tienda real, detectar cupones escondidos 
 * y verificar la veracidad de la oferta.
 */
class DeepExplorerBot {
    constructor() {
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }

    async explore(initialUrl) {
        logger.info(`🕵️ BOT 1 (Explorador) iniciando expedición: ${initialUrl.substring(0, 60)}...`);

        let result = {
            finalUrl: initialUrl,
            coupon: null,
            isExpired: false,
            price_offer: null,
            price_official: null,
            store: 'Oferta USA',
            image: null
        };

        try {
            // 1. CARGAR PÁGINA INTERNA DE SLICKDEALS
            let response;
            try {
                response = await axios.get(initialUrl, {
                    headers: { 'User-Agent': this.userAgent },
                    timeout: 12000
                });
            } catch (e) {
                if (e.response && (e.response.status === 403 || e.response.status === 429)) {
                    logger.info(`🛡️ Slickdeals bloqueó acceso directo. Activando Bypass via Google Proxy...`);
                    const proxyUrl = `https://translate.google.com/translate?sl=auto&tl=en&u=${encodeURIComponent(initialUrl)}`;
                    response = await axios.get(proxyUrl, {
                        headers: { 'User-Agent': this.userAgent },
                        timeout: 15000
                    });
                } else { throw e; }
            }

            const html = response.data;
            const $ = cheerio.load(html);

            // A. EXTRACCIÓN DE PRECIOS (PARIDAD TOTAL - SELECTORES SLICKDEALS 2024)
            const priceText = $('.dealPrice').first().text().trim() ||
                $('.itemPrice').first().text().trim() ||
                $('[data-bhw="Price"]').text().trim() ||
                $('.mainItemPrice').text().trim() ||
                $('.price').first().text().trim();

            if (priceText) {
                const match = priceText.match(/\$(\d+(?:\.\d{2})?)/);
                if (match) result.price_offer = parseFloat(match[1]);
            }

            // B. PRECIO ORIGINAL (MSRP / List Price / Was) - CRÍTICO PARA CLONACIÓN
            const originalPriceText = $('.listPrice').first().text().trim() ||
                $('.oldPrice').first().text().trim() ||
                $('.regPrice').first().text().trim() ||
                $('.strike').first().text().trim() ||
                $('.msrp').first().text().trim() ||
                $('.wasPrice').first().text().trim() ||
                $('.itemPrice.reg').text().trim() ||
                $('[data-bhw="ListPrice"]').text().trim() ||
                $('.strikethrough').first().text().trim();

            if (originalPriceText) {
                const match = originalPriceText.match(/\$(\d+(?:\.\d{2})?)/);
                if (match) result.price_official = parseFloat(match[1]);
            }

            // Si aún no tenemos precio oficial, buscar en el texto descriptivo con patrones avanzados
            if (!result.price_official || result.price_official <= result.price_offer) {
                const text = $('.itemDetails, .description, .dealTitle, .mainContent').text();
                const patterns = [
                    /(?:Reg\.|Was|MSRP|List|List Price|Original|Retail|Normally)\s*[:\-]?\s*\$([\d,]+\.?\d*)/i,
                    /\$([\d,]+\.?\d*)\s*(?:Reg\.|Was|MSRP|List)/i,
                    /save\s*.*?\s*off\s*\$([\d,]+\.?\d*)/i
                ];

                for (let p of patterns) {
                    const m = text.match(p);
                    if (m) {
                        result.price_official = parseFloat(m[1].replace(',', ''));
                        break;
                    }
                }
            }

            // SEGURIDAD: Sincronizar con lo que detectó el Bot 1 si aquí falló
            // (Esto se hace en el CoreProcessor)

            // Garantizar que si el precio oficial es menor o igual al de oferta, se anule (Data Sanitize)
            if (result.price_official && result.price_offer && result.price_official <= result.price_offer) {
                result.price_official = 0;
            }

            // B. DETECTAR IMAGEN DE ALTA CALIDAD
            result.image = $('.itemImage img, .mainImage img, .imageContainer img').attr('src') ||
                $('.imageCanvas img').attr('src') ||
                $('meta[property="og:image"]').attr('content');

            if (result.image && result.image.startsWith('//')) result.image = 'https:' + result.image;

            // C. DETECTAR CUPÓN (Múltiples fuentes)
            result.coupon = $('.couponCode, .promoCode, [data-bhw="CouponCode"]').first().text().trim() ||
                $('button[data-clipboard-text]').attr('data-clipboard-text');

            // Búsqueda inteligente de cupones en el contenido (Si falla el selector directo)
            if (!result.coupon) {
                const descText = $('.itemDetails, .description, .mainContent').text() || '';
                // Buscar patrones como: "code ENERO50", "coupon HALLAZGOS", ó texto en mayúsculas de 4-15 chars
                const couponMatches = descText.match(/(?:code|coupon|código|cupón)[:\s]?\s*([A-Z0-9]{4,15})/i) ||
                    descText.match(/([A-Z0-9]{5,15})\s*(?:Copy Code)/i);
                if (couponMatches) {
                    result.coupon = couponMatches[1].toUpperCase();
                    logger.info(`🎯 Cupón detectado en texto: ${result.coupon}`);
                }
            }

            // D. VERIFICAR SI ESTÁ EXPIRADA
            const expiredSignals = $('.expired, .dealExpired, :contains("Deal is Expired")').length > 0;
            if (expiredSignals) {
                logger.warn(`⚠️ Oferta detectada como EXPIRADA.`);
                result.isExpired = true;
                return result;
            }

            // E. SEGUIR EL RASTRO HASTA LA TIENDA REAL (Búsqueda Agresiva)
            let buyNowLinks = $('a.buyNow, a.button--primary, a.button--checkout, a[data-bhw="BuyNowButton"], a.button, .buyNow .button, a:contains("Consigue"), a:contains("Amazon"), a:contains("eBay"), a:contains("Walmart")');
            let buyNowLink = null;

            for (let i = 0; i < buyNowLinks.length; i++) {
                let href = $(buyNowLinks[i]).attr('data-href') || $(buyNowLinks[i]).attr('href');
                if (href && !href.includes('product-reviews') && !href.includes('/reviews/') && href !== '#') {
                    buyNowLink = href;
                    break;
                }
            }

            // 2. Si no hay, buscar en JSON-LD (Slickdeals suele ponerlo ahí)
            if (!buyNowLink) {
                const scripts = $('script[type="application/ld+json"]');
                scripts.each((i, el) => {
                    try {
                        const json = JSON.parse($(el).html());
                        if (json.url && !json.url.includes('slickdeals.net')) buyNowLink = json.url;
                        if (json.offers && json.offers.url) buyNowLink = json.offers.url;
                    } catch (e) { }
                });
            }

            if (buyNowLink) {
                if (buyNowLink.startsWith('/')) buyNowLink = 'https://slickdeals.net' + buyNowLink;

                // 1. INTENTO POR PARÁMETROS (Rápido)
                try {
                    const u = new URL(buyNowLink, 'https://slickdeals.net');
                    const realUrl = u.searchParams.get('u2') || u.searchParams.get('url') || u.searchParams.get('lno') || u.searchParams.get('u');
                    if (realUrl && realUrl.startsWith('http')) {
                        result.finalUrl = decodeURIComponent(realUrl);
                    }
                } catch (e) { }

                // 2. INTENTO POR RASTREO FÍSICO (Si sigue siendo Slickdeals)
                if (result.finalUrl.includes('slickdeals.net') || result.finalUrl.includes('redirect.viglink.com')) {
                    try {
                        const shopRes = await axios.get(buyNowLink, {
                            headers: {
                                'User-Agent': this.userAgent,
                                'Referer': 'https://slickdeals.net/'
                            },
                            maxRedirects: 15,
                            timeout: 12000
                        });

                        let candidate = shopRes.request?.res?.responseUrl || shopRes.config?.url;

                        // Si el resultado sigue teniendo el envoltorio de Viglink/Slickdeals, extraer de nuevo
                        if (candidate && (candidate.includes('u2=') || candidate.includes('u='))) {
                            const cUrl = new URL(candidate);
                            candidate = cUrl.searchParams.get('u2') || cUrl.searchParams.get('u') || candidate;
                        }

                        result.finalUrl = decodeURIComponent(candidate);
                    } catch (e) {
                        logger.warn(`⚠️ Error resolviendo link físico: ${e.message}`);
                    }
                }
            }

            // F. DETECTAR TIENDA POR DOMINIO (Garantizar no poner "Slickdeals")
            const domainMatch = result.finalUrl.match(/https?:\/\/(?:www\.)?([^/]+)/);
            if (domainMatch) {
                const domain = domainMatch[1].toLowerCase();
                const storeMap = {
                    'amazon': 'Amazon', 'walmart': 'Walmart', 'ebay': 'eBay', 'target': 'Target',
                    'bestbuy': 'Best Buy', 'academy': 'Academy', 'adidas': 'Adidas', 'nike': 'Nike',
                    'puma': 'Puma', 'kohls': 'Kohls', 'macys': 'Macys', 'homedepot': 'Home Depot',
                    'lowes': 'Lowes', 'newegg': 'Newegg', 'costco': 'Costco'
                };

                for (const [key, value] of Object.entries(storeMap)) {
                    if (domain.includes(key)) {
                        result.store = value;
                        break;
                    }
                }

                if (result.store === 'Oferta USA' || result.store.toLowerCase().includes('slickdeals')) {
                    const parts = domain.split('.');
                    let name = parts.length > 2 ? parts[1] : parts[0];

                    // BLOQUEO ABSOLUTO: Prohibido decir Slickdeals
                    if (name.toLowerCase().includes('slickdeals')) {
                        name = 'Oferta USA';
                    }

                    result.store = name.charAt(0).toUpperCase() + name.slice(1);
                }
            }

            // G. LIMPIEZA FINAL DE SEGURIDAD (Doble Check)
            if (result.store.toLowerCase().includes('slickdeals')) {
                result.store = 'Oferta USA';
            }

            logger.info(`✅ BOT 1 completado. Tienda: ${result.store}`);
            return result;

        } catch (error) {
            logger.error(`❌ BOT 1 Error Profundo: ${error.message}`);
            return result;
        }
    }
}

module.exports = new DeepExplorerBot();
