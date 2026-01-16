const axios = require('axios');
const fs = require('fs');

async function fullAudit() {
    const report = [];
    report.push("=".repeat(80));
    report.push("AUDITORÍA COMPLETA - " + new Date().toISOString());
    report.push("=".repeat(80));

    try {
        const response = await axios.get('https://masbaratodeals.onrender.com/api/deals');
        const deals = response.data;

        report.push(`\nTotal ofertas: ${deals.length}\n`);

        let monetizedCount = 0;
        let imageOkCount = 0;

        for (let i = 0; i < deals.length; i++) {
            const deal = deals[i];
            report.push(`\n[${i + 1}/${deals.length}] ${deal.title}`);
            report.push(`    Tienda: ${deal.tienda}`);
            report.push(`    Precio: $${deal.price_offer}`);

            // Check monetization
            const isMonetized = deal.link.includes('masbaratodeal-20') ||
                deal.link.includes('viglink') ||
                deal.link.includes('rover.ebay');

            if (isMonetized) {
                report.push(`    ✅ MONETIZADO`);
                monetizedCount++;
            } else {
                report.push(`    ❌ NO MONETIZADO`);
                report.push(`    Link: ${deal.link}`);
            }

            // Check image
            try {
                await axios.head(deal.image, { timeout: 3000 });
                report.push(`    ✅ Imagen OK`);
                imageOkCount++;
            } catch (e) {
                report.push(`    ❌ Imagen ROTA`);
                report.push(`    URL: ${deal.image}`);
            }
        }

        report.push("\n" + "=".repeat(80));
        report.push("\nRESUMEN:");
        report.push(`  Monetizadas: ${monetizedCount}/${deals.length} (${Math.round(monetizedCount / deals.length * 100)}%)`);
        report.push(`  Imágenes OK: ${imageOkCount}/${deals.length} (${Math.round(imageOkCount / deals.length * 100)}%)`);
        report.push("=".repeat(80));

        const reportText = report.join('\n');
        fs.writeFileSync('AUDIT_REPORT.txt', reportText);
        console.log(reportText);
        console.log("\n📄 Reporte guardado en: AUDIT_REPORT.txt");

    } catch (error) {
        console.error(`Error: ${error.message}`);
    }
}

fullAudit();
