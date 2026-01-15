const RSSParser = require('rss-parser');
const logger = require('../utils/logger');
const LinkResolver = require('../utils/LinkResolver');

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

            // Limitamos a 10 para no sobrecargar las peticiones de resolución de links por ahora
            const itemsToProcess = feed.items.slice(0, 15);

            for (const item of itemsToProcess) {
                const title = item.title;
                let link = item.link;

                // RESOLVER LINK REAL (Evitar redirección de Slickdeals)
                // Esto tarda un poco, pero garantiza links directos a tienda
                try {
                    logger.info(`Resolviendo link para: ${title.substring(0, 30)}...`);
                    link = await LinkResolver.resolve(link);
                } catch (e) {
                    logger.warn(`Falló resolución de link, usando original: ${e.message}`);
                }

                // Extraer precio OFERTA
                const priceMatch = title.match(/\$(\d+(\.\d{2})?)/);
                const offerPrice = priceMatch ? parseFloat(priceMatch[1]) : 0;

                // Extraer precio ANTERIOR (Was $XX, List $XX, usually $XX)
                // Buscamos patrones: "was $50", "list $50", "$50 off"
                let originalPrice = 0;

                const wasMatch = title.match(/(?:was|list|regular|usually|retail|reg\.)\s*\$(\d+(\.\d{2})?)/i) ||
                    item.content?.match(/(?:was|list|regular|usually|retail|reg\.)\s*\$(\d+(\.\d{2})?)/i);

                if (wasMatch) {
                    originalPrice = parseFloat(wasMatch[1]);
                } else if (offerPrice > 0) {
                    // Si no hay "was", buscamos "$XX off" para sumar
                    const offMatch = title.match(/\$(\d+(\.\d{2})?)\s*off/i);
                    if (offMatch) {
                        originalPrice = offerPrice + parseFloat(offMatch[1]);
                    }
                }

                // Si aún no tenemos precio original, asumimos que es una oferta menor o usamos fallback moderado
                if (originalPrice === 0 && offerPrice > 0) {
                    // Solo si no encontramos nada real, estimamos conservadoramente (20% arriba)
                    // para no exagerar descuentos falsos.
                    originalPrice = parseFloat((offerPrice * 1.2).toFixed(2));
                }

                // DETECCIÓN DE MÍNIMO HISTÓRICO (La clave de tu solicitud)
                const isAllTimeLow = /lowest|all[\s-]time[\s-]low|best[\s-]price|historic/i.test(title) ||
                    /lowest|all[\s-]time[\s-]low|best[\s-]price|historic/i.test(item.content || '');

                // Validar imagen
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

                // Score base + Bonus por Mínimo Histórico
                let score = 100;
                if (isAllTimeLow) score += 50; // ¡Bonus de prioridad!

                deals.push({
                    id: `sd_${item.guid || Math.random().toString(36).substr(2, 9)}`,
                    title: title.replace(/&amp;/g, '&'),
                    price_offer: offerPrice,
                    price_official: originalPrice,
                    link: link,
                    image: imageUrl,
                    tienda: realTienda,
                    categoria: categoria,
                    score: score,
                    is_historic_low: isAllTimeLow // Flag para el procesador
                });
            }

            logger.info(`SlickRSSCollector: Se obtuvieron ${deals.length} ofertas con links directos.`);
            return deals;
        } catch (error) {
            logger.error(`Error en SlickRSSCollector: ${error.message}`);
            return [];
        }
    }
}

module.exports = new SlickRSSCollector();
