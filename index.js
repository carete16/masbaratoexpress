const cron = require('node-cron');
const logger = require('./src/utils/logger');
const CoreProcessor = require('./src/core/CoreProcessor');
const TelegramNotifier = require('./src/notifiers/TelegramNotifier');
const GlobalDealsCollector = require('./src/collectors/GlobalDealsCollector');
require('dotenv').config();

async function runBot() {
    try {
        // 1. Recolectar ofertas de fuentes estables (RSS)
        const rawDeals = await GlobalDealsCollector.getDeals();

        // 2. Procesar (Filtrar + Viralizar)
        const validDeals = await CoreProcessor.processDeals(rawDeals);

        logger.info(`Se encontraron ${validDeals.length} ofertas válidas para publicar.`);

        // 3. Publicar
        for (const deal of validDeals) {
            await TelegramNotifier.sendOffer(deal);
            // Pequeño delay entre publicaciones para no saturar
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

    } catch (error) {
        logger.error(`Error en el ciclo principal: ${error.message}`);
    }
}

const { startServer } = require('./src/web/server');
const EmailNotifier = require('./src/notifiers/EmailNotifier');
const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.resolve(__dirname, './src/database/deals.db'));

// Programar tarea (cada 30 minutos)
const interval = process.env.SCRAPE_INTERVAL_MINUTES || 30;
cron.schedule(`*/${interval} * * * *`, () => {
    logger.info('Ejecutando tarea programada...');
    runBot();
});

// Programar Reporte Diario (10:00 PM Colombia)
cron.schedule('0 22 * * *', async () => {
    logger.info('Generando reporte diario...');
    const total = db.prepare('SELECT COUNT(*) as count FROM published_deals').get().count;
    const last24h = db.prepare("SELECT COUNT(*) as count FROM published_deals WHERE posted_at > datetime('now', '-24 hours')").get().count;

    const stats = {
        total_published: total,
        last_24h: last24h,
        estimated_revenue: (total * 0.5).toFixed(2)
    };

    await EmailNotifier.sendDailyReport(stats);
});

// Iniciar Dashboard
const PORT = process.env.PORT || 4000;
startServer(PORT);

// Configurar Comandos de Admin
const bot = TelegramNotifier.bot;
bot.start((ctx) => ctx.reply('🚀 Sistema +BARATO DEALS .NET Activo.\nUsa /status para ver el estado del bot.'));
bot.command('status', (ctx) => {
    const total = db.prepare('SELECT COUNT(*) as count FROM published_deals').get().count;
    ctx.reply(`✅ Bot Online\n📊 Ofertas en DB: ${total}\n🌐 Sitio Web: ${process.env.RENDER_EXTERNAL_URL || 'http://localhost:' + PORT}`);
});
bot.launch();

// Primera ejecución inmediata
runBot();

logger.info(`Bot +BARATO DEALS .NET iniciado en puerto ${PORT}`);
