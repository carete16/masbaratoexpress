const LinkTransformer = require('./src/utils/LinkTransformer');
const Validator = require('./src/core/Bot2_Explorer');
const AI = require('./src/core/AIProcessor');
const Publisher = require('./src/core/Bot4_Publisher');
const logger = require('./src/utils/logger');
const crypto = require('crypto');

/**
 * GENERADOR DE OFERTAS MANUAL "QUIRÚRGICO"
 * Limpia links, inyecta afiliados y publica en segundos.
 */

async function createManualPost(inputUrl, manualPrice = null) {
    logger.info(`🚀 Procesando oferta manual: ${inputUrl}`);

    try {
        // 1. LIMPIEZA Y MONETIZACIÓN AUTOMÁTICA
        const cleanLink = await LinkTransformer.transform(inputUrl);
        logger.info(`✅ Link Monetizado: ${cleanLink}`);

        // 2. EXTRACCIÓN DE DATOS REALES
        const mockOpp = {
            sourceLink: cleanLink,
            title: 'Oferta Especial',
            referencePrice: manualPrice || 0,
            store: 'Global'
        };

        const validation = await Validator.validate(mockOpp);

        // Generamos un ID estable basado en el link para evitar duplicados
        const dealId = crypto.createHash('md5').update(cleanLink).digest('hex').substring(0, 10);

        const price = manualPrice || validation.realPrice || 0;
        const dealData = {
            id: dealId,
            title: validation.title || "Super Oferta USA",
            price_offer: price,
            price_official: price > 0 ? (price * 1.3).toFixed(2) : 0,
            image: validation.image || 'https://www.techbargains.com/Content/static/tb-logo.png',
            tienda: validation.storeName || 'Tienda USA',
            link: cleanLink,
            original_link: inputUrl,
            categoria: 'Tecnología' // Por defecto
        };

        // 3. GENERACIÓN DE CONTENIDO PREMIUM CON AI
        logger.info(`✍️ Redactando contenido para ${dealData.title}...`);
        const editorial = await AI.generateViralContent(dealData);
        dealData.viralContent = editorial.content;

        // 4. PUBLICACIÓN EN TELEGRAM Y WEB
        // Publisher.sendOffer ya guarda en la base de datos automáticamente
        const success = await Publisher.sendOffer(dealData);

        if (success) {
            console.log('\n=========================================');
            console.log('🏆 ¡OFERTA PUBLICADA CON ÉXITO!');
            console.log(`ID: ${dealData.id}`);
            console.log(`Título: ${dealData.title}`);
            console.log(`Tienda: ${dealData.tienda}`);
            console.log(`Precio: $${dealData.price_offer}`);
            console.log(`Link: ${dealData.link}`);
            console.log('=========================================\n');
        } else {
            logger.error('❌ El publicador de Telegram falló. Revisa el TOKEN y el ID del canal en .env');
        }

    } catch (error) {
        logger.error(`❌ Error Crítico: ${error.message}`);
        console.error(error);
    }
}

const url = process.argv[2];
const price = process.argv[3];

if (!url) {
    console.log('Uso: node manual_post.js "URL_DEL_PRODUCTO" [PRECIO]');
} else {
    createManualPost(url, price);
}
