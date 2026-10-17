/**
 * Tamtamarindo - Aplicación de Catálogo
 * Este script maneja la lógica principal de la tienda: filtrado de productos, 
 * gestión del carrito de compras (usando LocalStorage) y renderizado dinámico.
 */
(() => {
	// --- SELECCIÓN DE ELEMENTOS DEL DOM ---
	// Contenedores principales
	const productGrid = document.querySelector("#productGrid");
	const productCount = document.querySelector("#productCount");
	const emptyState = document.querySelector("#emptyState");
	
	// Controles de filtrado y búsqueda
	const searchInput = document.querySelector("#productSearch");
	const sortSelect = document.querySelector("#productSort");
	const clearFiltersButton = document.querySelector(".clear-filters");
	const categoryButtons = document.querySelectorAll("[data-category]");
	
	// Elementos del carrito (Offcanvas)
	const cartItems = document.querySelector("#cartItems");
	const cartEmpty = document.querySelector("#cartEmpty");
	const cartFooter = document.querySelector("#cartFooter");
	const cartSubtotal = document.querySelector("#cartSubtotal");
	const orderButton = document.querySelector("#copyOrder");

	// --- CONFIGURACIÓN Y ESTADO INICIAL ---
	// Formateador de moneda para pesos chilenos (ej: $ 1.000)
	const currency = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
	
	// Claves para el almacenamiento local (LocalStorage)
	const cartStorageKey = "casa-botanica-cart";
	const favoriteStorageKey = "casa-botanica-favorites";
	
	// Mapa para búsqueda rápida de productos por ID (mejora el rendimiento)
	const productLookup = new Map(catalogProducts.map((product) => [product.id, product]));
	
	// Variables de estado global de la sesión
	let activeCategory = "Todos";
	let cart = readStorage(cartStorageKey, {});
	let favorites = new Set(readStorage(favoriteStorageKey, []));

	/**
	 * Lee datos desde LocalStorage con manejo de errores para evitar fallos si el JSON es inválido.
	 * @param {string} key - Clave a buscar
	 * @param {*} fallback - Valor por defecto si no existe o hay error
	 */
	function readStorage(key, fallback) {
		try {
			const value = JSON.parse(localStorage.getItem(key));
			return value ?? fallback;
		} catch {
			return fallback;
		}
	}

	/**
	 * Guarda datos en LocalStorage de forma segura.
	 * @param {string} key - Clave para guardar
	 * @param {*} value - Valor a serializar a JSON
	 */
	function saveStorage(key, value) {
		try {
			localStorage.setItem(key, JSON.stringify(value));
		} catch {
			// El catálogo sigue funcionando incluso si el almacenamiento no está disponible (ej. modo incógnito)
		}
	}

	/**
	 * Calcula el porcentaje de descuento basado en precio original y oferta.
	 */
	function discount(product) {
		return Math.round((1 - product.offerPrice / product.price) * 100);
	}

	/**
	 * Obtiene un objeto de producto completo por su ID.
	 */
	function getProductById(id) {
		return productLookup.get(id) || null;
	}

	/**
	 * Función de optimización para la búsqueda.
	 * Evita que el filtrado se ejecute en cada pulsación de tecla, esperando un breve silencio.
	 */
	function debounce(callback, delay = 120) {
		let timeoutId;
		return (...args) => {
			window.clearTimeout(timeoutId);
			timeoutId = window.setTimeout(() => callback(...args), delay);
		};
	}

	/**
	 * Genera la estructura HTML (template literal) para una tarjeta de producto.
	 * Incluye lógica para determinar si es favorito y aplicar clases CSS dinámicas.
	 */
	function productCard(product) {
		const isFavorite = favorites.has(product.id);
		return `
			<article class="product-card">
				<div class="product-image-wrap">
					<img class="product-image" src="${product.image}" alt="${product.name}" loading="lazy">
					<span class="sale-label">-${discount(product)}%</span>
					<button class="favorite-button${isFavorite ? " is-favorite" : ""}" type="button" data-favorite="${product.id}" aria-label="${isFavorite ? "Quitar de" : "Agregar a"} favoritos" aria-pressed="${isFavorite}"><i class="bi ${isFavorite ? "bi-heart-fill" : "bi-heart"}" aria-hidden="true"></i></button>
					<button class="quick-add" type="button" data-add="${product.id}"><i class="bi bi-plus-lg" aria-hidden="true"></i><span>Agregar</span></button>
				</div>
				<div class="product-info">
					<div class="product-meta"><span>${product.category}</span><span>${product.size}</span></div>
					<h3>${product.name}</h3>
					<p>${product.description}</p>
					<div class="product-prices"><strong>${currency.format(product.offerPrice)}</strong><del>${currency.format(product.price)}</del></div>
				</div>
			</article>`;
	}

	/**
	 * Procesa el catálogo completo para filtrar por búsqueda textual y categoría activa.
	 * También maneja el ordenamiento por precio, nombre o destacados.
	 */
	function filteredProducts() {
		const query = searchInput.value.trim().toLocaleLowerCase("es-CL");
		const filtered = catalogProducts.filter((product) => {
			const matchesCategory = activeCategory === "Todos" || product.category === activeCategory;
			const searchable = `${product.name} ${product.description} ${product.category} ${product.subcategory}`.toLocaleLowerCase("es-CL");
			return matchesCategory && searchable.includes(query);
		});

		// Lógica de ordenamiento según el selector de la interfaz
		switch (sortSelect.value) {
			case "price-asc":
				filtered.sort((a, b) => a.offerPrice - b.offerPrice);
				break;
			case "price-desc":
				filtered.sort((a, b) => b.offerPrice - a.offerPrice);
				break;
			case "name":
				filtered.sort((a, b) => a.name.localeCompare(b.name, "es-CL"));
				break;
			default:
				// Orden por defecto: productos destacados primero
				filtered.sort((a, b) => Number(b.featured) - Number(a.featured));
		}
		return filtered;
	}

	/**
	 * Actualiza el DOM con los productos filtrados.
	 * También gestiona la visibilidad de estados vacíos y contadores.
	 */
	function renderProducts() {
		const products = filteredProducts();
		productGrid.innerHTML = products.map(productCard).join("");
		productCount.textContent = `${products.length} ${products.length === 1 ? "producto" : "productos"}`;
		
		// Mostrar u ocultar mensaje si no hay resultados
		emptyState.hidden = products.length > 0;
		productGrid.hidden = products.length === 0;
		// Mostrar botón de limpiar solo si hay filtros aplicados
		clearFiltersButton.hidden = !searchInput.value && activeCategory === "Todos";

		// Gestión robusta de imágenes: si falla la carga local/remota, se aplica un estilo visual alternativo
		productGrid.querySelectorAll(".product-image").forEach((image) => {
			image.addEventListener("error", () => {
				image.closest(".product-image-wrap").classList.add("image-unavailable");
				image.remove();
			}, { once: true });
		});
	}

	/**
	 * Maneja el cambio de categorías mediante los botones (pills) o navegación superior.
	 * @param {string} category - Nombre de la categoría o "Todos"
	 */
	function setCategory(category) {
		activeCategory = category;
		document.querySelectorAll(".filter-pill").forEach((button) => {
			const selected = button.dataset.category === category;
			button.classList.toggle("is-active", selected);
			button.setAttribute("aria-pressed", String(selected));
		});
		renderProducts();
	}

	/**
	 * Renderiza el carrito de compras, calcula totales y sincroniza con LocalStorage.
	 */
	function renderCart() {
		const entries = Object.entries(cart).filter(([id, quantity]) => productLookup.has(id) && quantity > 0);
		// Limpiar el objeto cart de entradas inválidas
		cart = Object.fromEntries(entries);
		
		const itemCount = entries.reduce((total, [, quantity]) => total + quantity, 0);
		const subtotal = entries.reduce((total, [id, quantity]) => {
			const product = getProductById(id);
			return total + product.offerPrice * quantity;
		}, 0);

		// Actualizar burbujas de conteo en la UI
		document.querySelectorAll(".cart-count").forEach((count) => { count.textContent = itemCount; });
		document.querySelector(".cart-title-count").textContent = `(${itemCount})`;
		
		// Generar lista de productos en el panel lateral del carrito
		cartItems.innerHTML = entries.map(([id, quantity]) => {
			const product = getProductById(id);
			return `
				<article class="cart-item">
					<img src="${product.image}" alt="" loading="lazy" decoding="async">
					<div class="cart-item-info">
						<h3>${product.name}</h3>
						<span>${product.size}</span>
						<strong>${currency.format(product.offerPrice * quantity)}</strong>
						<div class="quantity-control" aria-label="Cantidad de ${product.name}">
							<button type="button" data-quantity="${id}" data-change="-1" aria-label="Quitar una unidad"><i class="bi bi-dash" aria-hidden="true"></i></button>
							<span>${quantity}</span>
							<button type="button" data-quantity="${id}" data-change="1" aria-label="Agregar una unidad"><i class="bi bi-plus" aria-hidden="true"></i></button>
						</div>
					</div>
					<button class="remove-item" type="button" data-remove="${id}" aria-label="Quitar ${product.name} del carrito"><i class="bi bi-trash3" aria-hidden="true"></i></button>
				</article>`;
		}).join("");
		
		// Gestionar estados visibles del carrito
		cartEmpty.hidden = itemCount > 0;
		cartFooter.hidden = itemCount === 0;
		cartSubtotal.textContent = currency.format(subtotal);
		
		// Preparar el mensaje de pedido para WhatsApp
		if (orderButton) {
			const items = Object.entries(cart).map(([id, quantity]) => `${quantity} x ${getProductById(id).name}`).join(", ");
			const text = encodeURIComponent(`Hola, quiero hacer un pedido de los siguientes productos: ${items}`);
			orderButton.href = `https://wa.me/56987028794?text=${text}`;
			orderButton.setAttribute("aria-label", "Enviar pedido por WhatsApp");
		}
		// Persistir cambios
		saveStorage(cartStorageKey, cart);
	}

	/**
	 * Agrega una unidad de producto al carrito y dispara una pequeña animación visual en el botón.
	 */
	function addToCart(id) {
		cart[id] = (cart[id] || 0) + 1;
		renderCart();
		
		// Feedback visual en el botón de la tarjeta
		const button = productGrid.querySelector(`[data-add="${id}"]`);
		if (button) {
			const label = button.querySelector("span");
			const icon = button.querySelector("i");
			button.setAttribute("aria-label", `${getProductById(id).name} agregado al carrito`);
			label.textContent = "Agregado";
			icon.className = "bi bi-check-lg";
			button.classList.add("just-added");
			
			// Revertir el botón a su estado original después de 1.4 segundos
			window.setTimeout(() => {
				button.classList.remove("just-added");
				button.setAttribute("aria-label", `Agregar ${getProductById(id).name}`);
				label.textContent = "Agregar";
				icon.className = "bi bi-plus-lg";
			}, 1400);
		}
	}

	// --- CONFIGURACIÓN DE EVENTOS (LISTENERS) ---

	// Categorías de la página principal (Tiles)
	categoryButtons.forEach((button) => {
		button.addEventListener("click", () => {
			setCategory(button.dataset.category);
			document.querySelector("#catalogo").scrollIntoView({ behavior: "smooth" });
		});
	});

	// Enlaces de la barra de navegación superior
	document.querySelectorAll("[data-category-link]").forEach((link) => {
		link.addEventListener("click", () => setCategory(link.dataset.categoryLink));
	});

	// Icono de lupa en la cabecera
	document.querySelector(".search-toggle").addEventListener("click", () => {
		document.querySelector("#catalogo").scrollIntoView({ behavior: "smooth" });
		window.setTimeout(() => searchInput.focus(), 350);
	});

	// Pastillas de filtro sobre el grid
	document.querySelectorAll(".filter-pill").forEach((button) => {
		button.addEventListener("click", () => setCategory(button.dataset.category));
	});

	// Entrada de búsqueda de texto (con debounce para performance)
	searchInput.addEventListener("input", debounce(renderProducts, 120));
	
	// Selector de ordenamiento
	sortSelect.addEventListener("change", renderProducts);
	
	// Botones para resetear filtros
	clearFiltersButton.addEventListener("click", () => {
		searchInput.value = "";
		setCategory("Todos");
	});
	document.querySelector("#resetCatalog").addEventListener("click", () => {
		searchInput.value = "";
		setCategory("Todos");
		searchInput.focus();
	});

	// Delegación de eventos en el Grid de Productos (más eficiente que poner miles de listeners)
	productGrid.addEventListener("click", (event) => {
		const addButton = event.target.closest("[data-add]");
		const favoriteButton = event.target.closest("[data-favorite]");
		
		if (addButton) addToCart(addButton.dataset.add);
		
		if (favoriteButton) {
			const id = favoriteButton.dataset.favorite;
			favorites.has(id) ? favorites.delete(id) : favorites.add(id);
			saveStorage(favoriteStorageKey, [...favorites]);
			renderProducts(); // Re-renderizar para actualizar el estado del icono de corazón
		}
	});

	// Delegación de eventos en el Carrito (cambiar cantidades o eliminar)
	cartItems.addEventListener("click", (event) => {
		const quantityButton = event.target.closest("[data-quantity]");
		const removeButton = event.target.closest("[data-remove]");
		
		if (quantityButton) {
			const id = quantityButton.dataset.quantity;
			cart[id] = (cart[id] || 0) + Number(quantityButton.dataset.change);
			if (cart[id] <= 0) delete cart[id];
			renderCart();
		}
		
		if (removeButton) {
			delete cart[removeButton.dataset.remove];
			renderCart();
		}
	});

	// Interceptar el clic en el botón de pedido para abrir WhatsApp
	if (orderButton) {
		orderButton.addEventListener("click", (event) => {
			event.preventDefault();
			if (Object.keys(cart).length === 0) return;
			
			const items = Object.entries(cart).map(([id, quantity]) => `${quantity} x ${getProductById(id).name}`).join(", ");
			const text = encodeURIComponent(`Hola, quiero hacer un pedido de los siguientes productos: ${items}`);
			const waLink = `https://wa.me/56975407155?text=${text}`;
			window.open(waLink, "_blank", "noopener,noreferrer");
		});
	}

	// --- ARRANQUE DE LA APLICACIÓN ---
	renderProducts();
	renderCart();
})();
