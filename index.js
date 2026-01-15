const cron = require('node-cron');
const logger = require('./src/utils/logger');
const CoreProcessor = require('./src/core/CoreProcessor');
const TelegramNotifier = require('./src/notifiers/TelegramNotifier');
const GlobalDealsCollector = require('./src/collectors/GlobalDealsCollector');
const { db } = require('./src/database/db'); // DB Compartida
const { startServer } = require('./src/web/server');
require('dotenv').config();

async function runBot() {
  try {
    logger.info('Iniciando ciclo de recolección...');
    const rawDeals = await GlobalDealsCollector.getDeals();
    const validDeals = await CoreProcessor.processDeals(rawDeals);

    logger.info(`${validDeals.length} ofertas nuevas validadas.`);

    for (const deal of validDeals) {
      await TelegramNotifier.sendOffer(deal);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  } catch (error) {
    logger.error(`Error Bot: ${error.message}`);
  }
}

// 1. Iniciar Servidor Web Inmediatamente (Prioridad para Render)
const PORT = process.env.PORT || 10000;
startServer(PORT);

// 2. Iniciar Bot en segundo plano
async function startApp() {
  try {
    logger.info('Iniciando procesos de fondo...');
    await runBot();

    // Programar ciclos
    cron.schedule(`*/30 * * * *`, () => runBot());

    // Telegraf Commands
    const bot = TelegramNotifier.bot;
    bot.start((ctx) => ctx.reply('🚀 +BARATO DEALS Activo'));
    bot.command('status', (ctx) => {
      try {
        const total = db.prepare('SELECT COUNT(*) as count FROM published_deals').get().count;
        ctx.reply(`📊 Total en DB: ${total}\n🌐 https://masbaratodeals-net.onrender.com`);
      } catch (e) {
        ctx.reply('Error consultando DB');
      }
    });
    bot.launch().catch(err => logger.error(`Error Telegraf: ${err.message}`));
  } catch (err) {
    logger.error(`Fallo en arranque secundario: ${err.message}`);
  }
}

startApp();

logger.info(`Bot y Servidor listos. Puerto: ${PORT}`);
