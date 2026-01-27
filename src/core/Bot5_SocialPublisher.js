const axios = require('axios');
const logger = require('../utils/logger');
require('dotenv').config();

class SocialPublisher {
    constructor() {
        this.fbAccessToken = process.env.FACEBOOK_ACCESS_TOKEN;
        this.fbPageId = process.env.FACEBOOK_PAGE_ID;
        this.igUserId = process.env.INSTAGRAM_USER_ID; // Instagram Business Account ID
    }

    async publish(deal) {
        if (!this.fbAccessToken || this.fbAccessToken === 'tu_token_aqui') {
            return; // No configurado
        }

        try {
            // 1. PUBLICAR EN FACEBOOK PAGE
            await this.publishToFacebook(deal);

            // 2. PUBLICAR EN INSTAGRAM (Solo si tiene imagen y es cuenta Business)
            if (this.igUserId && deal.image) {
                await this.publishToInstagram(deal);
            }

        } catch (error) {
            logger.error(`❌ Error en Publicación Social: ${error.message}`);
        }
    }

    async publishToFacebook(deal) {
        try {
            const message = `${deal.badge ? deal.badge + '\n' : ''}🔥 ${deal.title}\n\n💰 Precio: $${deal.price_offer}\n\n🛒 Cómpralo aquí: ${deal.link}\n\n#ofertas #descuento #usa #shopping`;

            const url = `https://graph.facebook.com/v19.0/${this.fbPageId}/feed`;

            await axios.post(url, {
                message: message,
                link: deal.link,
                access_token: this.fbAccessToken
            });

            logger.info(`🔵 Publicado en Facebook: ${deal.title.substring(0, 30)}`);
        } catch (e) {
            logger.warn(`⚠️ FB Error: ${e.response?.data?.error?.message || e.message}`);
        }
    }

    async publishToInstagram(deal) {
        try {
            // Instagram requiere 2 pasos: Subir contenedor y luego publicar
            const caption = `🔥 ${deal.title}\n\n💰 Precio: $${deal.price_offer}\n\n🛒 Link en BIO o aquí: ${deal.link}\n\n#ofertas #instadeals #sale #usa`;

            // Paso 1: Crear contenedor de imagen
            const mediaUrl = `https://graph.facebook.com/v19.0/${this.igUserId}/media`;
            const containerRes = await axios.post(mediaUrl, {
                image_url: deal.image,
                caption: caption,
                access_token: this.fbAccessToken
            });

            const creationId = containerRes.data.id;

            // Paso 2: Publicar contenedor
            const publishUrl = `https://graph.facebook.com/v19.0/${this.igUserId}/media_publish`;
            await axios.post(publishUrl, {
                creation_id: creationId,
                access_token: this.fbAccessToken
            });

            logger.info(`📸 Publicado en Instagram: ${deal.title.substring(0, 30)}`);
        } catch (e) {
            logger.warn(`⚠️ IG Error: ${e.response?.data?.error?.message || e.message}`);
        }
    }
}

module.exports = new SocialPublisher();
