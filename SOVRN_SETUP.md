# Configuración con Sovrn Commerce

## 🎯 ¿Qué es Sovrn Commerce?

Sovrn Commerce (anteriormente VigLink) es una **red agregadora de afiliados** que te permite monetizar enlaces de **cientos de tiendas** con un solo código:

- Amazon
- Walmart  
- eBay
- Best Buy
- Target
- Macy's
- Home Depot
- Y 30,000+ comercios más

## 🚀 Ventajas de Sovrn

✅ **Un solo registro**: No necesitas cuentas separadas  
✅ **Monetización automática**: Convierte cualquier enlace en afiliado  
✅ **Pagos centralizados**: Todo se paga desde Sovrn  
✅ **Tracking avanzado**: Reportes detallados por tienda  
✅ **Optimización**: Sovrn elige la mejor red de afiliados automáticamente

## 🔧 Configuración

### 1. Obtén tu API Key de Sovrn

1. Accede a tu dashboard de Sovrn: https://commerce.sovrn.com
2. Ve a **Settings** → **API Keys**
3. Copia tu **API Key**

### 2. Agrega al archivo `.env`

```env
# Sovrn Commerce (Recomendado - Monetiza todas las tiendas)
SOVRN_API_KEY=tu_api_key_de_sovrn
SOVRN_SUBID=masbarato

# Amazon Direct (Opcional - Solo si no usas Sovrn)
AMAZON_TAG=masbaratodeal-20
```

### 3. ¡Listo!

El sistema automáticamente:
- ✅ Limpiará enlaces de otros afiliados
- ✅ Convertirá TODOS los enlaces en afiliados (Amazon, Walmart, eBay, etc.)
- ✅ Optimizará para máximas comisiones
- ✅ Hará tracking de clicks y conversiones

## 💰 Estructura de Comisiones

Sovrn negocia las comisiones por ti:

| Tienda | Comisión Típica |
|--------|-----------------|
| Amazon | 1-10% |
| Walmart | 1-4% |
| eBay | 1-4% |
| Best Buy | 1-2% |
| Target | 1-8% |
| Otros | Variables |

## 📊 ¿Cuándo usar Sovrn vs Amazon Direct?

**Usa Sovrn si:**
- ✅ Quieres monetizar múltiples tiendas automáticamente
- ✅ Prefieres gestión centralizada
- ✅ Quieres diversificar fuentes de ingreso

**Usa Amazon Direct si:**
- Solo te enfocas en Amazon
- Ya tienes Amazon Associates configurado
- Quieres control total sobre el tag

## 🔄 Sistema Híbrido

El código soporta ambos:
1. Si `SOVRN_API_KEY` está configurado → Usa Sovrn (recomendado)
2. Si no → Usa tags directos de Amazon/Walmart/eBay

**¡Puedes cambiar entre uno y otro en cualquier momento!**

## 📈 Siguiente Paso

Agrega tu `SOVRN_API_KEY` al `.env` y reinicia el servidor. El bot comenzará a monetizar automáticamente enlaces de todas las tiendas.
