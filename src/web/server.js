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

// API para estadísticas (Admin)
app.get('/api/stats', (req, res) => {
    try {
        const total = db.prepare('SELECT COUNT(*) as count FROM published_deals').get().count;
        const last24h = db.prepare("SELECT COUNT(*) as count FROM published_deals WHERE posted_at > datetime('now', '-24 hours')").get().count;
        const recentDeals = db.prepare('SELECT * FROM published_deals ORDER BY posted_at DESC LIMIT 10').all();

        res.json({
            total_published: total,
            last_24h: last24h,
            estimated_revenue: (total * 0.5).toFixed(2),
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
