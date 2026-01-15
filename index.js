const express = require('express');
const app = express();
const port = process.env.PORT || 10000;

// Middleware para ver logs en Render
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - Petición: ${req.method} ${req.url}`);
  next();
});

// RESPUESTA DE EMERGENCIA (Si nada más funciona, esto aparecerá)
app.get('/', (req, res) => {
  res.send(`
        <body style="background:#0a0a0b; color:white; font-family:sans-serif; text-align:center; padding:50px;">
            <div style="border:2px solid #333; padding:40px; border-radius:20px; display:inline-block;">
                <h1 style="color:#00ff88; font-size:40px;">🚀 MASBARATODEALS ONLINE</h1>
                <p style="font-size:18px; color:#aaa;">El servidor ha despertado correctamente.</p>
                <hr style="border:0; border-top:1px solid #333; margin:20px 0;">
                <p>Si ves esto, la conexión GitHub -> Render está FUNCIONANDO.</p>
                <button onclick="location.reload()" style="background:#00ff88; color:black; border:0; padding:10px 20px; border-radius:5px; font-weight:bold; cursor:pointer;">
                    RECARGAR PAGINA
                </button>
            </div>
        </body>
    `);
});

app.get('/health', (req, res) => res.send('OK'));

app.listen(port, '0.0.0.0', () => {
  console.log(`>>> SERVIDOR ACTIVO EN PUERTO ${port} <<<`);
});
