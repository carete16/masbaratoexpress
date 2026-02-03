const axios = require('axios');
const RSSParser = require('rss-parser');
const parser = new RSSParser({
    customFields: {
        item: ['vendorname', 'imagelink', 'description'],
    }
});
const logger = require('../utils/logger');

/**
 * BOT 1: EL RADAR (Referencia de Mercado)
 * Detecta oportunidades basándose en múltiples fuentes RSS de USA.
 */
class RadarBot {
    constructor() {
        this.sources = [
            // FUENTES ESTABLES (TechBargains, DealNews, Hip2Save)
            { name: 'TechBargains', url: 'https://feeds.feedburner.com/Techbargains' },
            { name: 'TechBargains Adidas', url: 'https://www.techbargains.com/rss/search?q=adidas' },
            { name: 'TechBargains Nike', url: 'https://www.techbargains.com/rss/search?q=nike' },
            { name: 'TechBargains eBay', url: 'https://www.techbargains.com/rss/category/ebay' },
            { name: 'DealNews', url: 'https://www.dealnews.com/c142/z0/f/rss.html' },
            { name: 'Hip2Save', url: 'https://hip2save.com/feed/' },
            { name: 'SneakerSteal', url: 'https://sneakersteal.com/feed/' },
            { name: 'BensBargains', url: 'https://bensbargains.com/categories/all/rss/' },

            // FUENTES AGRESIVAS (Slickdeals) - Se manejan con cuidado para evitar errores en log
            { name: 'Slickdeals Frontpage', url: 'https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1' }
        ];

        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'
        ];
    }

    async getMarketOpportunities() {
        let allOpportunities = [];
        logger.info(`📡 Iniciando escaneo multi-radar (${this.sources.length} fuentes)`);

        for (const source of this.sources) {
            try {
                logger.info(`🔍 Escaneando: ${source.name}...`);

                let response;
                let errorOccurred = false;

                try {
                    response = await axios.get(source.url, {
                        headers: {
                            'User-Agent': this.userAgents[0],
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                            'Accept-Language': 'en-US,en;q=0.9',
                            'Cache-Control': 'no-cache'
                        },
                        timeout: 10000
                    });
                } catch (e) {
                    if (e.response && e.response.status === 403) {
                        // Silenciar errores 403 para no molestar al usuario según su petición
                        logger.warn(`🔇 Fuente ${source.name} temporalmente inaccesible (403). Moviendo a la siguiente.`);
                        errorOccurred = true;
                    } else {
                        logger.warn(`⚠️ Error en fuente ${source.name}: ${e.message}`);
                        errorOccurred = true;
                    }
                }

                if (errorOccurred || !response) continue;

                const feed = await parser.parseString(response.data);
                let count = 0;

                for (const item of feed.items) {
                    try {
                        const opp = await this.parseReference(item, source.name);
                        if (opp && this.validateReference(opp)) {
                            allOpportunities.push(opp);
                            count++;
                        }
                    } catch (e) { }
                }
                logger.info(`✅ ${source.name}: ${count} potenciales encontradas.`);
            } catch (error) { }
        }

        const uniqueOpps = [];
        const seen = new Set();
        for (const opp of allOpportunities) {
            const key = (opp.title || '').substring(0, 30).toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                uniqueOpps.push(opp);
            }
        }

        logger.info(`🏆 Escaneo completado. Total oportunidades únicas: ${uniqueOpps.length}`);
        return uniqueOpps;
    }

    async parseReference(item, sourceName) {
        try {
            const title = item.title || '';
            const link = item.link || item.guid || '';

            let priceOffer = 0;
            const priceMatch = title.match(/\$(\d{1,5}(?:\.\d{2})?)/);
            if (priceMatch) {
                priceOffer = parseFloat(priceMatch[1]);
            }

            let storeName = item.vendorname || 'USA Store';
            const lowTitle = title.toLowerCase();
            const lowLink = link.toLowerCase();

            if (storeName === 'Global' || storeName === 'USA Store' || storeName === 'Marketplace') {
                if (lowTitle.includes('amazon') || lowLink.includes('amazon.com')) storeName = 'Amazon';
                else if (lowTitle.includes('walmart') || lowLink.includes('walmart.com')) storeName = 'Walmart';
                else if (lowTitle.includes('ebay') || lowLink.includes('ebay.com')) storeName = 'eBay';
                else if (lowTitle.includes('target') || lowLink.includes('target.com')) storeName = 'Target';
                else if (lowTitle.includes('best buy') || lowTitle.includes('bestbuy')) storeName = 'Best Buy';
                else if (lowTitle.includes('nike')) storeName = 'Nike';
                else if (lowTitle.includes('adidas')) storeName = 'Adidas';
            }

            // --- BLOQUEO PROACTIVO DE TIENDAS DE SERVICIOS (Evitar spam) ---
            const storeBlacklist = ['NordVPN', 'Disney+', 'IPVanish', 'AT&T', 'WSJ', 'CIT Bank', 'Bitdefender', 'Surfshark', 'McAfee', 'Norton'];
            if (storeBlacklist.some(s => storeName.includes(s) || lowTitle.includes(s.toLowerCase()))) {
                return null;
            }

            let imageUrl = item.imagelink || '';
            if (!imageUrl && (item.content || item.description)) {
                const content = item.content || item.description;
                const imgMatch = content.match(/src="([^"]+\.(?:jpg|png|jpeg|webp)[^"]*)"/i);
                if (imgMatch) imageUrl = imgMatch[1];
            }

            let category = 'General';

            // --- CATEGORIZACIÓN EXPRESS (Alta Prioridad) ---
            if (lowTitle.match(/watch|seiko|casio|citizen|tissot|garmin|reloj/)) category = 'Relojes';
            else if (lowTitle.match(/rtx|gtx|radeon|rx \d000|graphics card|gpu|motherboard|z790|b650|am5|lga1700|processor|ryzen|intel core|ddr5|ddr4|ram kit|samsung 990|wd black sn850/)) category = 'PC Components';
            else if (lowTitle.match(/jordan|dunk|yeezy|air max|ultraboost|new balance|asics|on cloud|sneaker|retro high|og/)) category = 'Sneakers';

            // --- CATEGORIZACIÓN ESTÁNDAR ---
            else if (lowTitle.match(/laptop|desktop|monitor|ssd|ram|cpu|keyboard|mouse|headphone|earbud|tablet|phone|iphone|apple|ipad|macbook/)) category = 'Tecnología';
            else if (lowTitle.match(/ps5|xbox|nintendo|switch|game|steam|controller|console/)) category = 'Gamer';
            else if (lowTitle.match(/shoe|shirt|pant|dress|bag|hoodie|jacket|clothing|apparel|under armour|adidas|nike|puma/)) category = 'Moda';
            else if (lowTitle.match(/vacuum|cooker|fryer|coffee|bed|furniture|kitchen/)) category = 'Hogar';
            else if (lowTitle.match(/supplement|protein|vitamin|gym|exercise|teeth/)) category = 'Salud';

            const cleanTitle = title.replace(/\s*\$\d+\.?\d*\s*$/, '').trim();

            return {
                title: cleanTitle,
                sourceLink: link,
                referencePrice: priceOffer,
                msrp: 0,
                tienda: storeName,
                categoria: category,
                image: imageUrl,
                description: item.contentSnippet || item.content || item.description || '',
                pubDate: item.pubDate,
                source: sourceName
            };
        } catch (error) {
            return null;
        }
    }

    validateReference(opp) {
        return opp.title && opp.sourceLink;
    }
}

module.exports = new RadarBot();
