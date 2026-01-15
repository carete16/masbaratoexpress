const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 10000;

console.log(">>> SISTEMA DE EMERGENCIA NIVEL 0 INICIADO <<<");

// Servir la web que está en la raíz directamente
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Servidor ONLINE en puerto ${port}`);
});
