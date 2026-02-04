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

        // 3. DEFINICIÓN DE MARCAS TOP Y DISEÑADOR (ESTÁNDAR MASBARATO)
        const topBrands = /iphone|apple|macbook|ipad|airpods|samsung|galaxy|nike|adidas|reebok|puma|jordan|asics|new balance|seiko|rolex|casio|fossil|tissot|omega|citizen|invicta|sony|nintendo|playstation|xbox|ps5|rtx|nvidia|dyson|stanley|lego|ray-ban|oakley/i;
        const isTopBrand = topBrands.test(lowTitle);

        // 4. ALGORITMO DE FILTRADO (REGLAS ESTRICTAS DEL USUARIO)
        // Regla de Oro: Descuento > 30% obligatorio para recomendaciones automáticas.
        const minSavings = 30;

        if (price_official > 0 && savingsPercent < minSavings) {
            report.isGoodDeal = false;
            report.reason = `Ahorro insuficiente. El Usuario exige ≥30%. Oferta actual: ${savingsPercent}%.`;
            return report;
        }

        // --- SISTEMA DE APRENDIZAJE IA (RECOMENDACIÓN PERSONALIZADA) ---
        // La IA analiza qué ha publicado el jefe manualmente para recomendar cosas similares.
        let favoriteBrands = ['iphone', 'apple', 'nike', 'adidas', 'samsung', 'casio', 'seiko']; // Defaults
        try {
            const { db } = require('../database/db');
            const manuals = db.prepare("SELECT title FROM published_deals WHERE posted_at > datetime('now', '-7 days') LIMIT 20").all();
            manuals.forEach(m => {
                const words = m.title.toLowerCase().split(/[ \-,|]/); // Split por varios separadores
                words.forEach(w => { if (w.length > 4 && !favoriteBrands.includes(w)) favoriteBrands.push(w); });
            });
        } catch (e) { }

        const isFavorite = favoriteBrands.some(b => lowTitle.includes(b));
        const isStarCategory = lowTitle.match(/watch|reloj|sneaker|tenis|shoe|zapato|phone|celular|laptop|computador/i);

        if (!deal.isManual && !isFavorite && !isStarCategory) {
            report.isGoodDeal = false;
            report.reason = 'No coincide con tus marcas favoritas detectadas ni categorías estrella.';
            return report;
        }

        // Alerta especial: Si no hay MSRP (precio oficial), solo dejamos pasar Marcas Top con muy buena reputación.
        if (price_official <= 0) {
            if (!isTopBrand) {
                report.isGoodDeal = false;
                report.reason = 'Oferta genérica sin precio de comparación oficial.';
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
        if (isTopBrand && savingsPercent >= 10) {
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

        // 7. CATEGORIZACIÓN SEMÁNTICA PREMIUM
        const t = deal.title.toLowerCase();
        if (t.match(/laptop|tv|computer|monitor|ssd|drive|tech|gadget|iphone|samsung|galaxy|phone|ipad|tablet|apple watch|ps5|xbox|gaming|switch|game|nintendo|controller|rtx|gpu|cpu|monitor gaming/)) {
            deal.categoria = 'Electrónica Premium';
        } else if (t.match(/shoe|sneaker|nike|adidas|reebok|puma|clothing|ropa|shirt|jeans|hoodie|backpack/)) {
            deal.categoria = 'Lifestyle & Street';
        } else if (t.match(/watch|reloj|smartwatch|wearable|gafas|sunglasses|ray-ban|oakley/)) {
            deal.categoria = 'Relojes & Wearables';
        } else if (t.match(/cooker|fryer|pot|kitchen|home|furniture|vacuum|stanley|lego/)) {
            deal.categoria = 'Electrónica Premium'; // O crear categoría Hogar si el usuario lo pide, por ahora lo dejamos en la más cercana o general
        } else {
            deal.categoria = 'Lifestyle & Street';
        }

        deal.badge = report.badge;
        deal.score = report.confidenceScore;

        logger.info(`✅ Auditoría completa: Score ${report.confidenceScore} | Discount ${savingsPercent}% | Categoría: ${deal.categoria}`);
        return report;
    }
}

module.exports = new PriceAuditorBot();
