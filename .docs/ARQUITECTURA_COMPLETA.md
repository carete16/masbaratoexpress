# 🏗️ ARQUITECTURA COMPLETA - MasbaratoExpress

## 📋 Resumen Ejecutivo

MasbaratoExpress es una plataforma de importación express desde USA a Colombia que permite a los administradores pegar enlaces de productos y calcular automáticamente el precio final en pesos colombianos (COP) con márgenes, impuestos y costos de envío incluidos.

---

## 🎯 Flujo Principal del Sistema

### 1. **Usuario Pega un Enlace** (Cualquier tienda USA)
```
Entrada: https://www.amazon.com/dp/B0DTNBH3GD?tag=slickdeals09-20&...
```

### 2. **LinkTransformer Limpia y Monetiza**
- ✅ Elimina parámetros de afiliados de terceros (`tag=slickdeals09-20`, `utm_*`, `creative`, etc.)
- ✅ Inyecta el código de afiliado propio para Amazon: `?tag=MASBARATO-20`
- ✅ Para otras tiendas (Walmart, Newegg, etc.), devuelve URL limpia (monetización vía Sovrn)

```
Salida: https://www.amazon.com/dp/B0DTNBH3GD?tag=MASBARATO-20
```

### 3. **Análisis Inteligente** (`/api/admin/express/analyze`)
- ✅ Detecta ASIN de Amazon automáticamente
- ✅ Categoriza el producto basándose en keywords en la URL:
  - `watch|smartwatch|garmin` → **Relojes & Wearables** (1 lb)
  - `shoe|sneaker|nike|adidas` → **Lifestyle & Street** (2 lbs)
  - `laptop|phone|gaming|headphone` → **Electrónica Premium** (5 lbs)

### 4. **Cálculo de Precio** (PriceEngine.js)

**Fórmula Exacta:**
```javascript
// 1. Aplicar margen del 30%
precio_con_margen = precio_usd * 1.30

// 2. Aplicar Tax USA del 7% (sobre precio con margen)
precio_con_tax = precio_con_margen * 1.07

// 3. Calcular peso con +1 libra de seguridad
finalWeight = Math.max(peso_lb + 1, peso_minimo)

// 4. Calcular envío
shippingCost = finalWeight * costo_por_libra_usd

// 5. Total USD
totalUsd = precio_con_tax + shippingCost

// 6. Conversión a COP con TRM operativa
operationalTrm = trm_base + 300

// 7. Redondeo SIEMPRE hacia arriba a la milena
finalCop = Math.ceil(totalUsd * operationalTrm / 1000) * 1000
```

**Ejemplo Real:**
```
Producto: $100 USD, 3 lbs
1. Margen: $100 * 1.30 = $130
2. Tax: $130 * 1.07 = $139.10
3. Peso: max(3 + 1, 4) = 4 lbs
4. Envío: 4 * $6 = $24
5. Total USD: $139.10 + $24 = $163.10
6. TRM: 3650 + 300 = 3950
7. COP: ceil(163.10 * 3950 / 1000) * 1000 = 645,000 COP
```

### 5. **Guardado con Estado "Pendiente"**
- ✅ El producto se guarda en la base de datos con `status = 'pendiente'`
- ✅ NO es visible en el catálogo público (`/api/products` solo muestra `status = 'disponible'`)
- ✅ Solo aparece en el panel de admin en la pestaña **PENDIENTES**

### 6. **Aprobación del Admin**
- ✅ El admin revisa el producto en PENDIENTES
- ✅ Puede editar: título, precio USD, peso, categoría
- ✅ Al hacer clic en **"APROBAR Y PUBLICAR"**, el status cambia a `'disponible'`
- ✅ Ahora SÍ aparece en el catálogo público

---

## 🗄️ Esquema de Base de Datos

### Tabla: `products`
```sql
CREATE TABLE products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    images TEXT, -- JSON array
    category TEXT CHECK(category IN ('Electrónica Premium', 'Lifestyle & Street', 'Relojes & Wearables')),
    status TEXT CHECK(status IN ('disponible', 'agotado', 'pendiente')) DEFAULT 'pendiente',
    
    -- Datos Internos
    source_link TEXT,
    price_usd REAL,
    trm_applied REAL,
    tax_usa_perc REAL DEFAULT 7.0,
    weight_lb REAL DEFAULT 4.0,
    cost_lb_usd REAL DEFAULT 6.0,
    margin_perc REAL DEFAULT 30.0,
    
    -- Calculado
    price_cop_final INTEGER,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Tabla: `settings`
```sql
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- Valores por defecto:
INSERT INTO settings VALUES ('trm_base', '3650');
INSERT INTO settings VALUES ('trm_offset', '300');
INSERT INTO settings VALUES ('cost_lb_default', '6');
INSERT INTO settings VALUES ('min_weight_default', '4');
```

---

## 🔧 Componentes Clave del Sistema

### 1. **LinkTransformer.js**
**Responsabilidad:** Limpiar y monetizar enlaces

**Parámetros que elimina:**
```javascript
const blacklist = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'tag', 'ref', 'ascsubtag', 'creative', 'camp', 'linkCode', 'ie',
    'm', 'psc', 'smid', 'pd_rd_*', 'pf_rd_*', 'qid', 'sr', 'keywords'
];
```

**Lógica de afiliación:**
```javascript
if (url.includes('amazon.')) {
    // Inyectar tag propio
    return `https://www.amazon.com/dp/${ASIN}?tag=MASBARATO-20`;
} else {
    // Otras tiendas: devolver URL limpia (Sovrn se encarga)
    return cleanUrl;
}
```

### 2. **PriceEngine.js**
**Responsabilidad:** Calcular precio final en COP

**Inputs:**
- `price_usd`: Precio del producto en USD
- `weight_lb`: Peso en libras
- `trm`: Tasa de cambio base
- `trm_offset`: Offset de 300 COP
- `cost_lb_usd`: Costo por libra de envío (default: $6)
- `min_weight`: Peso mínimo (default: 4 lbs)

**Output:**
```javascript
{
    price_usd: 100,
    weight_used: 5,        // Peso real + 1 lb de seguridad
    shipping_usd: 30,      // 5 lbs * $6
    tax_usd: 9.10,         // 7% sobre precio con margen
    margin_usd: 30,        // 30% de margen
    total_usd: 169.10,
    trm_applied: 3950,     // 3650 + 300
    final_cop: 668000      // Redondeado a la milena
}
```

### 3. **index.js - Endpoints Críticos**

#### `/api/admin/express/analyze` (POST)
```javascript
// Entrada: { url: "https://amazon.com/..." }
// Salida: {
//   url: "https://amazon.com/dp/ASIN?tag=MASBARATO-20",
//   title: "Producto Amazon ASIN: B0DTNBH3GD en AMAZON",
//   price: 1,
//   weight: 4,
//   categoria: "Electrónica Premium",
//   image: "https://placehold.co/400x400"
// }
```

#### `/api/admin/express/manual-post` (POST)
```javascript
// Entrada: { title, price, weight, category, url }
// Acción: 
// 1. Calcula precio final con PriceEngine
// 2. Inserta en DB con status='pendiente'
// Salida: { success: true, id: "EXPR-XXXXX" }
```

#### `/api/admin/express/pending` (GET)
```javascript
// Acción: SELECT * FROM products WHERE status='pendiente'
// Salida: Array de productos con mapeo de campos:
// {
//   title: item.name,
//   categoria: item.category,
//   link: item.source_link,
//   price_offer: item.price_usd,
//   weight: item.weight_lb,
//   tienda: "AMAZON",
//   image: "..."
// }
```

#### `/api/products` (GET - Catálogo Público)
```javascript
// Acción: SELECT * FROM products WHERE status='disponible'
// Solo muestra productos aprobados
```

---

## 🐛 Bugs Resueltos y Lecciones Aprendidas

### Bug #1: CHECK Constraint Failed
**Problema:** La DB no aceptaba `status='pendiente'`
**Causa:** El esquema original solo permitía `('disponible', 'agotado')`
**Solución:** Migración automática en `db.js` que detecta y actualiza el constraint

### Bug #2: Error al Cargar Datos
**Problema:** Frontend mostraba "Error al cargar datos" después de guardar
**Causa:** Mismatch de nombres de campos:
- Backend enviaba: `name`, `category`, `source_link`
- Frontend esperaba: `title`, `categoria`, `link`
**Solución:** Mapeo explícito de campos en los endpoints de lectura

### Bug #3: Categoría Siempre "Electrónica Premium"
**Problema:** No detectaba categorías correctamente
**Causa:** No había lógica de categorización basada en URL
**Solución:** Regex matching en `/analyze` endpoint:
```javascript
if (lowUrl.match(/watch|smartwatch/i)) categoria = "Relojes & Wearables";
else if (lowUrl.match(/shoe|sneaker|nike/i)) categoria = "Lifestyle & Street";
```

---

## 🚀 Deployment en Render.com

### Variables de Entorno
```bash
NODE_ENV=production
PORT=10000
```

### Build Command
```bash
./render-build.sh
```

### Start Command
```bash
node index.js
```

### Archivos Persistentes
- `src/database/deals.db` - Base de datos SQLite (se mantiene entre deploys)

---

## 📊 Flujo de Datos Completo

```
1. Admin pega URL
   ↓
2. Frontend llama /api/admin/express/analyze
   ↓
3. Backend:
   - LinkTransformer.transform(url) → URL limpia + monetizada
   - Detecta ASIN, categoría, peso estimado
   ↓
4. Frontend muestra resultado en modal
   ↓
5. Admin ajusta precio/peso/categoría y da "PROCESAR"
   ↓
6. Frontend llama /api/admin/express/manual-post
   ↓
7. Backend:
   - PriceEngine.calculate() → Precio final COP
   - INSERT INTO products con status='pendiente'
   ↓
8. Frontend recarga /api/admin/express/pending
   ↓
9. Backend:
   - SELECT * WHERE status='pendiente'
   - Mapea campos (name→title, category→categoria)
   ↓
10. Frontend renderiza lista de PENDIENTES
    ↓
11. Admin hace clic en "APROBAR Y PUBLICAR"
    ↓
12. Backend: UPDATE products SET status='disponible'
    ↓
13. Producto ahora visible en /api/products (catálogo público)
```

---

## 🔐 Seguridad

### Autenticación Admin
```javascript
headers: { 'x-admin-password': 'Masbarato2026' }
```

### SQL Injection Prevention
```javascript
// ✅ CORRECTO: Parameterized queries
db.prepare('SELECT * FROM products WHERE id = ?').get(id);

// ❌ INCORRECTO: String concatenation
db.prepare(`SELECT * FROM products WHERE id = '${id}'`).get();
```

---

## 📝 Checklist de Verificación

Antes de considerar un producto "listo":
- [ ] URL limpia sin parámetros de terceros
- [ ] Afiliado propio inyectado (Amazon) o URL limpia (otras tiendas)
- [ ] Categoría correcta asignada
- [ ] Peso realista (mínimo 4 lbs)
- [ ] Precio final COP redondeado a la milena
- [ ] Status = 'pendiente' al guardar
- [ ] Visible en pestaña PENDIENTES del admin
- [ ] NO visible en catálogo público hasta aprobar

---

## 🎓 Prompt Técnico Original (Referencia)

**Objetivo:** Calcular precio final en COP para productos importados desde USA

**Fórmula:**
1. Precio USD + 30% margen
2. Aplicar 7% Tax USA sobre precio con margen
3. Sumar envío: (peso + 1 lb) * $6/lb
4. Convertir a COP: total_usd * (TRM + 300)
5. Redondear hacia arriba a la milena

**Workflow:**
1. Admin pega link → Sistema limpia y monetiza
2. Sistema calcula precio automáticamente
3. Producto se guarda como "pendiente"
4. Admin aprueba → Producto pasa a "disponible"
5. Solo productos "disponibles" se muestran al público

---

## 📞 Contacto y Soporte

**Desarrollador:** Antigravity AI
**Proyecto:** MasbaratoExpress
**Versión:** 1.0.0
**Última Actualización:** 2026-02-06
