const db = require('./src/database/db');
const PriceEngine = require('./src/core/PriceEngine');

const products = [
    {
        name: 'iPhone 15 Pro Max - 256GB Platinum',
        description: 'Lo último en tecnología de Apple. Pantalla Super Retina XDR y chip A17 Pro.',
        category: 'Electrónica Premium',
        price_usd: 1199,
        weight_lb: 1.5,
        source_link: 'https://amazon.com/iphone15promax',
        images: ['https://m.media-amazon.com/images/I/81Os13RBOnL._AC_SL1500_.jpg']
    },
    {
        name: 'Nike Air Jordan 1 Retro Low OG',
        description: 'Estilo clásico del baloncesto. Cuero premium y amortiguación Air-Sole.',
        category: 'Lifestyle & Street',
        price_usd: 140,
        weight_lb: 5.0,
        source_link: 'https://nike.com/jordan1',
        images: ['https://static.nike.com/a/images/t_PDP_1280_v1/f_auto,q_auto:eco/603ca9cc-e975-43a9-a78b-d7a86f1e84a2/AIR+JORDAN+1+LOW+OG.png']
    },
    {
        name: 'Apple Watch Ultra 2 - Ocean Band',
        description: 'El reloj más capaz y resistente. Caja de titanio de 49 mm y GPS de doble frecuencia.',
        category: 'Relojes & Wearables',
        price_usd: 799,
        weight_lb: 1.0,
        source_link: 'https://amazon.com/applewatchultra2',
        images: ['https://m.media-amazon.com/images/I/71Ydb-8eZlL._AC_SL1500_.jpg']
    }
];

const trm = 3650;
const trm_offset = 300;
const cost_lb = 6;

const insertProduct = db.prepare(`
    INSERT INTO products (
        id, name, description, images, category, source_link, 
        price_usd, trm_applied, weight_lb, price_cop_final
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

products.forEach(p => {
    const calc = PriceEngine.calculate({
        price_usd: p.price_usd,
        weight_lb: p.weight_lb,
        trm,
        trm_offset,
        cost_lb_usd: cost_lb
    });

    const id = 'SEED-' + Math.random().toString(36).substr(2, 5).toUpperCase();

    insertProduct.run(
        id, p.name, p.description, JSON.stringify(p.images), p.category, p.source_link,
        p.price_usd, calc.trm_applied, calc.weight_used, calc.final_cop
    );
});

console.log('✅ Base de datos sembrada con productos de prueba.');
process.exit(0);
