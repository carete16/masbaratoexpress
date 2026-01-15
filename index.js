const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 10000;

// Log para Render
console.log(">>> MASBARATODEALS: MODO ALTA COMPATIBILIDAD <<<");

// Servir archivos estáticos DESDE LA RAÍZ Y DESDE PUBLIC
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// RUTA MAESTRA: Servir index.html de la carpeta public
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Servidor ONLINE en puerto ${port}`);
});
