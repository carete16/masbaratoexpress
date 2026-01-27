const logger = require('../utils/logger');

/**
 * BOT 3: EL AUDITOR DE ÉLITE
 * Evalúa la calidad de la ganga, asigna puntuaciones de confianza 
 * y badges premium basados en algoritmos de ahorro.
 */
class PriceAuditorBot {

    async audit(deal) {
        logger.info(`⚖️ Auditoría de Élite: ${deal.title.substring(0, 40)}...`);

        let report = {
            isGoodDeal: true,
            isHistoricLow: false,
            confidenceScore: 0,
            badge: null,
            reason: null,
            discount: 0,
            quality: 'Standard'
        };

        const { price_offer, price_official, title } = deal;
        const lowTitle = title.toLowerCase();

        // --- FILTRO DE EXCLUSIÓN: BLOQUEO DE SERVICIOS Y SUSCRIPCIONES ---
        const blacklist = /bank|citbank|bitdefender|antivirus|subscription|suscripción|vpn|software|hosting|nordvpn|wsj|wall street journal|disney\+|paramount|hulu|netflix|credit card|financial|insurance/i;
        if (blacklist.test(lowTitle)) {
            report.isGoodDeal = false;
            report.reason = 'Producto excluido: Servicios, Bancos o Suscripciones no permitidas.';
            return report;
        }

        // 1. LIMPIEZA DE TÍTULO PROFESIONAL
        deal.title = deal.title
            .replace(/Slickdeals/gi, '')
            .replace(/\[.*?\]/g, '')
            .replace(/\(\d+.*?\)/g, '')
            .trim();

        // 2. CÁLCULOS DE PRECISIÓN
        if (price_offer <= 0 || price_offer > 5000) {
            report.isGoodDeal = false;
            report.reason = 'Precio fuera de rango lógico para ofertas';
            return report;
        }

        const savings = (price_official > price_offer) ? price_official - price_offer : 0;
        const savingsPercent = price_official > 0 ? Math.round((savings / price_official) * 100) : 0;
        report.discount = savingsPercent;

        // 3. DEFINICIÓN DE MARCAS TOP Y DISEÑADOR (PRIORIDAD DE EL USER)
        const topBrands = /iphone|apple|nike|adidas|reebok|puma|samsung|sony|nintendo|playstation|xbox|ps5|rtx|nvidia|ryzen|intel|gafas|sunglasses|ray-ban|oakley|gucci|prada|seiko|rolex|casio|fossil|gaming|lego|stanley/i;
        const isTopBrand = topBrands.test(lowTitle);

        // 4. ALGORITMO DE FILTRADO SEGÚN REGLAS DEL USUARIO
        // Regla: Descuento > 30% generalmente, pero más flexible si es marca conocida.
        const minSavings = isTopBrand ? 20 : 30; // 20% para Apple/Nike, 30% para el resto.

        if (price_official > 0 && savingsPercent < minSavings) {
            report.isGoodDeal = false;
            report.reason = `Ahorro insuficiente. Marca TOP requiere 20%, genérica 30%. Oferta actual: ${savingsPercent}%.`;
            return report;
        }

        // Alerta especial: Si no hay MSRP (precio oficial), solo dejamos pasar Marcas Top o Tiendas Top.
        if (price_official <= 0) {
            const isTopStore = ['Amazon', 'Best Buy', 'Nike', 'Adidas', 'Walmart'].includes(deal.tienda);
            if (!isTopBrand && !isTopStore) {
                report.isGoodDeal = false;
                report.reason = 'Oferta genérica sin precio de referencia (MSRP) verificado.';
                return report;
            }
        }

        // 5. ASIGNACIÓN DE PUNTUACIÓN (Confidence Score 0-100)
        let score = 50;
        if (isTopBrand) score += 25;
        if (savingsPercent >= 50) score += 25;
        if (['Amazon', 'Best Buy', 'Nike'].includes(deal.tienda)) score += 10;

        report.confidenceScore = Math.min(score, 100);

        // 6. ASIGNACIÓN DE BADGES PREMIUM
        if (isTopBrand && savingsPercent >= 20) {
            report.badge = 'MARCA TOP ⭐';
            report.quality = 'Premium';
        } else if (savingsPercent >= 50) {
            report.badge = 'LIQUIDACIÓN CRAZY 📉';
            report.quality = 'Epic';
        } else if (savingsPercent >= 35) {
            report.badge = 'SUPER OFERTA 🔥';
            report.quality = 'Gold';
        } else {
            report.badge = 'OFERTA VERIFICADA';
        }

        // 7. CATEGORIZACIÓN SEMÁNTICA (Mantenida y refinada)
        const t = deal.title.toLowerCase();
        if (t.match(/laptop|tv|computer|monitor|ssd|drive|tech|gadget|iphone|samsung|galaxy|phone|ipad|tablet|apple watch/)) deal.categoria = 'Tecnología';
        else if (t.match(/shoe|sneaker|nike|adidas|reebok|puma|clothing|watch|gafas|sunglasses|reloj/)) deal.categoria = 'Moda';
        else if (t.match(/ps5|xbox|gaming|switch|game|nintendo|controller|rtx|gpu|cpu|monitor gaming/)) deal.categoria = 'Gamer';
        else if (t.match(/cooker|fryer|pot|kitchen|home|furniture|vacuum|stanley|lego/)) deal.categoria = 'Hogar';
        else deal.categoria = 'General';

        deal.badge = report.badge;
        deal.score = report.confidenceScore;

        logger.info(`✅ Auditoría completa: Score ${report.confidenceScore} | Discount ${savingsPercent}% | Categoría: ${deal.categoria}`);
        return report;
    }
}

module.exports = new PriceAuditorBot();
