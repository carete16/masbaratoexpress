/**
 * verify.js - Script de Garantía de Calidad para MasbaratoExpress
 * Ejecuta este script antes de cualquier despliegue.
 */
const fs = require('fs');
const path = require('path');

console.log("🔍 Iniciando VERIFICACIÓN DE INTEGRIDAD...");

const criticalFiles = [
    'index.js',
    'src/utils/PriceEngine.js',
    'src/utils/DeepScraper.js',
    'src/utils/LinkTransformer.js',
    'src/utils/logger.js',
    'src/database/db.js',
    'package.json',
    'render-build.sh'
];

let errors = 0;

// 1. Verificar existencia de archivos
criticalFiles.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) {
        console.log(`✅ Archivo encontrado: ${file}`);
    } else {
        console.error(`❌ ERROR CRÍTICO: Falta el archivo ${file}`);
        errors++;
    }
});

// 2. Verificar Sintaxis de index.js
try {
    require('child_process').execSync('node --check index.js');
    console.log("✅ Sintaxis de index.js: CORRECTA");
} catch (e) {
    console.error("❌ ERROR DE SINTAXIS en index.js");
    errors++;
}

// 3. Prueba rápida de PriceEngine
try {
    const PriceEngine = require('./src/utils/PriceEngine');
    const testPrice = PriceEngine.calculate({ price_usd: 10, weight_lb: 1, trm: 4000 });
    if (testPrice.final_cop > 40000) {
        console.log("✅ Motor de Precios: FUNCIONANDO CORRECTAMENTE");
    } else {
        throw new Error("Cálculo de precio sospechoso");
    }
} catch (e) {
    console.error(`❌ ERROR EN MOTOR DE PRECIOS: ${e.message}`);
    errors++;
}

if (errors === 0) {
    console.log("\n🚀 ¡TODO LISTO! El código es seguro para desplegar.");
    process.exit(0);
} else {
    console.error(`\nalth 😂 SE DETECTARON ${errors} ERRORES. Abortando despliegue.`);
    process.exit(1);
}
