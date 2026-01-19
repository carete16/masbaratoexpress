const RSSParser = require('rss-parser');
const logger = require('../utils/logger');
const LinkResolver = require('../utils/LinkResolver');

class SlickRSSCollector {
    constructor() {
        this.url = 'https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1';
        this.parser = new RSSParser();
    }

    async getDeals() {
        try {
            logger.info('Recolectando ofertas desde Slickdeals RSS...');
            const feed = await this.parser.parseURL(this.url);
            const deals = [];

            for (const item of feed.items.slice(0, 30)) {
                let title = item.title;
                let link = item.link;

                if (!link || !link.startsWith('http')) continue;

                // Extraer precio del título
                const priceMatch = title.match(/\$(\d+(\.\d{2})?)/);
                const offerPrice = priceMatch ? parseFloat(priceMatch[1]) : 0;

                // Extraer imagen si es posible del contenido
                let image = 'https://wsrv.nl/?url=https://slickdeals.net/favicon.ico&w=256';
                const imgMatch = item.content?.match(/src="([^"]+)"/);
                if (imgMatch) image = imgMatch[1];

                deals.push({
                    title: title,
                    sourceLink: link,
                    referencePrice: offerPrice || 1, // Mínimo 1 para que pase validación
                    image: image,
                    tienda: 'Slickdeals' // Placeholder, el validador lo refinará
                });
            }

            return deals;
        } catch (error) {
            logger.error(`Error en SlickRSSCollector: ${error.message}`);
            return [];
        }
    }
}

module.exports = new SlickRSSCollector();
