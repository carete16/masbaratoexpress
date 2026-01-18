# 🎯 Masbarato Deals Bot - Professional Edition

Sistema híbrido de cacería de ofertas con IA, monetización automática y control manual de precisión.

## 🚀 Cómo publicar OFERTAS MANUALES (Recomendado)

Esta es la forma más potente de usar el sistema para facturar. Tú eliges la oferta y el bot hace el trabajo sucio.

1.  Abre una terminal en la carpeta del proyecto.
2.  Ejecuta el comando:
    ```bash
    node manual_post.js "URL_DE_EBAY_AMAZON_O_WALMART" [PRECIO]
    ```
3.  **¿Qué pasará?**
    - El bot **limpia el link** de códigos externos.
    - El bot **inyecta tus códigos de afiliado** automáticamente.
    - La IA redacta un **post profesional** y persuasivo.
    - La oferta se publica en **Telegram** y en la **Web** al instante.

## 🛠️ Configuración Inicial

1.  **Instalación:** Ejecuta `npm install`.
2.  **Variables (.env):** 
    - `TELEGRAM_BOT_TOKEN`: Token de @BotFather.
    - `TELEGRAM_CHANNEL_ID`: ID o @alias de tu canal.
    - `AMAZON_TAG`, `EBAY_CAMPAIGN_ID`, `WALMART_ID`: Tus IDs de afiliado.
    - `OPENAI_API_KEY`: Para redacción con IA (opcional, tiene fallback).

## 📁 Características Principales

- **Dashboard Web Premium:** Visualiza todas las ofertas publicadas en `http://localhost:3000`.
- **Limpiador Químico de Enlaces:** Elimina rastros de Slickdeals, grupos de Telegram ajenos y redireccionadores.
- **Sitemap Dinámico:** Optimizado para aparecer en Google Search Console y Discover.
- **Always-On:** Sistema de latido (Heartbeat) para evitar que Render suspenda la aplicación.

## 📁 Estructura
- `manual_post.js`: Tu herramienta principal para publicar hoy.
- `/src/core`: Los "bots" internos de validación y simulación de navegador.
- `/src/utils`: Motores de limpieza de links y logger.
- `/public`: Interfaz web de usuario.

---
**Potenciado por MasbaratoDeals Team.**
