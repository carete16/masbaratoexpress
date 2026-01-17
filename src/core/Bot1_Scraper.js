const axios = require('axios');
const RSSParser = require('rss-parser');
const parser = new RSSParser();
const logger = require('../utils/logger');

/**
 * BOT 1: EL RADAR (Referencia de Mercado)
 * Detecta oportunidades basándose en fuentes externas como Slickdeals.
 * NO copia contenido, solo identifica el producto, tienda y precio referencial.
 */
class RadarBot {
    constructor() {
        this.rssUrl = 'https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1';
    }

    async getMarketOpportunities() {
        try {
            logger.info('📡 Escaneando radar de oportunidades (Slickdeals RSS)...');
            const feed = await parser.parseURL(this.rssUrl);
            const opportunities = [];

            for (const item of feed.items) {
                try {
                    const opp = this.parseReference(item);
                    if (opp && this.validateReference(opp)) {
                        opportunities.push(opp);
                    }
                } catch (e) {
                    logger.warn(`Error en radar item: ${e.message}`);
                }
            }
            return opportunities;
        } catch (error) {
            logger.error(`❌ Error en RadarBot: ${error.message}`);
            return [];
        }
    }

    parseReference(item) {
        // Extraemos solo puntos de datos ciegos
        const rawTitle = item.title;
        let referencePrice = 0;
        let msrp = 0;

        const prices = rawTitle.match(/\$(\d+(?:\.\d{2})?)/g);
        if (prices && prices.length >= 2) {
            referencePrice = parseFloat(prices[0].replace('$', ''));
            msrp = parseFloat(prices[1].replace('$', ''));
        } else if (prices) {
            referencePrice = parseFloat(prices[0].replace('$', ''));
        }

        // Identificamos la tienda probable
        let store = 'Global';
        const tLower = rawTitle.toLowerCase();
        if (tLower.includes('amazon')) store = 'Amazon';
        else if (tLower.includes('walmart')) store = 'Walmart';
        else if (tLower.includes('ebay')) store = 'eBay';
        else if (tLower.includes('best buy')) store = 'Best Buy';

        // Intentamos obtener el ID del producto (ASIN, SKU) para la validación posterior
        let productId = null;
        let directLink = null;

        if (item.content) {
            const decodedContent = item.content.replace(/&amp;/g, '&');
            const directPatterns = [
                /https?:\/\/(?:www\.)?amazon\.com\/(?:dp|gp\/product)\/[A-Z0-9]{10}/i,
                /https?:\/\/(?:www\.)?walmart\.com\/ip\/[^"'\s<>\[\]]+\/\d+/i,
                /https?:\/\/(?:www\.)?ebay\.com\/itm\/\d+/i,
                /https?:\/\/(?:www\.)?bestbuy\.com\/site\/[^"'\s<>\[\]]+\/\d+\.p/i
            ];
            for (const pattern of directPatterns) {
                const match = decodedContent.match(pattern);
                if (match) {
                    directLink = match[0];
                    break;
                }
            }
        }

        const asinMatch = rawTitle.match(/\b(B0[A-Z0-9]{8})\b/i);
        if (asinMatch) {
            productId = asinMatch[1];
            if (!directLink) directLink = `https://www.amazon.com/dp/${productId}`;
        }

        // Link de origen solo para seguir el rastro a la tienda final
        // let sourceLink = item.link; // This line is now handled by directLink || item.link

        let image = null;
        if (item.content) {
            const imgMatch = item.content.match(/src="([^"]+)"/);
            if (imgMatch) image = imgMatch[1];
        }

        return {
            title: rawTitle.replace(/slickdeals|\[.*?\]/gi, '').trim(),
            referencePrice,
            msrp,
            store,
            productId,
            sourceLink: directLink || item.link,
            image,
            pubDate: item.pubDate
        };
    }

    validateReference(opp) {
        return opp.referencePrice > 0;
    }
}

module.exports = new RadarBot();
