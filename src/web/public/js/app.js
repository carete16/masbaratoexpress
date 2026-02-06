document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
});

/**
 * CARGAR PRODUCTOS DEL CATÁLOGO
 */
async function loadProducts() {
    const container = document.getElementById('product-container');
    if (!container) return;

    try {
        const response = await fetch('/api/products');
        const products = await response.json();

        if (products.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 50px;">
                    <h3 style="color: var(--text-muted);">No hay productos disponibles en este momento.</h3>
                    <p>Vuelve pronto para ver nuestras novedades.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = products.map(p => `
            <div class="card">
                <span class="card-badge">${p.category}</span>
                <img src="${p.images[0] || 'https://via.placeholder.com/300'}" alt="${p.name}" class="card-img">
                <h3 style="font-size: 1.1rem; font-weight: 800; margin-bottom: 5px;">${p.name}</h3>
                <div class="card-price">$ ${new Intl.NumberFormat('es-CO').format(p.price_cop_final)}</div>
                <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 15px;">Precio final con impuestos y envío.</p>
                <div style="display: flex; gap: 10px;">
                    <button class="btn btn-primary" style="flex: 1; padding: 10px; font-size: 0.8rem;" onclick="viewProduct('${p.id}')">Ver Detalle</button>
                    <button class="btn" style="background: #f1f5f9; padding: 10px;" onclick="addToCart('${p.id}')"><i class="fa-solid fa-cart-plus"></i></button>
                </div>
            </div>
        `).join('');

    } catch (e) {
        container.innerHTML = `<p style="color: var(--accent-danger);">Error al cargar el catálogo.</p>`;
    }
}

function viewProduct(id) {
    location.href = `/product/${id}`;
}

function addToCart(id) {
    alert('Función de carrito en desarrollo. Serás redirigido al flujo de pago 50/50.');
}
