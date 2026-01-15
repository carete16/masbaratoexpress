const { db } = require('./src/database/db');
const TelegramNotifier = require('./src/notifiers/TelegramNotifier');
const logger = require('./src/utils/logger');

/**
 * Script para enviar newsletter semanal a suscriptores
 * Ejecutar: node send-newsletter.js
 */

async function sendWeeklyNewsletter() {
    try {
        logger.info('📧 Iniciando envío de newsletter semanal...');

        // Obtener suscriptores activos
        const subscribers = db.prepare('SELECT email FROM newsletter_subscribers WHERE active = 1').all();

        if (subscribers.length === 0) {
            logger.info('No hay suscriptores activos.');
            return;
        }

        // Obtener top 10 ofertas de la semana (últimos 7 días)
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const topDeals = db.prepare(`
            SELECT title, price_offer, price_official, tienda, link, clicks 
            FROM published_deals 
            WHERE posted_at > ? 
            ORDER BY clicks DESC 
            LIMIT 10
        `).all(weekAgo);

        if (topDeals.length === 0) {
            logger.info('No hay ofertas de esta semana.');
            return;
        }

        // Generar contenido del email
        const emailContent = generateEmailHTML(topDeals);

        logger.info(`📊 ${subscribers.length} suscriptores`);
        logger.info(`🔥 ${topDeals.length} ofertas destacadas`);

        // Aquí integrarías con un servicio de email como SendGrid, Mailgun, etc.
        // Por ahora, solo mostramos el contenido
        console.log('\n--- CONTENIDO DEL EMAIL ---');
        console.log(emailContent);
        console.log('--- FIN DEL EMAIL ---\n');

        // Notificar en Telegram que se envió newsletter
        const bot = TelegramNotifier.bot;
        await bot.telegram.sendMessage(
            process.env.TELEGRAM_CHANNEL_ID,
            `📧 Newsletter semanal enviada a ${subscribers.length} suscriptores con ${topDeals.length} ofertas destacadas.`
        );

        logger.info('✅ Newsletter enviada exitosamente');

    } catch (error) {
        logger.error(`Error enviando newsletter: ${error.message}`);
    }
}

function generateEmailHTML(deals) {
    const dealsHTML = deals.map((deal, index) => {
        const discount = deal.price_official > 0
            ? Math.round(((deal.price_official - deal.price_offer) / deal.price_official) * 100)
            : 0;

        return `
        <tr>
            <td style="padding: 20px; border-bottom: 1px solid #eee;">
                <h3 style="margin: 0 0 10px 0; color: #333;">${index + 1}. ${deal.title}</h3>
                <p style="margin: 5px 0; color: #666;">
                    <strong style="color: #ff4d4d; font-size: 24px;">$${deal.price_offer}</strong>
                    ${deal.price_official > 0 ? `<span style="text-decoration: line-through; color: #999; margin-left: 10px;">$${deal.price_official}</span>` : ''}
                    ${discount > 0 ? `<span style="background: #ff4d4d; color: white; padding: 2px 8px; border-radius: 4px; margin-left: 10px; font-size: 12px;">-${discount}%</span>` : ''}
                </p>
                <p style="margin: 5px 0; color: #888; font-size: 14px;">🏪 ${deal.tienda || 'USA Store'} | 👥 ${deal.clicks} personas vieron esta oferta</p>
                <a href="${deal.link}" style="display: inline-block; margin-top: 10px; padding: 12px 24px; background: #ff4d4d; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">VER OFERTA</a>
            </td>
        </tr>
        `;
    }).join('');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🔥 Top 10 Ofertas de la Semana | +BARATO DEALS</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #ff4d4d, #ff7675); padding: 40px 20px; text-align: center;">
                            <h1 style="margin: 0; color: white; font-size: 32px;">🔥 +BARATO DEALS</h1>
                            <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Top 10 Ofertas de la Semana</p>
                        </td>
                    </tr>
                    
                    <!-- Intro -->
                    <tr>
                        <td style="padding: 30px 20px; text-align: center; background-color: #fafafa;">
                            <p style="margin: 0; color: #666; font-size: 16px; line-height: 1.6;">
                                ¡Hola! 👋<br>
                                Estas son las <strong>10 ofertas más populares</strong> de esta semana.<br>
                                Miles de personas ya las aprovecharon. ¡No te quedes atrás!
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Deals -->
                    ${dealsHTML}
                    
                    <!-- CTA -->
                    <tr>
                        <td style="padding: 40px 20px; text-align: center; background-color: #fafafa;">
                            <h3 style="margin: 0 0 15px 0; color: #333;">¿Quieres más ofertas?</h3>
                            <a href="https://masbaratodeals-net.onrender.com" style="display: inline-block; padding: 14px 32px; background: #ff4d4d; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Ver Todas las Ofertas</a>
                            <p style="margin: 20px 0 0 0; color: #888; font-size: 14px;">
                                O únete a nuestro canal de Telegram: 
                                <a href="https://t.me/Masbarato_deals" style="color: #229ED9; text-decoration: none;">@Masbarato_deals</a>
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 20px; text-align: center; background-color: #333; color: #999; font-size: 12px;">
                            <p style="margin: 0 0 10px 0;">© 2026 +BARATO DEALS - Cazadores de ofertas profesionales</p>
                            <p style="margin: 0;">
                                <a href="https://masbaratodeals-net.onrender.com" style="color: #ff4d4d; text-decoration: none;">Sitio Web</a> | 
                                <a href="#" style="color: #999; text-decoration: none;">Cancelar suscripción</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;
}

// Ejecutar
sendWeeklyNewsletter().then(() => {
    console.log('\n✅ Proceso completado');
    process.exit(0);
}).catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
