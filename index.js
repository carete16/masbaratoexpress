const http = require('http');
const port = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`
    <html>
      <head><title>MasbaratoDeals - Live</title></head>
      <body style="background:#000; color:#fff; font-family:sans-serif; text-align:center; padding-top:100px;">
        <div style="border:2px solid #00ff00; padding:50px; display:inline-block; border-radius:30px;">
          <h1 style="color:#00ff00; font-size:50px; margin-bottom:10px;">🔥 CONEXIÓN TOTAL 🔥</h1>
          <p style="font-size:24px; color:#aaa;">MasbaratoDeals está funcionando en Render.</p>
          <p style="font-weight:bold;">Estado: ONLINE ✅</p>
          <p style="font-size:14px; color:#555;">Puerto: ${port}</p>
        </div>
      </body>
    </html>
  `);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Servidor de emergencia corriendo en el puerto ${port}`);
});
