// ARCHIVO TEMPORAL PARA DEBUGGING - ELIMINAR DESPUÉS
const db = require('./src/database/db');

console.log('\n=== DIAGNÓSTICO DE BASE DE DATOS ===\n');

try {
    // 1. Verificar estructura de la tabla
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='products'").get();
    console.log('📋 Estructura de la tabla products:');
    console.log(tableInfo.sql);
    console.log('\n');

    // 2. Contar productos por estado
    const counts = db.prepare("SELECT status, COUNT(*) as count FROM products GROUP BY status").all();
    console.log('📊 Productos por estado:');
    counts.forEach(row => console.log(`  ${row.status}: ${row.count}`));
    console.log('\n');

    // 3. Ver productos pendientes
    const pending = db.prepare("SELECT id, name, category, price_usd, weight_lb, source_link, created_at FROM products WHERE status = 'pendiente' ORDER BY created_at DESC LIMIT 5").all();
    console.log('🔍 Últimos 5 productos PENDIENTES:');
    pending.forEach((p, i) => {
        console.log(`\n  ${i + 1}. ${p.name || 'Sin nombre'}`);
        console.log(`     ID: ${p.id}`);
        console.log(`     Categoría: ${p.category || 'Sin categoría'}`);
        console.log(`     Precio USD: $${p.price_usd || 0}`);
        console.log(`     Peso: ${p.weight_lb || 0} lbs`);
        console.log(`     Link: ${p.source_link ? p.source_link.substring(0, 50) + '...' : 'Sin link'}`);
        console.log(`     Creado: ${p.created_at}`);
    });

    // 4. Ver todos los productos
    const all = db.prepare("SELECT id, name, status FROM products").all();
    console.log(`\n\n📦 TODOS LOS PRODUCTOS (${all.length} total):`);
    all.forEach((p, i) => {
        console.log(`  ${i + 1}. [${p.status}] ${p.name || p.id}`);
    });

} catch (e) {
    console.error('❌ ERROR:', e.message);
    console.error(e.stack);
}

console.log('\n=== FIN DEL DIAGNÓSTICO ===\n');
