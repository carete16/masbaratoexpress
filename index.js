const express = require('express');
const app = express();
const path = require('path');

// Puerto dinámico que Render asigna
const PORT = process.env.PORT || 3000;

// Configuración de Servidor Estático
// Render buscará automáticamente el index.html en esta carpeta
app.use(express.static(path.join(__dirname, 'public')));

// Ruta de respaldo: Si no encuentra nada, envía el index
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Arranque
app.listen(PORT, () => {
  console.log(`✅ SERVIDOR WEB ESCUCHANDO EN PUERTO ${PORT}`);
  console.log(`📂 Sirviendo archivos desde: ${path.join(__dirname, 'public')}`);
});
