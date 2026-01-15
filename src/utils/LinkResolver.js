const puppeteer = require('puppeteer');
const logger = require('./logger');
const affiliates = require('../config/affiliates');

class LinkResolver {
    constructor() {
        this.browser = null;
    }

    async initBrowser() {
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: "new",
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--single-process' // Optimización para recursos limitados
                ]
            });
        }
        return this.browser;
    }

    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    /**
     * Resuelve el link final usando un navegador real (Puppeteer)
     * para evitar bloqueos y manejar redirecciones JS.
     */
    async resolve(slickdealsUrl) {
        if (!slickdealsUrl || !slickdealsUrl.includes('slickdeals.net')) {
            return affiliates.tagLink(slickdealsUrl);
        }

        let browser = null;
        try {
            // Lanzamos browser nuevo por cada request para evitar fugas de memoria en este entorno
            // A largo plazo sería mejor reusar, pero por seguridad en Render lo cerramos siempre.
            browser = await puppeteer.launch({
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            const page = await browser.newPage();

            // Parecer humano
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            await page.setViewport({ width: 1366, height: 768 });

            // Cargar página (timeout corto para no colgar)
            await page.goto(slickdealsUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

            // Estrategia 1: Buscar botón "See Deal" (#dealBuyBtn)
            // Slickdeals usa este ID casi siempre
            let finalLink = '';

            try {
                // Esperar un poco a que cargue JS
                await page.waitForSelector('#dealBuyBtn', { timeout: 3000 });
                finalLink = await page.$eval('#dealBuyBtn', el => el.href);
            } catch (e) {
                // Si falla, buscar cualquier botón que tenga texto de "Amazon" o "Buy"
                // O buscar el primer link grande en la caja de compra
                logger.warn(`LinkResolver: No se halló #dealBuyBtn en ${slickdealsUrl}, intentando búsqueda heurística...`);

                // Intentar encontrar enlaces que parezcan externos (redirect failsafe)
                const links = await page.$$eval('a', anchors => anchors.map(a => a.href));
                const buyLink = links.find(l => l.includes('amazon.com') || l.includes('walmart.com') || l.includes('bestbuy.com') || l.includes('ebay.com'));
                if (buyLink) finalLink = buyLink;
            }

            if (finalLink) {
                // Si el link es relativo o es un redirect de SD, lo seguimos
                if (finalLink.includes('slickdeals.net')) {
                    logger.info(`Siguiendo redirección de Slickdeals: ${finalLink}`);
                    await page.goto(finalLink, { waitUntil: 'load', timeout: 15000 });
                    finalLink = page.url(); // URL final después de redirección
                }
            }

            await browser.close();

            if (finalLink && !finalLink.includes('slickdeals.net')) {
                logger.info(`LinkResolver CHECK: ${finalLink}`);
                return affiliates.tagLink(finalLink);
            } else {
                logger.warn('LinkResolver: No se pudo limpiar el link, devolviendo original.');
                return slickdealsUrl;
            }

        } catch (error) {
            logger.error(`LinkResolver Fatal Error: ${error.message} (URL: ${slickdealsUrl})`);
            if (browser) await browser.close();
            return slickdealsUrl;
        }
    }
}

module.exports = new LinkResolver();
