const express = require('express');
const app = express();
const port = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding-top: 50px; background-color: #f0f0f0;">
            <h1 style="color: #2e7d32; font-size: 48px;">🚀 ¡CONEXIÓN EXITOSA!</h1>
            <p style="font-size: 20px;">El servidor de MasbaratoDeals está funcionando en la nube.</p>
            <div style="background: white; padding: 20px; border-radius: 10px; display: inline-block; margin-top: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <p><strong>Estado:</strong> ONLINE ✅</p>
                <p><strong>Puerto:</strong> ${port}</p>
                <p><strong>URL:</strong> ${process.env.RENDER_EXTERNAL_URL || 'Local'}</p>
            </div>
        </body>
      </html>
    `);
});

app.get('/health', (req, res) => res.send('OK'));

app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
});
