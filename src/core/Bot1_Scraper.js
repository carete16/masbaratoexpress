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

        // Precios: Extracción de ALTA PRECISIÓN (Triple Captura)
        let price_offer = 0;
        let price_official = 0;

        // Patrón A: "$18 $75" (Muy común en Slickdeals)
        const patternA = title.match(/\$(\d+(?:\.\d{2})?)\s+\$(\d+(?:\.\d{2})?)/);
        // Patrón B: "$18 (Reg. $75)" o "$18 Was $75"
        const patternB = title.match(/\$(\d+(?:\.\d{2})?).*?(?:Reg\.|Was|MSRP|List|List Price)\s*\$(\d+(?:\.\d{2})?)/i) ||
            title.match(/(?:Reg\.|Was|MSRP|List)\s*\$(\d+(?:\.\d{2})?).*?\$(\d+(?:\.\d{2})?)/i);

        if (patternA) {
            price_offer = parseFloat(patternA[1]);
            price_official = parseFloat(patternA[2]);
        } else if (patternB) {
            price_offer = parseFloat(patternB[1]);
            price_official = parseFloat(patternB[2]);
        } else {
            // Último recurso: solo capturar el primer precio y buscar el segundo en el texto
            const allPrices = title.match(/\$(\d+(?:\.\d{2})?)/g);
            if (allPrices && allPrices.length >= 2) {
                price_offer = parseFloat(allPrices[0].replace('$', ''));
                price_official = parseFloat(allPrices[1].replace('$', ''));
            } else if (allPrices) {
                price_offer = parseFloat(allPrices[0].replace('$', ''));
            }
        }

        // 🚨 FILTRO DE CALIDAD: Si no hay comparación, no hay clonación al 100%
        if (price_official === 0 || price_official <= price_offer) {
            // Intentar buscar en el content del RSS si el título falló
            if (item.content) {
                const contentMatch = item.content.match(/(?:Was|Reg\.)\s*\$(\d+(?:\.\d{2})?)/i);
                if (contentMatch) price_official = parseFloat(contentMatch[1]);
            }
        }

        // Si después de todo no hay precio comparativo, marcar para revisión o descartar
        // Ahora permitimos que price_official sea 0 para que Bot2 lo enriquezca.

        // Inversión de seguridad si existen ambos
        if (price_official > 0 && price_offer > 0 && price_official < price_offer) {
            [price_offer, price_official] = [price_official, price_offer];
        }

        // Tienda (Base - Reconocimiento ampliado)
        let tienda = 'Oferta USA';
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

        // LIMPIEZA EXTREMA DEL TÍTULO (Para paridad con Slickdeals)
        let cleanTitle = title
            .replace(/slickdeals/gi, '') // Quitar marca
            .replace(/\[.*?\]/g, '') // Quitar corchetes
            .replace(/\$(\d+(?:\.\d{2})?)/g, '') // Quitar cualquier precio $99.99
            .replace(/(?:Reg\.|Was|MSRP|List|List Price)\s*:\s*\$\d+(?:\.\d{2})?/gi, '') // Quitar MSRP del texto
            .replace(/\s+\+/g, '') // Quitar signos + sueltos
            .replace(/Free Shipping/gi, '') // Quitar envío gratis del título (redundante)
            .replace(/Prime Members/gi, '') // Quitar menciones a membresías
            .replace(/Kindle eBook/gi, '')
            .replace(/\s\s+/g, ' ') // Quitar espacios dobles
            .trim();

        // Si el título quedó vacío por error, usar el original sin marcas
        if (!cleanTitle || cleanTitle.length < 5) cleanTitle = title.replace(/slickdeals/gi, '').trim();

        return {
            id: require('crypto').createHash('md5').update(link).digest('hex').substring(0, 10),
            title: cleanTitle,
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
