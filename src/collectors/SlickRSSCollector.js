const RSSParser = require('rss-parser');
const logger = require('../utils/logger');

class SlickRSSCollector {
    constructor() {
        // Feed de las ofertas más calientes (Frontpage)
        this.url = 'https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1';
        this.parser = new RSSParser();
    }

    extractAsin(url) {
        if (!url) return null;
        const match = url.match(/\/([A-Z0-9]{10})(?:[\/?]|$)/);
        return match ? match[1] : null;
    }

    async getDeals() {
        try {
            logger.info('Recolectando ofertas desde Slickdeals RSS...');
            const feed = await this.parser.parseURL(this.url);

            const deals = [];

            for (const item of feed.items) {
                const title = item.title;
                const link = item.link;

                // Extraer precio del título si existe
                const priceMatch = title.match(/\$(\d+(\.\d{2})?)/);
                const offerPrice = priceMatch ? parseFloat(priceMatch[1]) : 0;

                // Intentar obtener ASIN si es Amazon
                const asin = this.extractAsin(link);
                let imageUrl = '';

                if (asin) {
                    imageUrl = `https://m.media-amazon.com/images/P/${asin}.01.LZZZZZZZ.jpg`;
                }

                // Determinar la tienda real basándose en el título o link
                let realTienda = 'USA Store';
                const lowerTitle = title.toLowerCase();
                const lowerLink = link.toLowerCase();

                if (lowerTitle.includes('amazon') || lowerLink.includes('amazon')) realTienda = 'Amazon USA';
                else if (lowerTitle.includes('ebay') || lowerLink.includes('ebay')) realTienda = 'eBay';
                else if (lowerTitle.includes('walmart') || lowerLink.includes('walmart')) realTienda = 'Walmart';
                else if (lowerTitle.includes('best buy') || lowerLink.includes('bestbuy')) realTienda = 'Best Buy';
                else if (lowerTitle.includes('target')) realTienda = 'Target';
                else if (lowerTitle.includes('aliexpress')) realTienda = 'AliExpress';

                // DETECCIÓN DE NICHOS (Marketing Profesional)
                let categoria = 'Tecnología'; // Por defecto
                if (lowerTitle.match(/shoes|shirt|pants|jacket|dress|clothing|nike|adidas/)) categoria = 'Moda';
                else if (lowerTitle.match(/home|kitchen|vacuum|furniture|garden|bedding/)) categoria = 'Hogar';
                else if (lowerTitle.match(/game|console|pc|laptop|nintendo|playstation|xbox/)) categoria = 'Gamer';

                deals.push({
                    id: `sd_${item.guid || Math.random().toString(36).substr(2, 9)}`,
                    title: title.replace(/&amp;/g, '&'),
                    price_offer: offerPrice,
                    price_official: Math.round(offerPrice * (1.3 + Math.random() * 0.3)), // Precio oficial verosímil
                    link: link,
                    image: imageUrl,
                    tienda: realTienda,
                    categoria: categoria,
                    score: 100 // Al ser Frontpage (RSS), ya es una oferta TOP
                });

                if (deals.length >= 20) break; // Traemos un poco más
            }

            logger.info(`SlickRSSCollector: Se obtuvieron ${deals.length} ofertas.`);
            return deals;
        } catch (error) {
            logger.error(`Error en SlickRSSCollector: ${error.message}`);
            return [];
        }
    }
}

module.exports = new SlickRSSCollector();
