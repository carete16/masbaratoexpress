const express = require('express');
const path = require('path');
const { db } = require('../database/db');
const logger = require('../utils/logger');
require('dotenv').config();

const app = express();

// Rutas absolutas garantizadas
const viewsPath = path.resolve(__dirname, 'views');
const publicPath = path.resolve(__dirname, 'public');

// Servir archivos estáticos
app.use(express.static(publicPath));

// Logger de rutas para Render
app.use((req, res, next) => {
    logger.info(`Incoming request: ${req.method} ${req.url}`);
    next();
});

app.get('/health', (req, res) => {
    res.status(200).send('OK - Server is Live');
});

// API para obtener ofertas
app.get('/api/deals', (req, res) => {
    try {
        const deals = db.prepare('SELECT * FROM published_deals ORDER BY posted_at DESC LIMIT 24').all();
        res.json(deals || []);
    } catch (error) {
        logger.error(`API Error: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// Redirección con tracking
app.get('/go/:id', (req, res) => {
    try {
        const dealId = req.params.id;
        const deal = db.prepare('SELECT link FROM published_deals WHERE id = ?').get(dealId);
        if (deal) {
            db.prepare('UPDATE published_deals SET clicks = clicks + 1 WHERE id = ?').run(dealId);
            return res.redirect(deal.link);
        }
        res.status(404).send('Oferta no encontrada');
    } catch (error) {
        res.status(500).send('Error');
    }
});

// Rutas de las páginas
app.get('/', (req, res) => {
    const file = path.join(viewsPath, 'portal.html');
    res.sendFile(file, (err) => {
        if (err) {
            logger.error(`Error sending portal.html: ${err.message}`);
            res.status(500).send('Error loading page structure');
        }
    });
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(viewsPath, 'index.html'));
});

// Páginas legales
['privacy', 'terms', 'about', 'contact'].forEach(p => {
    app.get(`/${p}`, (req, res) => {
        res.sendFile(path.join(viewsPath, `${p}.html`));
    });
});

// Estadísticas para el Admin
app.get('/api/stats', (req, res) => {
    try {
        const total = db.prepare('SELECT COUNT(*) as count FROM published_deals').get().count;
        const totalClicks = db.prepare('SELECT SUM(clicks) as clicks FROM published_deals').get().clicks || 0;
        const recentDeals = db.prepare('SELECT * FROM published_deals ORDER BY posted_at DESC LIMIT 10').all();
        res.json({
            total_published: total,
            total_clicks: totalClicks,
            estimated_revenue: (totalClicks * 0.15).toFixed(2),
            recent_deals: recentDeals
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

function startServer(port = 4000) {
    app.listen(port, '0.0.0.0', () => {
        logger.info(`🌐 Servidor activo en puerto ${port}`);
    });
}

module.exports = { startServer };
