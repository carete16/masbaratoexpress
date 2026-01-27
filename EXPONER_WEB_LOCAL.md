# GUÍA RÁPIDA: Exponer el Bot Local a Internet

## Paso 1: Instalar ngrok
1. Ve a: https://ngrok.com/download
2. Descarga la versión para Windows
3. Descomprime el archivo `ngrok.exe` en una carpeta (ej: `C:\ngrok\`)

## Paso 2: Crear cuenta gratuita (opcional pero recomendado)
1. Ve a: https://dashboard.ngrok.com/signup
2. Crea una cuenta gratuita
3. Copia tu "Authtoken" del dashboard
4. En la terminal, ejecuta:
   ```
   ngrok config add-authtoken TU_TOKEN_AQUI
   ```

## Paso 3: Exponer tu servidor
En una NUEVA terminal (deja la otra con `node index.js` corriendo):
```bash
cd C:\ngrok
ngrok http 10000
```

## Paso 4: Copiar la URL pública
ngrok te mostrará algo como:
```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:10000
```

Copia esa URL (ej: `https://abc123.ngrok-free.app`)

## Paso 5: Compartir la URL
Esa es tu URL pública temporal. Compártela con quien quieras:
- `https://abc123.ngrok-free.app` → Página principal con ofertas
- `https://abc123.ngrok-free.app/api/deals` → API JSON

## ⚠️ IMPORTANTE:
- La URL cambia cada vez que reinicias ngrok
- Si cierras ngrok o tu computadora, la web dejará de funcionar
- Es perfecto para pruebas y demos, pero no para producción 24/7

## 🔄 Alternativa: Usar un dominio fijo (ngrok Pro)
Si quieres una URL que no cambie:
1. Suscríbete a ngrok Pro ($8/mes)
2. Obtendrás un dominio fijo como `tuapp.ngrok.io`

## 📊 Monitoreo
Con ngrok corriendo, podrás:
- Ver las ofertas en tiempo real en la web
- Inspeccionar todas las peticiones HTTP en http://127.0.0.1:4040
- Compartir la URL con amigos/clientes para que vean las ofertas

---

## Resumen de Comandos:
```bash
# Terminal 1 (ya está corriendo):
node index.js

# Terminal 2 (nueva):
ngrok http 10000
```

¡Listo! Tu bot local ahora es accesible desde internet 🌐
