const axios = require('axios');
const logger = require('../utils/logger');

/**
 * BOT 2: EXPLORADOR DE PROFUNDIDAD (Protocolo de Extracción Estática)
 * Intenta obtener el link sin entrar a Slickdeals si es posible.
 */
class DeepExplorerBot {
    constructor() {
        this.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    }

    async explore(initialUrl) {
        logger.info(`🕵️ BOT 2: Procesando ${initialUrl.substring(0, 50)}...`);

        const result = {
            finalUrl: initialUrl,
            coupon: null,
            isExpired: false,
            price_offer: null,
            price_official: null,
            store: 'Oferta USA',
            image: null
        };

        try {
            // TÉCNICA 1: DECODIFICACIÓN DE PARÁMETROS (Rápido y Seguro)
            const uObj = new URL(initialUrl);
            const rawDest = uObj.searchParams.get('u2') || uObj.searchParams.get('url') || uObj.searchParams.get('dest') || uObj.searchParams.get('mpre');

            if (rawDest && rawDest.startsWith('http')) {
                result.finalUrl = decodeURIComponent(rawDest);
                logger.info(`🎯 Bot 2: Extracción estática exitosa.`);
                return await this.finalizeResult(result);
            }

            // Si no hay u2, el CoreProcessor activará automáticamente el Bot 5
            return await this.finalizeResult(result);

        } catch (error) {
            return result;
        }
    }

    async finalizeResult(result) {
        const url = result.finalUrl.toLowerCase();
        if (url.includes('amazon.com')) result.store = 'Amazon';
        else if (url.includes('walmart.com')) result.store = 'Walmart';
        else if (url.includes('ebay.com')) result.store = 'eBay';
        else if (url.includes('bestbuy.com')) result.store = 'Best Buy';
        else if (url.includes('target.com')) result.store = 'Target';

        return result;
    }
}

module.exports = new DeepExplorerBot();
