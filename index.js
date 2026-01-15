const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 10000;

// Log para depuración en Render
console.log("Iniciando MasbaratoDeals...");

// Intentar encontrar el portal.html en las rutas posibles
const findPortal = () => {
  const paths = [
    path.join(__dirname, 'src', 'web', 'views', 'portal.html'),
    path.join(__dirname, 'portal.html'),
    path.join(__dirname, 'index.html')
  ];
  for (let p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
};

// Servir archivos estáticos (CSS, Imágenes)
app.use(express.static(path.join(__dirname, 'src', 'web', 'public')));
app.use(express.static(__dirname));

// RUTA MAESTRA
app.get('*', (req, res) => {
  const filePath = findPortal();
  if (filePath) {
    res.sendFile(filePath);
  } else {
    res.status(200).send(`
            <body style="background:#000; color:#0f0; font-family:sans-serif; text-align:center; padding:50px;">
                <h1>🚀 MASBARATODEALS ACTIVO</h1>
                <p>El servidor funciona, pero no encuentro el archivo portal.html.</p>
                <p>Buscando en: ${__dirname}</p>
            </body>
        `);
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor escuchando en puerto ${port}`);
});
