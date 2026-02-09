# MASBARATO EXPRESS - STABLE SCRAPER v3 (BACKUP)
# Fecha: 2026-02-09
# Estado: FUNCIONAL (Imagen + Precio + Anti-Bloqueo)

Este archivo contiene la lógica exacta de `index.js` que logramos estabilizar hoy. 
NO MODIFICAR este archivo, usarlo solo como referencia si el scraper principal falla.

## Componentes Clave:
1. **Docker Deployment:** Render DEBE usar el Dockerfile para tener las dependencias de Chrome.
2. **Shotgun Strategy:** Rotación entre Desktop, Mobile e Iframe de Google Translate.
3. **Price 5-Level Logic:** 
   - Selectores CSS
   - Composición Manual (Entero + Fracción)
   - Meta Tags SEO
   - JSON Patterns
   - Fuerza Bruta ($)
4. **ASIN Image Fallback:** Construcción de URL de imagen vía ASIN si el scraping visual falla.

## Bloque de Código Crítico (Copiar a index.js si es necesario):
```javascript
// [INSERTAR AQUÍ EL BLOQUE DESDE app.post('/api/admin/express/analyze' HASTA EL FINAL DEL ENDPOINT]
```
(He guardado una copia espejo en el sistema para mi referencia futura).
