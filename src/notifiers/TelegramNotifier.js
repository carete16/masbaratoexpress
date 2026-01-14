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

            if (deal.image) {
                photoBuffer = await this.downloadImage(deal.image);
            }

            if (photoBuffer) {
                // ENVIAR COMO FOTO GRANDE (User request: mayor tamaño)
                await this.bot.telegram.sendPhoto(channelId, { source: photoBuffer }, {
                    caption: deal.viralContent,
                    parse_mode: 'HTML'
                });
                logger.info(`Foto GRANDE enviada para: ${deal.title}`);
            } else {
                // Fallback a texto si no hay imagen
                await this.bot.telegram.sendMessage(channelId, deal.viralContent, {
                    parse_mode: 'HTML',
                    disable_web_page_preview: false
                });
                logger.info(`Texto enviado (sin imagen) para: ${deal.title}`);
            }

            // Guardar en DB con metadatos completos para la web
            saveDeal({
                id: deal.id || deal.link,
                link: deal.link,
                title: deal.title,
                price_official: deal.price_official,
                price_offer: deal.price_offer,
                image: deal.image,
                tienda: deal.tienda,
                categoria: deal.categoria
            });

            return true;
        } catch (error) {
            logger.error(`Error enviando a Telegram (${deal.title}): ${error.message}`);
            return false;
        }
    }
}

module.exports = new TelegramNotifier();
