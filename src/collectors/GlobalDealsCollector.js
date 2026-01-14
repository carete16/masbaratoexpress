const logger = require('../utils/logger');
const SlickdealsCollector = require('./SlickdealsCollector');
const SlickRSSCollector = require('./SlickRSSCollector');

class GlobalDealsCollector {
    constructor() {
        // Podríamos añadir más fuentes USA aquí en el futuro
        this.usaSources = [
            SlickdealsCollector,
            SlickRSSCollector
        ];
    }

    async getDeals() {
        try {
            logger.info('Iniciando recolección de ofertas USA Originales...');
            let allDeals = [];

            for (const collector of this.usaSources) {
                const deals = await collector.getDeals();
                allDeals = allDeals.concat(deals);
            }

            // Filtrar para asegurar que solo sean de tiendas USA conocidas si es necesario
            // Por ahora Slickdeals ya filtra eso por nosotros.

            logger.info(`GlobalCollector: Se obtuvieron ${allDeals.length} ofertas USA.`);
            return allDeals;
        } catch (error) {
            logger.error(`Error en GlobalDealsCollector: ${error.message}`);
            return [];
        }
    }
}

module.exports = new GlobalDealsCollector();
