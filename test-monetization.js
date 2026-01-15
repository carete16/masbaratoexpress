const LinkTransformer = require('./src/utils/LinkTransformer');
const logger = require('./src/utils/logger');

console.log('\n💰 ========================================');
console.log('   PRUEBA DE MONETIZACIÓN REAL');
console.log('========================================\n');

async function testMonetization() {
    // CASO 1: Amazon (Directo)
    const amazonLink = 'https://www.amazon.com/dp/B08F6BPH4C';
    console.log('📦 CASO 1: Amazon (Debe ser Directo)');
    console.log(`   Original: ${amazonLink}`);
    const amazonResult = await LinkTransformer.transform(amazonLink);
    console.log(`   Resultado: ${amazonResult}`);
    console.log(`   ¿Usa tu TAG?: ${amazonResult.includes('masbaratodeal-20') ? '✅ SÍ' : '❌ NO'}\n`);

    // CASO 2: Walmart (Vía Sovrn)
    const walmartLink = 'https://www.walmart.com/ip/HP-Stream-14-Laptop/123456789';
    console.log('📦 CASO 2: Walmart (Debe ser Sovrn)');
    console.log(`   Original: ${walmartLink}`);
    const walmartResult = await LinkTransformer.transform(walmartLink);

    // Debería empezar con redirect.viglink.com...
    console.log(`   Resultado: ${walmartResult.substring(0, 80)}...`);
    console.log(`   ¿Usa Sovrn?: ${walmartResult.includes('viglink.com') ? '✅ SÍ' : '❌ NO'}`);
    console.log(`   ¿Tiene tu KEY?: ${walmartResult.includes('168bdd181cfb276b05d8527e1d4cd03e') ? '✅ SÍ' : '❌ NO'}\n`);

    // CASO 3: Microcenter (Vía Sovrn)
    const microcenterLink = 'https://www.microcenter.com/product/641234/amd-ryzen-5-5600x';
    console.log('📦 CASO 3: Microcenter (Debe ser Sovrn)');
    console.log(`   Original: ${microcenterLink}`);
    const microcenterResult = await LinkTransformer.transform(microcenterLink);
    console.log(`   Result: ${microcenterResult.substring(0, 80)}...`);
    console.log(`   ¿Usa Sovrn?: ${microcenterResult.includes('viglink.com') ? '✅ SÍ' : '❌ NO'}\n`);

    // CASO 4: eBay (Vía Sovrn - Porque no pusimos ID directo)
    const ebayLink = 'https://www.ebay.com/itm/Sony-WH-1000XM5/225588123456';
    console.log('📦 CASO 4: eBay (Debe ser Sovrn)');
    console.log(`   Original: ${ebayLink}`);
    const ebayResult = await LinkTransformer.transform(ebayLink);
    console.log(`   Result: ${ebayResult.substring(0, 80)}...`);
    console.log(`   ¿Usa Sovrn?: ${ebayResult.includes('viglink.com') ? '✅ SÍ' : '❌ NO'}\n`);
}

testMonetization();
