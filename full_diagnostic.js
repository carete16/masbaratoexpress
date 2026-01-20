const { Telegraf } = require('telegraf');
require('dotenv').config();
const { db } = require('./src/database/db');

async function diagnostic() {
    console.log("--- DIAGNÓSTICO DE MASBARATODEALS ---");

    // 1. Verificar Entorno
    console.log("1. Entorno:");
    console.log("   PORT:", process.env.PORT);
    console.log("   AMAZON_TAG:", process.env.AMAZON_TAG);
    console.log("   TELEGRAM_CHANNEL_ID:", process.env.TELEGRAM_CHANNEL_ID);

    // 2. Verificar Telegram
    console.log("\n2. Telegram:");
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        console.error("   ❌ TELEGRAM_BOT_TOKEN no definido en .env");
    } else {
        console.log("   Token length:", token.length);
        const bot = new Telegraf(token);
        try {
            const me = await bot.telegram.getMe();
            console.log("   ✅ Bot Valid:", me.username);
        } catch (e) {
            console.error("   ❌ Bot Invalid (401):", e.message);
        }
    }

    // 3. Verificar Database
    console.log("\n3. Database:");
    try {
        const publishedToday = db.prepare("SELECT COUNT(*) as count FROM published_deals WHERE date(posted_at) = date('now')").get();
        console.log("   ✅ Ofertas publicadas hoy:", publishedToday.count);

        const lastDeal = db.prepare("SELECT title, posted_at FROM published_deals ORDER BY posted_at DESC LIMIT 1").get();
        if (lastDeal) {
            console.log("   ✅ Última oferta:", lastDeal.title, "en", lastDeal.posted_at);
        }
    } catch (e) {
        console.error("   ❌ Error DB:", e.message);
    }

    // 4. Verificar Render
    console.log("\n4. Configuración Render (render.yaml):");
    try {
        const fs = require('fs');
        const yaml = fs.readFileSync('render.yaml', 'utf8');
        console.log("   ✅ Archivo render.yaml presente");
        if (yaml.includes('masbaratodeal-20')) {
            console.log("   ✅ Tag de Amazon en render.yaml es masbaratodeal-20");
        }
    } catch (e) {
        console.error("   ❌ Error render.yaml:", e.message);
    }
}

diagnostic();
