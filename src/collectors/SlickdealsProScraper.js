const axios = require('axios');
const RSSParser = require('rss-parser');
const parser = new RSSParser();
const logger = require('../utils/logger');

/**
 * SCRAPER HÍBRIDO PRO (RSS + ENRIQUECIMIENTO)
 * Garantiza el flujo de ofertas sin bloqueos de HTML.
 */
class SlickdealsProScraper {
    constructor() {
        this.rssUrl = 'https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1';
    }

    async getFrontpageDeals() {
        try {
            logger.info('📡 Extrayendo ofertas vía Slickdeals RSS (Modo Seguro)...');

            const feed = await parser.parseURL(this.rssUrl);
            const deals = [];

            for (const item of feed.items) {
                try {
                    const deal = this.parseRSSItem(item);
                    if (deal && this.validateDeal(deal)) {
                        deals.push(deal);
                    }
                } catch (e) {
                    logger.warn(`Error parseando item RSS: ${e.message}`);
                }
            }

            logger.info(`✅ RSS: Extraídas ${deals.length} ofertas`);
            return deals;

        } catch (error) {
            logger.error(`❌ Error en RSS de Slickdeals: ${error.message}`);
            return [];
        }
    }

    parseRSSItem(item) {
        // Título limpio
        let title = item.title.replace(/\[.*?\]/g, '').trim();

        // El link de Slickdeals a veces viene codificado o es directo
        let link = item.link;

        // Imagen: Slickdeals RSS suele poner la imagen en el contenido
        let image = 'https://placehold.co/600x400?text=Premium+Deal';
        if (item.content) {
            const imgMatch = item.content.match(/src="([^"]+)"/);
            if (imgMatch) image = imgMatch[1];
        }

        // Precios: Intentar extraer del título si no están en campos extra
        // Formato común: "Product Name $99 (Reg $150)"
        let price_offer = 0;
        let price_official = 0;

        const priceMatch = title.match(/\$(\d+(?:\.\d{2})?)/);
        if (priceMatch) price_offer = parseFloat(priceMatch[1]);

        const regMatch = title.match(/(?:Reg\.|Was|MSRP|List|List Price)\s*\$(\d+(?:\.\d{2})?)/i) ||
            title.match(/\$(\d+(?:\.\d{2})?)\s*(?:Reg\.|Was|MSRP|List)/i);

        if (regMatch) price_official = parseFloat(regMatch[1]);

        // Tienda (Base - Reconocimiento ampliado)
        let tienda = 'Analizando...';
        const tLower = title.toLowerCase();
        const storeMap = {
            'walmart': 'Walmart', 'ebay': 'eBay', 'best buy': 'Best Buy', 'amazon': 'Amazon',
            'target': 'Target', 'nike': 'Nike', 'adidas': 'Adidas', 'apple': 'Apple',
            'dell': 'Dell', 'hp ': 'HP', 'samsung': 'Samsung', 'lenovo': 'Lenovo',
            'homedepot': 'Home Depot', 'lowe': 'Lowes', 'costco': 'Costco', 'kohls': 'Kohls',
            'macy': 'Macys', 'nordstrom': 'Nordstrom', 'newegg': 'Newegg', 'gamestop': 'GameStop'
        };

        for (const [key, value] of Object.entries(storeMap)) {
            if (tLower.includes(key)) {
                tienda = value;
                break;
            }
        }

        return {
            id: require('crypto').createHash('md5').update(link).digest('hex').substring(0, 10),
            title: title.replace(/slickdeals/gi, '').trim(),
            link: link,
            image: image,
            price_offer: price_offer,
            price_official: price_official,
            tienda: tienda,
            categoria: 'Tecnología', // Default, el Core lo mejorará
            score: 50, // Frontpage deals siempre son buenos
            coupon: null,
            description: title,
            pubDate: item.pubDate || new Date().toISOString()
        };
    }

    validateDeal(deal) {
        return deal.title && deal.link && deal.price_offer > 0;
    }
}

module.exports = new SlickdealsProScraper();
