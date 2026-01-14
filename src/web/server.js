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

function startServer(port = 4000) {
    app.listen(port, '0.0.0.0', () => {
        logger.info(`🌐 Servidor en puerto ${port}`);
    });
}

module.exports = { startServer };
