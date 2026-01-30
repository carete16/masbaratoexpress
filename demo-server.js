const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.static('public'));
app.use(express.json());

// Mock API para pruebas
app.get('/api/deals', (req, res) => {
    const mockDeals = [
        {
            id: '1',
            title: 'Apple AirPods Pro (2nd Generation) - Active Noise Cancellation',
            price_offer: 189.99,
            price_official: 249.99,
            tienda: 'Amazon',
            categoria: 'Tecnología',
            image: 'https://m.media-amazon.com/images/I/61SUj2aKoEL._AC_SL1500_.jpg',
            link: 'https://amazon.com'
        },
        {
            id: '2',
            title: 'Nike Air Max 270 - Men\'s Running Shoes',
            price_offer: 89.97,
            price_official: 150.00,
            tienda: 'Nike',
            categoria: 'Moda',
            image: 'https://static.nike.com/a/images/t_PDP_1728_v1/f_auto,q_auto:eco/awjogtdnqxniqqk0wpgf/air-max-270-mens-shoes-KkLcGR.png',
            link: 'https://nike.com'
        },
        {
            id: '3',
            title: 'PlayStation 5 Console - Slim Edition',
            price_offer: 449.99,
            price_official: 499.99,
            tienda: 'Best Buy',
            categoria: 'Gamer',
            image: 'https://pisces.bbystatic.com/image2/BestBuy_US/images/products/6566/6566039_sd.jpg',
            link: 'https://bestbuy.com'
        },
        {
            id: '4',
            title: 'Instant Pot Duo 7-in-1 Electric Pressure Cooker',
            price_offer: 79.99,
            price_official: 119.99,
            tienda: 'Walmart',
            categoria: 'Hogar',
            image: 'https://i5.walmartimages.com/seo/Instant-Pot-Duo-7-in-1-Electric-Pressure-Cooker-Slow-Cooker-Rice-Cooker-Steamer-Saute-Yogurt-Maker-Warmer-Sterilizer-6-Quart-14-One-Touch-Programs_2b0a98e8-e1e3-4c5d-b1f3-c8e1e1e1e1e1.jpg',
            link: 'https://walmart.com'
        },
        {
            id: '5',
            title: 'Samsung Galaxy Buds2 Pro - Wireless Earbuds',
            price_offer: 149.99,
            price_official: 229.99,
            tienda: 'Amazon',
            categoria: 'Tecnología',
            image: 'https://m.media-amazon.com/images/I/61jJO7R3XML._AC_SL1500_.jpg',
            link: 'https://amazon.com'
        },
        {
            id: '6',
            title: 'Adidas Ultraboost 22 - Women\'s Running Shoes',
            price_offer: 119.97,
            price_official: 190.00,
            tienda: 'Adidas',
            categoria: 'Moda',
            image: 'https://assets.adidas.com/images/h_840,f_auto,q_auto,fl_lossy,c_fill,g_auto/fbaf991a78bc4896a3e9ad7800abcec6_9366/Ultraboost_22_Shoes_Black_GZ0127_01_standard.jpg',
            link: 'https://adidas.com'
        }
    ];

    res.json(mockDeals);
});

app.get('/api/status', (req, res) => {
    res.json({
        online: true,
        bot_status: 'Demo Mode',
        time: new Date().toISOString()
    });
});

app.post('/api/subscribe', (req, res) => {
    res.json({ success: true, message: '¡Gracias por suscribirte!' });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor DEMO corriendo en http://localhost:${PORT}`);
    console.log(`📱 Abre en tu navegador para ver la interfaz MOBILE-FIRST`);
    console.log(`💡 Usa DevTools (F12) y activa modo móvil para mejor experiencia`);
});
