const ProScraper = require('./src/collectors/SlickdealsProScraper');
const ExplorerBot = require('./src/core/DeepExplorerBot');
const AuditorBot = require('./src/core/PriceAuditorBot');
const LinkTransformer = require('./src/utils/LinkTransformer');
const Telegram = require('./src/notifiers/TelegramNotifier');
const db = require('./src/database/db');
const logger = require('./src/utils/logger');

async function diagnose() {
    console.log("🚀 INICIANDO DIAGNÓSTICO PROFUNDO DEL BOT...");

    try {
        const rawDeals = await ProScraper.getFrontpageDeals();
        console.log(`🔍 1. SCRAPER: Encontradas ${rawDeals.length} ofertas en la superficie.`);

        if (rawDeals.length === 0) {
            console.error("❌ ERROR: El scraper no devolvió nada.");
            return;
        }

        const deal = rawDeals[0];
        console.log(`\n📋 PROCESANDO OFERTA PILOTO: ${deal.title}`);

        // FASE 1: EXPLORADOR
        console.log("🕵️ FASE 1: Iniciando Explorador Profundo...");
        const expedition = await ExplorerBot.explore(deal.link);
        console.log("✅ Exploración completada:", {
            tienda: expedition.store,
            expirada: expedition.isExpired,
            precio_oferta: expedition.price_offer,
            precio_original: expedition.price_official,
            link_final: expedition.finalUrl.substring(0, 50) + "..."
        });

        if (expedition.isExpired) {
            console.warn("⚠️ AVISO: La oferta se detectó como EXPIRADA.");
        }

        // FASE 2: AUDITOR
        console.log("\n⚖️ FASE 2: Iniciando Auditor de Precios...");
        deal.price_offer = expedition.price_offer || deal.price_offer;
        deal.price_official = expedition.price_official || deal.price_official;
        const audit = await AuditorBot.audit(deal);
        console.log("✅ Auditoría completada:", audit);

        if (!audit.isGoodDeal) {
            console.warn("⚠️ AVISO: El auditor descartó la oferta por falta de ahorro real.");
        }

        // FASE 3: MONETIZADOR
        console.log("\n💰 FASE 3: Iniciando Monetización...");
        const monetized = await LinkTransformer.transform(expedition.finalUrl);
        if (!monetized || monetized.includes('slickdeals.net')) {
            console.error("❌ ERROR CRÍTICO: El bypass falló. El link sigue siendo Slickdeals o es nulo.");
        } else {
            console.log("✅ Monetización exitosa:", monetized.substring(0, 60) + "...");
        }

        // FASE 4: TELEGRAM (DUMMY SEND)
        console.log("\n📱 FASE 4: Probando parámetros de envío...");
        console.log("Token:", process.env.TELEGRAM_BOT_TOKEN ? "CONFIGURADO ✅" : "FALTANTE ❌");
        console.log("Channel ID:", process.env.TELEGRAM_CHANNEL_ID ? "CONFIGURADO ✅" : "FALTANTE ❌");

    } catch (e) {
        console.error("❌ ERROR EN DIAGNÓSTICO:", e);
    }
}

diagnose();
