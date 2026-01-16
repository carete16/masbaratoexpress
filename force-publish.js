/**
 * FORCE PUBLISH PRO
 * Fuerza una recolección masiva usando el motor SlickdealsPro de alta fidelidad.
 */
const CoreProcessor = require('./src/core/CoreProcessor');
const logger = require('./src/utils/logger');

async function runNow() {
    console.log('\n🔥 INICIANDO CLONACIÓN MASIVA DE ALTA FIDELIDAD\n');
    console.log('='.repeat(80));

    try {
        // Ejecutamos el Core directamente
        await CoreProcessor.start();

        console.log('\n🚀 El ciclo ha sido activado. Las ofertas están fluyendo a la web y Telegram.');
        console.log('Verifica en: https://masbaratodeals.onrender.com\n');

    } catch (e) {
        console.error('❌ Error en ejecución forzada:', e.message);
    }
}

runNow();
