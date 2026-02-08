const amazonPaapi = require('amazon-paapi');
const logger = require('./logger');

/**
 * AMAZON PRODUCT API (OFICIAL)
 * Solución profesional y legal para obtener datos de productos Amazon
 */
class AmazonAPI {
    constructor() {
        this.config = {
            AccessKey: process.env.AMAZON_ACCESS_KEY || '',
            SecretKey: process.env.AMAZON_SECRET_KEY || '',
            PartnerTag: process.env.AMAZON_PARTNER_TAG || '',
            Marketplace: 'www.amazon.com'
        };

        this.isConfigured = !!(this.config.AccessKey && this.config.SecretKey && this.config.PartnerTag);
    }

    extractASIN(url) {
        const match = url.match(/\/dp\/([A-Z0-9]{10})|\/gp\/product\/([A-Z0-9]{10})/i);
        return match ? (match[1] || match[2]) : null;
    }

    async getProductDetails(url) {
        if (!this.isConfigured) {
            logger.warn('⚠️ Amazon API no configurada. Usa variables de entorno: AMAZON_ACCESS_KEY, AMAZON_SECRET_KEY, AMAZON_PARTNER_TAG');
            return null;
        }

        const asin = this.extractASIN(url);
        if (!asin) {
            logger.warn(`❌ No se pudo extraer ASIN de: ${url}`);
            return null;
        }

        try {
            logger.info(`🔍 Amazon API: Consultando ASIN ${asin}...`);

            const requestParameters = {
                ItemIds: [asin],
                Resources: [
                    'ItemInfo.Title',
                    'ItemInfo.Features',
                    'Offers.Listings.Price',
                    'Images.Primary.Large',
                    'ItemInfo.ProductInfo.ItemDimensions.Weight'
                ]
            };

            const response = await amazonPaapi.GetItems(this.config, requestParameters);

            if (!response || !response.ItemsResult || !response.ItemsResult.Items || response.ItemsResult.Items.length === 0) {
                logger.warn(`❌ Amazon API: No se encontró producto para ASIN ${asin}`);
                return null;
            }

            const item = response.ItemsResult.Items[0];

            const result = {
                offerPrice: 0,
                officialPrice: 0,
                title: '',
                image: '',
                description: '',
                weight: 0,
                isUnavailable: false
            };

            // Título
            if (item.ItemInfo && item.ItemInfo.Title && item.ItemInfo.Title.DisplayValue) {
                result.title = item.ItemInfo.Title.DisplayValue;
            }

            // Precio
            if (item.Offers && item.Offers.Listings && item.Offers.Listings.length > 0) {
                const listing = item.Offers.Listings[0];
                if (listing.Price && listing.Price.Amount) {
                    result.offerPrice = listing.Price.Amount;
                }
                if (listing.SavingBasis && listing.SavingBasis.Amount) {
                    result.officialPrice = listing.SavingBasis.Amount;
                }
            }

            // Imagen
            if (item.Images && item.Images.Primary && item.Images.Primary.Large && item.Images.Primary.Large.URL) {
                result.image = item.Images.Primary.Large.URL;
            }

            // Descripción (Features)
            if (item.ItemInfo && item.ItemInfo.Features && item.ItemInfo.Features.DisplayValues) {
                result.description = item.ItemInfo.Features.DisplayValues.slice(0, 5).join('\n');
            }

            // Peso
            if (item.ItemInfo && item.ItemInfo.ProductInfo && item.ItemInfo.ProductInfo.ItemDimensions && item.ItemInfo.ProductInfo.ItemDimensions.Weight) {
                const weightData = item.ItemInfo.ProductInfo.ItemDimensions.Weight;
                if (weightData.DisplayValue) {
                    const match = weightData.DisplayValue.match(/([\d.]+)\s*(pounds|lbs|oz|ounces)/i);
                    if (match) {
                        let w = parseFloat(match[1]);
                        if (match[2].toLowerCase().includes('oz')) w = w / 16;
                        result.weight = w;
                    }
                }
            }

            logger.info(`✅ Amazon API: ${result.title.substring(0, 50)}... | $${result.offerPrice}`);
            return result;

        } catch (error) {
            logger.error(`❌ Amazon API Error: ${error.message}`);
            return null;
        }
    }
}

module.exports = new AmazonAPI();
