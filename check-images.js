const axios = require('axios');

async function checkImages() {
    console.log("🖼️  VERIFICANDO IMÁGENES\n");

    try {
        const response = await axios.get('https://masbaratodeals.onrender.com/api/deals');
        const deals = response.data;

        console.log(`Total ofertas: ${deals.length}\n`);

        for (const deal of deals) {
            console.log(`📦 ${deal.title}`);
            console.log(`   Imagen: ${deal.image}`);

            try {
                const imgResponse = await axios.head(deal.image, { timeout: 5000 });
                console.log(`   ✅ Imagen OK (${imgResponse.status})`);
            } catch (e) {
                console.log(`   ❌ Imagen ROTA: ${e.message}`);
            }
            console.log();
        }
    } catch (error) {
        console.error(`Error: ${error.message}`);
    }
}

checkImages();
