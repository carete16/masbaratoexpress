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

        // Título
        let title = $elem.find('.dealTitle, .itemTitle a').first().text().trim();
        if (!title) return null;

        // Limpiar título de Slickdeals y tags
        title = title.replace(/\[.*?\]/g, '').trim();

        // Link
        let link = $elem.find('a[data-href]').attr('data-href') ||
            $elem.find('.dealTitle a, .itemTitle a').attr('href');

        if (link && link.startsWith('/')) {
            link = this.baseUrl + link;
        }

        if (!link) return null;

        // Imagen (Búsqueda agresiva de alta resolución)
        const image = $elem.find('img.dealImage, img.itemImage').attr('src') ||
            $elem.find('img').first().attr('data-src') ||
            $elem.find('img').first().attr('data-original') ||
            $elem.find('img').first().attr('src');

        // PRECIOS: Lógica Profesional
        const priceText = $elem.find('.itemPrice, .dealPrice').text().trim();
        const price = this.extractPrice(priceText);

        // Precio original (tachado en Slickdeals)
        const listPriceText = $elem.find('.oldPrice, .itemOriginalPrice, .strike').text().trim();
        let originalPrice = this.extractPrice(listPriceText);

        // Si no hay precio original, intentar buscarlo en subtítulos o descriptores
        if (!originalPrice || originalPrice <= price) {
            const descPriceMatch = $elem.find('.itemPriceLine').text().match(/Reg\.\s*\$?([\d,.]+)/i);
            if (descPriceMatch) originalPrice = this.extractPrice(descPriceMatch[1]);
        }

        // Si sigue sin haber, NO inventar el 17%. Poner 0 y el sistema ya calculará que no hay descuento visible.
        if (!originalPrice || originalPrice <= price) originalPrice = 0;

        // Tienda
        const store = $elem.find('.itemStore, .dealStore').text().trim() || 'Amazon';

        // Score/Votos
        const scoreText = $elem.find('.voteCount, .itemScore').text().trim();
        const score = parseInt(scoreText.replace(/[^\d]/g, '')) || 0;

        return {
            id: this.generateId(link),
            title: this.cleanTitle(title),
            link: link,
            image: image,
            price_offer: price,
            price_official: originalPrice,
            tienda: store,
            categoria: this.mapCategory(title + ' ' + store),
            score: score,
            coupon: null,
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
