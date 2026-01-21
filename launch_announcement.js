const { Telegraf } = require('telegraf');
require('dotenv').config();

async function sendLaunchMessage() {
    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    const channelId = process.env.TELEGRAM_CHANNEL_ID;

    const message = `
🌟 <b>¡EL NUEVO +BARATO DEALS YA ESTÁ AQUÍ!</b> 🌟

Hemos trabajado duro para ofrecerte la plataforma de ofertas más avanzada del mercado. ¡Prepárate para ahorrar como un profesional! 🚀

<b>¿Qué hay de nuevo?</b>
✅ <b>Diseño Premium:</b> Una interfaz renovada, rápida y elegante.
✅ <b>Monitoreo 24/7:</b> Cazamos errores de precio en Amazon, Walmart, eBay y más en tiempo real.
✅ <b>Nuevas Funciones:</b> Lista de Favoritos, Modo Oscuro y Alertas personalizadas.
✅ <b>Multilingüe:</b> Ahora disponible en Español e Inglés.

🌐 <b>WEB OFICIAL:</b> https://masbaratodeals.net
(O tu enlace de Render si aún no propagas el dominio)

🔥 <i>No te pierdas ni una ganga. ¡Únete a los miles que ya están ahorrando con nosotros!</i>

👇 <b>EXPLORA LAS OFERTAS AHORA</b>
`;

    const inlineKeyboard = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🌐 VISITAR SITIO WEB', url: 'https://masbarato-deals-net.onrender.com' }],
                [{ text: '🔔 ACTIVAR ALERTAS', url: 'https://t.me/Masbarato_deals' }]
            ]
        }
    };

    try {
        console.log("🚀 Enviando anuncio de lanzamiento...");
        await bot.telegram.sendMessage(channelId, message, { parse_mode: 'HTML', ...inlineKeyboard });
        console.log("✅ ¡MENSAJE DE LANZAMIENTO ENVIADO A TELEGRAM!");
    } catch (e) {
        console.error("❌ Error enviando lanzamiento:", e.message);
    }
}

sendLaunchMessage();
