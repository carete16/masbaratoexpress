# 🎯 Masbarato Deals Bot - Professional Edition

Sistema automatizado de cacería de ofertas con IA, monetización y dashboard de control.

## 🚀 Inicio Rápido

1.  **Instalación:** Ejecuta `npm install` en la carpeta raíz.
2.  **Configuración:** Edita el archivo `.env` con tus tokens (Telegram, IA, Email).
3.  **Lanzamiento:** Haz doble clic en `INICIAR_SISTEMA.bat`.

## 🛠️ Características Expertas

### 1. Cerebro con IA (AIProcessor)
Utiliza **LLMs (GPT-3.5/4)** para transformar una oferta aburrida en un post viral irresistible. Si no hay API Key, el sistema usa un motor de respaldo profesional.

### 2. Dashboard Premium
Accede a `http://localhost:3000` para ver:
- Estadísticas en tiempo real.
- Gráficas de rendimiento.
- Historial de ofertas publicadas.

### 3. Monetización Automática
El `LinkTransformer` inyecta tus IDs de afiliado (Amazon, AliExpress, etc.) en cada enlace antes de publicarlo.

### 4. Control de Duplicados (Smart Fingerprint)
Usa SQLite para asegurar que no se repita ninguna oferta en un rango de 72 horas, manteniendo el canal limpio y profesional.

### 5. Nichos y Escalabilidad
Soporta múltiples canales de Telegram. Puedes dirigir ofertas de tecnología a un canal y de moda a otro automáticamente.

### 6. Reportes Diarios
Recibe un resumen ejecutivo en tu email cada noche a las 10:00 PM con las métricas del día.

## 📁 Estructura del Código
- `/collectors`: Scrapers de alta estabilidad (RSS, MercadoLibre, Global).
- `/core`: Lógica de IA, filtros y procesamiento de datos.
- `/database`: Persistencia de datos con SQLite.
- `/notifiers`: Puentes de comunicación (Telegram, Email).
- `/web`: Servidor Express y UI del Dashboard.

---
**Desarrollado para Google Gravity / Agravity por Antigravity Expert.**
