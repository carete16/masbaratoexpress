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
        // Rotación de Agentes para evitar fingerprinting fácil
        const agents = [
            'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
            'Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];
        const randomAgent = agents[Math.floor(Math.random() * agents.length)];

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
                // Intento 1: Request Directo con headers móviles
                response = await axios.get(initialUrl, {
                    headers: {
                        'User-Agent': randomAgent,
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Referer': 'https://www.google.com/'
                    },
                    timeout: 8000
                });
            } catch (e) {
                // Si hay bloqueo 403/429, mejor descartar esta oferta que usar el proxy corrupto
                if (e.response && (e.response.status === 403 || e.response.status === 429)) {
                    logger.warn(`🛡️ Oferta bloqueada por Slickdeals (403/429). Descartando para mantener calidad.`);
                    throw new Error('BLOCKED_BY_SLICKDEALS');
                } else { throw e; }
            }

            const html = response.data;
            const $ = cheerio.load(html);

            // A. EXTRACCIÓN DE PRECIOS & CUPONES (PARIDAD TOTAL)
            const priceText = $('.dealPrice, .price, .itemPrice, .mainItemPrice').first().text().trim();
            if (priceText) {
                const match = priceText.match(/\$(\d+(?:\.\d{2})?)/);
                if (match) result.price_offer = parseFloat(match[1]);
            }

            const originalPriceText = $('.listPrice, .oldPrice, .regPrice, .strike, .msrp').first().text().trim();
            if (originalPriceText) {
                const match = originalPriceText.match(/\$(\d+(?:\.\d{2})?)/);
                if (match) result.price_official = parseFloat(match[1]);
            }

            result.image = $('.itemImage img, .mainImage img, .imageContainer img').attr('src') || $('meta[property="og:image"]').attr('content');
            if (result.image && result.image.startsWith('//')) result.image = 'https:' + result.image;

            result.coupon = $('.couponCode, .promoCode, [data-bhw="CouponCode"]').first().text().trim() ||
                $('button[data-clipboard-text]').attr('data-clipboard-text');

            if (!result.coupon) {
                const descText = $('.itemDetails, .description, .mainContent').text() || '';
                const couponMatches = descText.match(/(?:code|coupon|código|cupón)[:\s]?\s*([A-Z0-9]{4,15})/i);
                if (couponMatches) result.coupon = couponMatches[1].toUpperCase();
            }

            // E. EXTRACCIÓN MAESTRA DE LINKS
            let buyNowLink = null;

            // Método 1: Selectores CSS (Estándar)
            let buyNowLinks = $('a.buyNow, a.button--primary, a:contains("See Deal"), a:contains("Buy Now")');
            for (let i = 0; i < buyNowLinks.length; i++) {
                let href = $(buyNowLinks[i]).attr('href');
                if (href && !href.includes('product-reviews') && href !== '#') {
                    buyNowLink = href;
                    break;
                }
            }

            // Método 2: Variables Globales JS (SD.pageData) - MUY EFECTIVO
            if (!buyNowLink) {
                const scripts = $('script').map((i, el) => $(el).html()).get();
                for (const script of scripts) {
                    if (script.includes('productUrl')) {
                        const match = script.match(/"productUrl":"([^"]+)"/);
                        if (match) {
                            buyNowLink = match[1].replace(/\\/g, '');
                            break;
                        }
                    }
                    if (script.includes('dealParams') || script.includes('offers')) {
                        const match = script.match(/"url":"([^"]+)"/);
                        if (match && !match[1].includes('slickdeals.net')) {
                            buyNowLink = match[1].replace(/\\/g, '');
                            break;
                        }
                    }
                }
            }

            if (buyNowLink) {
                if (buyNowLink.startsWith('/')) buyNowLink = 'https://slickdeals.net' + buyNowLink;

                // Limpieza estática de parámetros
                try {
                    let temp = buyNowLink;
                    for (let k = 0; k < 3; k++) {
                        const u = new URL(temp.startsWith('/') ? 'https://slickdeals.net' + temp : temp);
                        const next = u.searchParams.get('u2') || u.searchParams.get('dest') || u.searchParams.get('url') || u.searchParams.get('pno') || u.searchParams.get('mpre');
                        if (next && next.startsWith('http')) {
                            temp = decodeURIComponent(next);
                            result.finalUrl = temp;
                        } else break;
                    }
                } catch (e) { }
            }

            // F. INFERIR TIENDA DESDE URL FINAL
            const domainMatch = result.finalUrl.match(/https?:\/\/(?:www\.)?([^/]+)/);
            if (domainMatch) {
                const d = domainMatch[1].toLowerCase();
                if (d.includes('amazon')) result.store = 'Amazon';
                else if (d.includes('walmart')) result.store = 'Walmart';
                else if (d.includes('ebay')) result.store = 'eBay';
                else if (d.includes('adorama')) result.store = 'Adorama';
                else if (d.includes('bestbuy')) result.store = 'Best Buy';
            }

            return result;

        } catch (error) {
            logger.error(`❌ BOT 1 Error: ${error.message}`);
            return result;
        }
    }
}

module.exports = new DeepExplorerBot();
