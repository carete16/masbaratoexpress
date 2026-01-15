const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send(`
    <div style="font-family:sans-serif; text-align:center; padding:50px;">
        <h1 style="color:green; font-size: 50px;">🚀 ¡VIVO!</h1>
        <p>El servidor MasbaratoDeals está online.</p>
        <p>Versión: Minimal Safe Mode</p>
    </div>
  `);
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on port ${port}`);
});
