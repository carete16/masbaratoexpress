const { Telegraf } = require('telegraf');
const axios = require('axios');
require('dotenv').config();
const logger = require('../utils/logger');
const { saveDeal } = require('../database/db');

class TelegramNotifier {
    constructor() {
        this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
        // Mapeo de canales por categoría para escalabilidad
        this.channels = {
            'Tecnología': process.env.CHANNEL_TECH || process.env.TELEGRAM_CHANNEL_ID,
            'Hogar': process.env.CHANNEL_HOGAR || process.env.TELEGRAM_CHANNEL_ID,
            'Moda': process.env.CHANNEL_MODA || process.env.TELEGRAM_CHANNEL_ID,
            'default': process.env.TELEGRAM_CHANNEL_ID
        };
    }

    async downloadImage(url) {
        if (!url) return null;

        try {
            logger.info(`Descargando imagen directamente: ${url}`);
            const response = await axios({
                method: 'get',
                url: url,
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': 'https://www.google.com/',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                },
                timeout: 15000
            });

            if (response.status === 200) {
                const buffer = Buffer.from(response.data, 'binary');
                logger.info(`Imagen descargada con éxito (${buffer.length} bytes)`);
                return buffer;
            }
        } catch (error) {
            logger.error(`Error descarga directa: ${error.message} para ${url}`);
        }
        return null;
    }

    async sendOffer(deal) {
        try {
            if (!process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN === 'tu_token_aqui') {
                logger.warn('TELEGRAM_BOT_TOKEN no configurado. Simulando envío...');
                return true;
            }

            const channelId = this.channels[deal.categoria] || this.channels['default'];
            let photoBuffer = null;

            if (deal.image && !deal.image.includes('.svg') && !deal.image.includes('placehold.co')) {
                photoBuffer = await this.downloadImage(deal.image);
            }

            // FORMATO VIRAL CON CUPÓN
            let finalCaption = deal.viralContent;
            if (deal.coupon) {
                finalCaption += `\n\n🎟️ <b>CUPÓN:</b> <code>${deal.coupon}</code>`;
            }

            try {
                if (photoBuffer && photoBuffer.length > 500) {
                    // ENVIAR COMO FOTO GRANDE
                    await this.bot.telegram.sendPhoto(channelId, { source: photoBuffer }, {
                        caption: finalCaption,
                        parse_mode: 'HTML'
                    });
                    logger.info(`📸 Foto enviada con éxito: ${deal.title}`);
                } else {
                    // Fallback a texto si no hay imagen
                    await this.bot.telegram.sendMessage(channelId, finalCaption, {
                        parse_mode: 'HTML',
                        disable_web_page_preview: false
                    });
                    logger.info(`📝 Texto enviado (sin imagen): ${deal.title}`);
                }
            } catch (tgErr) {
                logger.error(`⚠️ Fallo Telegram (Reintentando solo texto): ${tgErr.message}`);
                // Último intento: solo texto sin nada más
                await this.bot.telegram.sendMessage(channelId, finalCaption, { parse_mode: 'HTML' });
            }

            // Guardar en DB con metadatos completos para la web
            saveDeal({
                id: deal.id || deal.link,
                link: deal.link,
                original_link: deal.original_link || deal.link,
                title: deal.title,
                price_official: deal.price_official,
                price_offer: deal.price_offer,
                image: deal.image,
                tienda: deal.tienda,
                categoria: deal.categoria,
                coupon: deal.coupon,
                badge: deal.badge,
                score: deal.score,
                is_historic_low: deal.is_historic_low
            });

            return true;
        } catch (error) {
            logger.error(`Error enviando a Telegram (${deal.title}): ${error.message}`);
            return false;
        }
    }

    /**
     * Envía una alerta al administrador sobre una nueva oferta pendiente de revisión
     */
    async sendAdminModerationAlert(deal) {
        try {
            const adminId = process.env.TELEGRAM_ADMIN_ID || process.env.TELEGRAM_CHANNEL_ID;
            if (!adminId) return;

            const message = `
🔔 <b>NUEVA OFERTA PARA REVISAR</b>

📌 <b>Producto:</b> ${deal.title}
💰 <b>Precio:</b> $${deal.price}
🏪 <b>Tienda:</b> ${deal.store}
🗣️ <b>Enviado por:</b> Colaborador Web

<pre>Inspección requerida para validar veracidad y monetización.</pre>

👉 <a href="https://masbaratodeals.onrender.com/admin">Abrir Panel de Moderación</a>
            `;

            await this.bot.telegram.sendMessage(adminId, message, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔍 Revisar en Panel Admin', url: 'https://masbaratodeals.onrender.com/admin' }]
                    ]
                }
            });
            logger.info(`Notificación de moderación enviada para: ${deal.title}`);
        } catch (error) {
            logger.error(`Error enviando alerta de moderación: ${error.message}`);
        }
    }
}

module.exports = new TelegramNotifier();
