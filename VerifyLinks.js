const LinkTransformer = require('./src/utils/LinkTransformer');

// TUS CONFIGURACIONES ACTUALES (Simuladas)
console.log("🛠️  CONFIGURACIÓN ACTUAL DEL SISTEMA:");
console.log("-------------------------------------");
console.log(`Amazon Tag: ${LinkTransformer.tags.amazon}`);
console.log(`eBay ID:    ${LinkTransformer.tags.ebay || '⚠️ NO CONFIGURADO'}`);
console.log(`Walmart ID: ${LinkTransformer.tags.walmart || '⚠️ NO CONFIGURADO'}`);
console.log(`Sovrn Key:  ${LinkTransformer.tags.sovrn_prefix ? '✅ ACTIVO' : '❌ INACTIVO'}`);
console.log("-------------------------------------\n");

async function test(name, originalUrl) {
    console.log(`🧪 PRUEBA: ${name}`);
    console.log(`🔴 Original:     ${originalUrl}`);
    const finalUrl = await LinkTransformer.transform(originalUrl);
    console.log(`🟢 Transformado: ${finalUrl}`);

    // Verificaciones
    let status = "✅ LIMPIO Y MONETIZADO";

    // Chequeo de limpieza
    if (finalUrl.includes('campid=5337259887')) status = "❌ FALLO: No se borró el ID ajeno";
    if (finalUrl.includes('tag=otro-afiliado-20')) status = "❌ FALLO: No se borró el tag ajeno";

    // Chequeo de inserción
    if (originalUrl.includes('amazon') && !finalUrl.includes('masbaratodeal-20')) status = "❌ FALLO: No tiene TU tag de Amazon";

    console.log(`RESULTADO: ${status}`);
    console.log("---------------------------------------------------------------");
}

(async () => {
    // 1. Prueba Amazon (Debe quitar el tag ajeno y poner el tuyo)
    await test(
        "Amazon con Tag Ajeno",
        "https://www.amazon.com/dp/B08H75RTZ8?tag=otro-afiliado-20&linkCode=gg2"
    );

    // 2. Prueba eBay (Debe quitar el campid ajeno y poner el tuyo - Si lo tuvieras)
    await test(
        "eBay con ID Ajeno",
        "https://www.ebay.com/itm/157519572776?mkevt=1&mkcid=1&mkrid=711-53200-19255-0&campid=5337259887&toolid=10001&customid=58f20abef21111f09ba10e9da356a67b0INT"
    );

    // 3. Prueba Walmart (Debe limpiar)
    await test(
        "Walmart Sucio",
        "https://www.walmart.com/ip/PS5-Console/123456?u1=parásito&oid=123"
    );

    console.log("\n⚠️ NOTA: Si ves enlaces de Sovrn (redirect.viglink...) es porque no tienes ID directo para esa tienda y usamos el Universal.");
})();
