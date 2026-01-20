const axios = require('axios');
const RSSParser = require('rss-parser');
const parser = new RSSParser({
    customFields: {
        item: ['vendorname', 'imagelink'],
    }
});
const logger = require('../utils/logger');

/**
 * BOT 1: EL RADAR (Referencia de Mercado)
 * Detecta oportunidades basándose en TechBargains RSS.
 */
class RadarBot {
    constructor() {
        this.sources = [
            { name: 'TechBargains', url: 'https://feeds.feedburner.com/Techbargains' },
            { name: 'Slickdeals Hot', url: 'https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1' },
            { name: 'DealNews', url: 'https://www.dealnews.com/c142/c234/-/f/rss.html' }
        ];
    }

    async getMarketOpportunities() {
        let allOpportunities = [];
        logger.info(`📡 Iniciando escaneo multi-radar (${this.sources.length} fuentes)`);

        for (const source of this.sources) {
            try {
                logger.info(`🔍 Escaneando: ${source.name}...`);
                const response = await axios.get(source.url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    },
                    timeout: 10000
                });

                const feed = await parser.parseString(response.data);
                let count = 0;

                for (const item of feed.items) {
                    try {
                        const opp = await this.parseReference(item, source.name);
                        if (opp && this.validateReference(opp)) {
                            allOpportunities.push(opp);
                            count++;
                        }
                    } catch (e) {
                        logger.warn(`Error en item de ${source.name}: ${e.message}`);
                    }
                }
                logger.info(`✅ ${source.name}: ${count} potenciales encontradas.`);
            } catch (error) {
                logger.error(`❌ Error en fuente ${source.name}: ${error.message}`);
            }
        }

        // Eliminar duplicados básicos por título (primeras 30 letras)
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

            // 1. Extraer Precio (TechBargains suele tenerlo al final)
            let priceOffer = 0;
            const priceMatch = title.match(/\$(\d+\.?\d*)/);
            if (priceMatch) {
                priceOffer = parseFloat(priceMatch[1]);
            }

            // 2. Extraer Tienda
            let storeName = item.vendorname || 'USA Store';
            if (storeName === 'Global') {
                const lowTitle = title.toLowerCase();
                if (lowTitle.includes('amazon')) storeName = 'Amazon';
                else if (lowTitle.includes('walmart')) storeName = 'Walmart';
                else if (lowTitle.includes('ebay')) storeName = 'eBay';
                else if (lowTitle.includes('target')) storeName = 'Target';
                else if (lowTitle.includes('best buy')) storeName = 'Best Buy';
            }

            // 3. Extraer Imagen
            let imageUrl = item.imagelink || '';
            if (!imageUrl && item.content) {
                const imgMatch = item.content.match(/src="([^"]+\.(?:jpg|png|jpeg|webp)[^"]*)"/i);
                if (imgMatch) imageUrl = imgMatch[1];
            }

            // 4. Categorización
            let category = 'General';
            const lowTitle = title.toLowerCase();
            if (lowTitle.match(/laptop|desktop|monitor|ssd|ram|cpu|gpu|keyboard|mouse|headphone|earbud|tablet|phone/)) category = 'Tecnología';
            else if (lowTitle.match(/ps5|xbox|nintendo|switch|game|steam|controller|rtx|gaming/)) category = 'Gamer';
            else if (lowTitle.match(/shoe|shirt|pant|watch|dress|bag|nike|adidas/)) category = 'Moda';
            else if (lowTitle.match(/vacuum|cooker|fryer|coffee|bed|furniture|kitchen/)) category = 'Hogar';

            const cleanTitle = title.replace(/\s*\$\d+\.?\d*\s*$/, '').trim();

            return {
                title: cleanTitle,
                sourceLink: link,
                referencePrice: priceOffer,
                msrp: 0,
                tienda: storeName,
                categoria: category,
                image: imageUrl,
                description: item.contentSnippet || item.content || '',
                pubDate: item.pubDate,
                source: sourceName
            };
        } catch (error) {
            logger.error(`Error parseando item de ${sourceName}: ${error.message}`);
            return null;
        }
    }

    validateReference(opp) {
        return opp.title && opp.sourceLink && opp.referencePrice > 0;
    }
}

module.exports = new RadarBot();
