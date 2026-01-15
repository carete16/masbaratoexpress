const express = require('express');
const path = require('path');
const { db } = require('../database/db');
const logger = require('../utils/logger');
require('dotenv').config();

const app = express();

// Rutas absolutas para Render
const viewsPath = path.resolve(__dirname, 'views');
const publicPath = path.resolve(__dirname, 'public');

app.use(express.static(publicPath));

// Endpoint de prueba rápida
app.get('/test', (req, res) => {
    res.send('<h1>🚀 EL SERVIDOR ESTA VIVO</h1><p>Si ves esto, el bot esta funcionando. Buscando portal.html...</p>');
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// API para la web
app.get('/api/deals', (req, res) => {
    try {
        const deals = db.prepare('SELECT * FROM published_deals ORDER BY posted_at DESC LIMIT 24').all();
        res.json(deals || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Portal Principal con manejo de error explícito
app.get('/', (req, res) => {
    const portalFile = path.join(viewsPath, 'portal.html');
    res.sendFile(portalFile, (err) => {
        if (err) {
            logger.error(`Error cargando portal.html: ${err.message}`);
            res.status(500).send(`Error critico: No se encuentra el archivo portal.html en ${viewsPath}.`);
        }
    });
});

// Otras rutas
app.get('/admin', (req, res) => res.sendFile(path.join(viewsPath, 'index.html')));
app.get('/go/:id', (req, res) => {
    try {
        const deal = db.prepare('SELECT link FROM published_deals WHERE id = ?').get(req.params.id);
        if (deal) {
            db.prepare('UPDATE published_deals SET clicks = clicks + 1 WHERE id = ?').run(req.params.id);
            return res.redirect(deal.link);
        }
        res.status(404).send('Oferta expirada');
    } catch (e) { res.status(500).send('Error'); }
});

// Newsletter API
app.use(express.json());
app.post('/api/newsletter', (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'Email inválido' });
        }

        // Create newsletter table if not exists
        db.exec(`
            CREATE TABLE IF NOT EXISTS newsletter_subscribers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                active INTEGER DEFAULT 1
            )
        `);

        // Insert subscriber
        const stmt = db.prepare('INSERT OR IGNORE INTO newsletter_subscribers (email) VALUES (?)');
        stmt.run(email);

        logger.info(`Nueva suscripción: ${email}`);
        res.status(200).json({ success: true });
    } catch (error) {
        logger.error(`Error newsletter: ${error.message}`);
        res.status(500).json({ error: 'Error al suscribir' });
    }
});

// Sitemap for SEO
app.get('/sitemap.xml', (req, res) => {
    try {
        const deals = db.prepare('SELECT id, posted_at FROM published_deals ORDER BY posted_at DESC LIMIT 100').all();
        const baseUrl = 'https://masbaratodeals-net.onrender.com';

        let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>${baseUrl}/</loc>
        <changefreq>hourly</changefreq>
        <priority>1.0</priority>
    </url>`;

        deals.forEach(deal => {
            sitemap += `
    <url>
        <loc>${baseUrl}/go/${deal.id}</loc>
        <lastmod>${deal.posted_at}</lastmod>
        <changefreq>daily</changefreq>
        <priority>0.8</priority>
    </url>`;
        });

        sitemap += '\n</urlset>';

        res.header('Content-Type', 'application/xml');
        res.send(sitemap);
    } catch (e) {
        res.status(500).send('Error generating sitemap');
    }
});

// Static pages routes
app.get('/privacy', (req, res) => res.sendFile(path.join(viewsPath, 'privacy.html')));
app.get('/terms', (req, res) => res.sendFile(path.join(viewsPath, 'terms.html')));
app.get('/about', (req, res) => res.sendFile(path.join(viewsPath, 'about.html')));
app.get('/contact', (req, res) => res.sendFile(path.join(viewsPath, 'contact.html')));

function startServer(port = 4000) {
    app.listen(port, '0.0.0.0', () => {
        logger.info(`🌐 Servidor en puerto ${port}`);
    });
}

module.exports = { startServer };
