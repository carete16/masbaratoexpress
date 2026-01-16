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

            // Aumentamos a 30 para tener más variedad de marcas top
            const itemsToProcess = feed.items.slice(0, 30);

            for (const item of itemsToProcess) {
                let title = item.title;
                let link = item.link;

                // --- 1. FILTRO DE MARCAS VIP (Prioridad Absoluta) ---
                const vipBrands = ['Apple', 'Samsung', 'Sony', 'Nike', 'Adidas', 'Dyson', 'Lego', 'Nintendo', 'PlayStation', 'Xbox', 'Google', 'DeWalt', 'Milwaukee', 'Bose'];
                const lowerTitle = title.toLowerCase();

                let isVip = false;
                let brandFound = '';

                for (const brand of vipBrands) {
                    if (lowerTitle.includes(brand.toLowerCase())) {
                        isVip = true;
                        brandFound = brand;
                        break;
                    }
                }

                // Si no es VIP y tampoco es "Frontpage", a veces es mejor ignorar relleno, 
                // pero si es Frontpage (este feed lo es), lo procesamos igual.

                // RESOLVER LINK REAL
                try {
                    // logger.info(`Resolviendo link para: ${title.substring(0, 30)}...`); 
                    // Reducimos log para no saturar consola en producción
                    link = await LinkResolver.resolve(link);
                } catch (e) { }

                // Extraer precio
                const priceMatch = title.match(/\$(\d+(\.\d{2})?)/);
                const offerPrice = priceMatch ? parseFloat(priceMatch[1]) : 0;

                let originalPrice = 0;
                const wasMatch = title.match(/(?:was|list|regular|usually|retail|reg\.)\s*\$(\d+(\.\d{2})?)/i) ||
                    item.content?.match(/(?:was|list|regular|usually|retail|reg\.)\s*\$(\d+(\.\d{2})?)/i);

                if (wasMatch) originalPrice = parseFloat(wasMatch[1]);
                else if (offerPrice > 0) {
                    const offMatch = title.match(/\$(\d+(\.\d{2})?)\s*off/i);
                    if (offMatch) originalPrice = offerPrice + parseFloat(offMatch[1]);
                }

                if (originalPrice === 0 && offerPrice > 0) originalPrice = parseFloat((offerPrice * 1.3).toFixed(2)); // 30% estimado descuento si no hay data

                const isAllTimeLow = /lowest|all[\s-]time[\s-]low|best[\s-]price|historic/i.test(title);

                const asin = this.extractAsin(link);
                let imageUrl = '';
                if (asin) imageUrl = `https://m.media-amazon.com/images/P/${asin}.01.LZZZZZZZ.jpg`;

                // Tienda
                let realTienda = 'USA Store';
                const lowerLink = link.toLowerCase();
                if (lowerLink.includes('amazon')) realTienda = 'Amazon';
                else if (lowerLink.includes('ebay')) realTienda = 'eBay';
                else if (lowerLink.includes('walmart')) realTienda = 'Walmart';
                else if (lowerLink.includes('bestbuy')) realTienda = 'Best Buy';
                else if (lowerLink.includes('target')) realTienda = 'Target';
                else if (lowerLink.includes('homedepot')) realTienda = 'Home Depot';
                else if (lowerLink.includes('nike')) { realTienda = 'Nike.com'; isVip = true; } // Nike directo es VIP

                // Categoría Inteligente
                let categoria = 'Otros';
                if (lowerTitle.match(/shoes|shirt|pants|jacket|dress|clothing|apparel|sneaker|boots/)) categoria = 'Moda';
                else if (lowerTitle.match(/laptop|monitor|ssd|drive|mouse|keyboard|wifi|ipad|tablet|phone/)) categoria = 'Tecnología';
                else if (lowerTitle.match(/game|console|nintendo|ps5|xbox|controller|steam/)) categoria = 'Gamer';
                else if (lowerTitle.match(/tool|drill|wrench|saw|screwdriver/)) categoria = 'Herramientas';
                else if (lowerTitle.match(/kitchen|cook|vacuum|blender|fryer|pot|pan|towel|soap/)) categoria = 'Hogar';

                // --- 2. PREPARAR TÍTULO DE IMPACTO ---
                // Limpiar basura de Slickdeals del título (ej. "free shipping", "FS")
                let cleanTitle = title.replace(/free\s*shipping|fs|AC|ac|after\s*coupon/gi, '').trim();
                cleanTitle = cleanTitle.replace(/\s+-\s+$/, ''); // Quitar guión final

                // Si es VIP, le ponemos la marca al principio para que venda más
                // --- 3. CAZADOR DE CUPONES (COUPON HUNTER) 🎟️ ---
                let couponCode = null;
                // Combinamos contenido para buscar
                const fullText = (item.content || '') + ' ' + (item.contentSnippet || '') + ' ' + title;

                // Patrones comunes: "code ABC", "coupon ABC", "clip coupon", "apply code"
                // Regex busca palabras clave seguidas de un código alfanumérico (mayúsculas y números, 5-15 caracteres)
                const couponMatch = fullText.match(/(?:code|coupon|promo)\s*:?\s*([A-Z0-9]{5,15})/i);

                if (couponMatch) {
                    couponCode = couponMatch[1].toUpperCase();
                    // Evitar falsos positivos comunes
                    if (['AMAZON', 'SLICK', 'DEALS', 'PRIME', 'COUPON', 'SHIPPING'].includes(couponCode)) couponCode = null;
                }

                // Score final
                let score = 100;
                if (isVip) score += 200; // Prioridad total a marcas conocidas
                if (isAllTimeLow) score += 50;
                if (couponCode) score += 50; // ¡Los cupones suben el interés!
                if (offerPrice > 0 && offerPrice < 20) score += 50;

                deals.push({
                    id: `sd_${item.guid || Math.random().toString(36).substr(2, 9)}`,
                    title: cleanTitle,
                    price_offer: offerPrice,
                    price_official: originalPrice,
                    link: link,
                    image: imageUrl,
                    tienda: realTienda,
                    categoria: categoria,
                    coupon: couponCode, // Nuevo campo
                    score: score,
                    is_historic_low: isAllTimeLow
                });
            }

            logger.info(`SlickRSSCollector: ${deals.length} ofertas procesadas (VIPs priorizados).`);
            return deals;
        } catch (error) {
            logger.error(`Error en SlickRSSCollector: ${error.message}`);
            return [];
        }
    }
}

module.exports = new SlickRSSCollector();
