const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('./logger');

/**
 * SCRAPER BÁSICO (SIN PUPPETEER)
 * Funciona en Render.com sin necesidad de Chromium
 */
class BasicScraper {
    async scrape(url) {
        logger.info(`🔍 BasicScraper iniciando en: ${url}`);

        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                },
                timeout: 15000
            });

            const $ = cheerio.load(response.data);
            let result = {
                offerPrice: 0,
                officialPrice: 0,
                title: '',
                image: '',
                description: '',
                weight: 0,
                isUnavailable: false
            };

            // AMAZON
            if (url.includes('amazon.com')) {
                result.title = $('#productTitle').text().trim();

                // Precio
                const priceWhole = $('.a-price-whole').first().text().replace(/[^0-9]/g, '');
                const priceFraction = $('.a-price-fraction').first().text().replace(/[^0-9]/g, '');
                if (priceWhole) {
                    result.offerPrice = parseFloat(`${priceWhole}.${priceFraction || '00'}`);
                }

                // Imagen
                result.image = $('#landingImage').attr('src') ||
                    $('#imgBlkFront').attr('src') ||
                    $('img[data-old-hires]').attr('data-old-hires') ||
                    $('meta[property="og:image"]').attr('content');

                // Stock
                const bodyText = $('body').text().toLowerCase();
                if (bodyText.includes('currently unavailable') || bodyText.includes('out of stock')) {
                    result.isUnavailable = true;
                }

                // Peso (aproximado desde especificaciones)
                $('#productDetails_techSpec_section_1 tr, #productDetails_detailBullets_sections1 tr').each((i, el) => {
                    const label = $(el).find('th').text().toLowerCase();
                    const value = $(el).find('td').text();
                    if (label.includes('weight') || label.includes('item weight')) {
                        const match = value.match(/([\d.]+)\s*(pounds|lbs|oz|ounces)/i);
                        if (match) {
                            let w = parseFloat(match[1]);
                            if (match[2].toLowerCase().includes('oz')) w = w / 16;
                            result.weight = w;
                        }
                    }
                });
            }

            // WALMART
            else if (url.includes('walmart.com')) {
                result.title = $('h1[itemprop="name"]').text().trim() || $('h1').first().text().trim();

                const priceText = $('[itemprop="price"]').attr('content') ||
                    $('.price-characteristic').first().text();
                result.offerPrice = parseFloat(priceText?.replace(/[^0-9.]/g, '')) || 0;

                result.image = $('img[data-testid="hero-image-container"]').attr('src') ||
                    $('meta[property="og:image"]').attr('content');
            }

            // EBAY
            else if (url.includes('ebay.com')) {
                result.title = $('.x-item-title__mainTitle').text().trim() ||
                    $('#itemTitle').text().replace('Details about', '').trim();

                const priceText = $('.x-price-primary').text() || $('#prcIsum').text();
                result.offerPrice = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;

                result.image = $('.ux-image-magnify__image--main').attr('src') ||
                    $('#icImg').attr('src') ||
                    $('meta[property="og:image"]').attr('content');
            }

            // FALLBACK GENÉRICO
            if (!result.title) {
                result.title = $('meta[property="og:title"]').attr('content') ||
                    $('title').text() ||
                    $('h1').first().text().trim();
            }

            if (!result.image) {
                result.image = $('meta[property="og:image"]').attr('content');
            }

            logger.info(`✅ BasicScraper: ${result.title?.substring(0, 50)}... | $${result.offerPrice}`);
            return result;

        } catch (error) {
            logger.error(`❌ BasicScraper Error: ${error.message}`);
            return null;
        }
    }
}

module.exports = new BasicScraper();
