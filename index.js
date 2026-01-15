const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 10000;

// Log visual en consola de Render
console.log("-----------------------------------------");
console.log("🚀 ARRANCANDO MASBARATODEALS EN LA NUBE");
console.log("-----------------------------------------");

// Servir archivos estáticos si existen
const publicPath = path.join(__dirname, 'src', 'web', 'public');
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
}

// RUTA MAESTRA (Carga la web premium)
app.get('/', (req, res) => {
  const portalPath = path.join(__dirname, 'src', 'web', 'views', 'portal.html');

  if (fs.existsSync(portalPath)) {
    res.sendFile(portalPath);
  } else {
    // Si el archivo falta por alguna razón, mostramos una web de emergencia bonita
    res.send(`
            <body style="background:#0a0a0b; color:white; font-family:sans-serif; text-align:center; padding:100px;">
                <h1 style="color:#ff4d4d;">⚠️ Sistema en Reconfiguración</h1>
                <p>La plataforma está online pero falta el archivo portal.html.</p>
                <p>Verificando rutas internas...</p>
                <div style="background:#1a1a1c; padding:20px; border-radius:10px; display:inline-block;">
                    Ruta buscada: ${portalPath}
                </div>
            </body>
        `);
  }
});

// Endpoint de salud para Render
app.get('/health', (req, res) => res.status(200).send('OK'));

app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Servidor en línea en el puerto ${port}`);
});
