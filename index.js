const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 10000;

console.log("-----------------------------------------");
console.log("🚀 MASBARATODEALS - ARRANQUE GARANTIZADO");
console.log("-----------------------------------------");

// 1. CARPETAS ESTÁTICAS (Búsqueda agresiva)
const staticDirs = ['public', 'src/web/public', 'src/web/views', '.'];
staticDirs.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (fs.existsSync(fullPath)) {
    app.use(express.static(fullPath));
    console.log(`✅ Serviendo estáticos desde: ${dir}`);
  }
});

// 2. BUSCADOR DE INDEX (Encuentra portal.html o index.html donde sea)
const getIndexPath = () => {
  const possibleFiles = [
    'public/index.html',
    'index.html',
    'src/web/views/portal.html',
    'src/web/views/index.html'
  ];
  for (let f of possibleFiles) {
    const p = path.join(__dirname, f);
    if (fs.existsSync(p)) return p;
  }
  return null;
};

// 3. RUTA PRINCIPAL
app.get('/', (req, res) => {
  const indexPath = getIndexPath();
  if (indexPath) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send(`
            <body style="background:#000; color:#ff4d4d; font-family:sans-serif; text-align:center; padding:100px;">
                <h1>⚠️ ERROR DE ESTRUCTURA</h1>
                <p>El servidor funciona, pero no encuentro archivos HTML.</p>
                <div style="background:#1a1a1c; color:#aaa; padding:20px; border-radius:10px; display:inline-block; text-align:left;">
                    Directorio actual: ${__dirname}<br>
                    Archivos presentes: ${fs.readdirSync(__dirname).join(', ')}
                </div>
            </body>
        `);
  }
});

app.get('/health', (req, res) => res.status(200).send('OK'));

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 SERVIDOR EN PUERTO: ${port}`);
});
