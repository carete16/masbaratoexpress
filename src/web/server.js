const express = require('express');
const path = require('path');
const { db } = require('../database/db');
const logger = require('../utils/logger');
require('dotenv').config();

const app = express();
const viewsPath = path.join(__dirname, 'views');
const publicPath = path.join(__dirname, 'public');

app.use(express.static(publicPath));

app.get('/health', (req, res) => {
    res.send('OK - Server is Live');
});

// API para obtener ofertas (Pública)
app.get('/api/deals', (req, res) => {
    try {
        const deals = db.prepare('SELECT * FROM published_deals ORDER BY posted_at DESC LIMIT 24').all();
        res.json(deals);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// MOTOR DE REDIRECCIÓN Y TRACKING
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
        res.status(500).send('Error en la redirección.');
    }
});

// API para estadísticas (Admin)
app.get('/api/stats', (req, res) => {
    try {
        const total = db.prepare('SELECT COUNT(*) as count FROM published_deals').get().count;
        const totalClicks = db.prepare('SELECT SUM(clicks) as clicks FROM published_deals').get().clicks || 0;
        const last24h = db.prepare("SELECT COUNT(*) as count FROM published_deals WHERE posted_at > datetime('now', '-24 hours')").get().count;
        const recentDeals = db.prepare('SELECT * FROM published_deals ORDER BY posted_at DESC LIMIT 10').all();

        res.json({
            total_published: total,
            total_clicks: totalClicks,
            last_24h: last24h,
            estimated_revenue: (totalClicks * 0.15).toFixed(2),
            recent_deals: recentDeals
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rutas de Páginas
app.get('/', (req, res) => res.sendFile(path.join(viewsPath, 'portal.html')));
app.get('/privacy', (req, res) => res.sendFile(path.join(viewsPath, 'privacy.html')));
app.get('/terms', (req, res) => res.sendFile(path.join(viewsPath, 'terms.html')));
app.get('/about', (req, res) => res.sendFile(path.join(viewsPath, 'about.html')));
app.get('/contact', (req, res) => res.sendFile(path.join(viewsPath, 'contact.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(viewsPath, 'index.html')));

function startServer(port = 4000) {
    app.listen(port, '0.0.0.0', () => {
        logger.info(`🌐 SITIO WEB PÚBLICO: http://localhost:${port}`);
    });
}

module.exports = { startServer };
