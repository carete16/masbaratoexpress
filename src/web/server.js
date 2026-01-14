const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const logger = require('../utils/logger');
require('dotenv').config();

const app = express();
const db = new Database(path.resolve(__dirname, '../database/deals.db'));

app.use(express.static(path.join(__dirname, 'public')));

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
            // Registrar click
            db.prepare('UPDATE published_deals SET clicks = clicks + 1 WHERE id = ?').run(dealId);
            // Redirigir
            return res.redirect(deal.link);
        }
        res.status(404).send('Oferta no encontrada o expirada.');
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
            estimated_revenue: (totalClicks * 0.15).toFixed(2), // Estimación más conservadora por clic (EPC)
            recent_deals: recentDeals
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Portal Público de Ofertas (Lo que verá Amazon)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/portal.html'));
});

// Páginas Legales y Corporativas (Vital para Amazon)
app.get('/privacy', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/privacy.html'));
});

app.get('/terms', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/terms.html'));
});

app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/about.html'));
});

app.get('/contact', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/contact.html'));
});

// Dashboard de Control (Solo para el dueño)
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/index.html'));
});

function startServer(port = 4000) {
    app.listen(port, '0.0.0.0', () => {
        logger.info(`🌐 SITIO WEB PÚBLICO: http://localhost:${port}`);
        logger.info(`📊 DASHBOARD ADMIN: http://localhost:${port}/admin`);
    });
}

module.exports = { startServer };
