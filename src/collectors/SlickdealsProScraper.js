const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');

/**
 * SCRAPER PROFESIONAL DE SLICKDEALS
 * Extrae datos EXACTOS de cada oferta sin depender del RSS
 */
class SlickdealsProScraper {
    constructor() {
        this.baseUrl = 'https://slickdeals.net';
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Referer': 'https://slickdeals.net/'
        };
    }

    /**
     * Obtiene las ofertas de la página principal (Frontpage)
     */
    async getFrontpageDeals() {
        try {
            logger.info('🔍 Scrapeando Slickdeals Frontpage...');

            const response = await axios.get(`${this.baseUrl}/deals/`, {
                headers: this.headers,
                timeout: 10000
            });

            const $ = cheerio.load(response.data);
            const deals = [];

            // Selector para cada tarjeta de oferta
            $('.dealCard, .fpGridBox').each((i, elem) => {
                try {
                    const deal = this.extractDealData($, elem);
                    if (deal && this.validateDeal(deal)) {
                        deals.push(deal);
                    }
                } catch (e) {
                    logger.warn(`Error extrayendo oferta individual: ${e.message}`);
                }
            });

            logger.info(`✅ Extraídas ${deals.length} ofertas de Slickdeals`);
            return deals;

        } catch (error) {
            logger.error(`❌ Error scrapeando Slickdeals: ${error.message}`);
            return [];
        }
    }

    /**
     * Extrae datos de una tarjeta de oferta individual
     */
    extractDealData($, elem) {
        const $elem = $(elem);

        // Título limpio
        let title = $elem.find('.dealTitle, .itemTitle a').first().text().trim();
        if (!title) return null;
        title = title.replace(/\[.*?\]/g, '').replace(/slickdeals/gi, '').trim();

        // Enlace
        let link = $elem.find('a[data-href]').attr('data-href') ||
            $elem.find('.dealTitle a, .itemTitle a').attr('href');

        if (link && link.startsWith('/')) link = this.baseUrl + link;
        if (!link) return null;

        // IMAGÉN: Búsqueda multinivel (Garantía de calidad)
        const image = $elem.find('img.dealImage, img.itemImage').attr('src') ||
            $elem.find('img').first().attr('data-proxy-image') ||
            $elem.find('img').first().attr('data-src') ||
            $elem.find('img').first().attr('data-original') ||
            'https://placehold.co/600x400?text=Premium+Deal';

        // PRECIOS
        const priceText = $elem.find('.itemPrice, .dealPrice').text().trim();
        const price = this.extractPrice(priceText);

        const listPriceText = $elem.find('.oldPrice, .itemOriginalPrice, .strike').text().trim();
        let originalPrice = this.extractPrice(listPriceText);
        if (!originalPrice || originalPrice <= price) {
            const extraMatch = $elem.find('.itemPriceLine').text().match(/Reg\.\s*\$?([\d,.]+)/i);
            if (extraMatch) originalPrice = this.extractPrice(extraMatch[1]);
        }
        if (!originalPrice || originalPrice <= price) originalPrice = 0;

        // CUPÓN (Súper valor añadido)
        const coupon = $elem.find('.couponCode, .promoCode, [data-bhw="CouponCode"]').text().trim() || null;

        // Tienda y Score
        const store = $elem.find('.itemStore, .dealStore').text().trim() || 'Amazon';
        const scoreText = $elem.find('.voteCount, .itemScore, .count').first().text().trim();
        const score = parseInt(scoreText.replace(/[^\d]/g, '')) || 25; // Default 25 si es nueva

        return {
            id: this.generateId(link),
            title: title,
            link: link,
            image: image,
            price_offer: price,
            price_official: originalPrice,
            tienda: store,
            categoria: this.mapCategory(title + ' ' + store),
            score: score,
            coupon: coupon,
            description: title,
            pubDate: new Date().toISOString()
        };
    }

    /**
     * Extrae precio de un texto
     */
    extractPrice(text) {
        if (!text) return 0;
        const match = text.match(/\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/);
        return match ? parseFloat(match[1].replace(',', '')) : 0;
    }

    /**
     * Genera ID único basado en el link
     */
    generateId(link) {
        return require('crypto').createHash('md5').update(link).digest('hex').substring(0, 10);
    }

    /**
     * Limpia el título de referencias a Slickdeals
     */
    cleanTitle(title) {
        return title
            .replace(/slickdeals?/gi, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
    }

    /**
     * Mapea categorías de Slickdeals a las nuestras
     */
    mapCategory(category) {
        const map = {
            'computers': 'Tecnología',
            'electronics': 'Tecnología',
            'gaming': 'Gamer',
            'clothing': 'Moda',
            'home': 'Hogar',
            'tools': 'Tools',
            'sports': 'Deportes'
        };

        const cat = category.toLowerCase();
        for (const [key, value] of Object.entries(map)) {
            if (cat.includes(key)) return value;
        }
        return 'General';
    }

    /**
     * Valida que la oferta tenga datos mínimos
     */
    validateDeal(deal) {
        return deal.title &&
            deal.link &&
            deal.price_offer > 0 &&
            !deal.link.includes('slickdeals.net/f/'); // Evitar links internos de foros
    }
}

module.exports = new SlickdealsProScraper();
