(() => {
	const productGrid = document.querySelector("#productGrid");
	const searchInput = document.querySelector("#productSearch");
	const sortSelect = document.querySelector("#productSort");
	const productCount = document.querySelector("#productCount");
	const emptyState = document.querySelector("#emptyState");
	const clearFiltersButton = document.querySelector(".clear-filters");
	const cartItems = document.querySelector("#cartItems");
	const cartEmpty = document.querySelector("#cartEmpty");
	const cartFooter = document.querySelector("#cartFooter");
	const cartSubtotal = document.querySelector("#cartSubtotal");
	const orderButton = document.querySelector("#copyOrder");
	const categoryButtons = document.querySelectorAll("[data-category]");
	const currency = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
	const cartStorageKey = "casa-botanica-cart";
	const favoriteStorageKey = "casa-botanica-favorites";
	const productLookup = new Map(catalogProducts.map((product) => [product.id, product]));
	let activeCategory = "Todos";
	let cart = readStorage(cartStorageKey, {});
	let favorites = new Set(readStorage(favoriteStorageKey, []));

	function readStorage(key, fallback) {
		try {
			const value = JSON.parse(localStorage.getItem(key));
			return value ?? fallback;
		} catch {
			return fallback;
		}
	}

	function saveStorage(key, value) {
		try {
			localStorage.setItem(key, JSON.stringify(value));
		} catch {
			// The catalog still works when browser storage is unavailable.
		}
	}

	function discount(product) {
		return Math.round((1 - product.offerPrice / product.price) * 100);
	}

	function getProductById(id) {
		return productLookup.get(id) || null;
	}

	function debounce(callback, delay = 120) {
		let timeoutId;
		return (...args) => {
			window.clearTimeout(timeoutId);
			timeoutId = window.setTimeout(() => callback(...args), delay);
		};
	}

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

	function filteredProducts() {
		const query = searchInput.value.trim().toLocaleLowerCase("es-CL");
		const filtered = catalogProducts.filter((product) => {
			const matchesCategory = activeCategory === "Todos" || product.category === activeCategory;
			const searchable = `${product.name} ${product.description} ${product.category} ${product.subcategory}`.toLocaleLowerCase("es-CL");
			return matchesCategory && searchable.includes(query);
		});

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
				filtered.sort((a, b) => Number(b.featured) - Number(a.featured));
		}
		return filtered;
	}

	function renderProducts() {
		const products = filteredProducts();
		productGrid.innerHTML = products.map(productCard).join("");
		productCount.textContent = `${products.length} ${products.length === 1 ? "producto" : "productos"}`;
		emptyState.hidden = products.length > 0;
		productGrid.hidden = products.length === 0;
		clearFiltersButton.hidden = !searchInput.value && activeCategory === "Todos";

		productGrid.querySelectorAll(".product-image").forEach((image) => {
			image.addEventListener("error", () => {
				image.closest(".product-image-wrap").classList.add("image-unavailable");
				image.remove();
			}, { once: true });
		});
	}

	function setCategory(category) {
		activeCategory = category;
		document.querySelectorAll(".filter-pill").forEach((button) => {
			const selected = button.dataset.category === category;
			button.classList.toggle("is-active", selected);
			button.setAttribute("aria-pressed", String(selected));
		});
		renderProducts();
	}

	function renderCart() {
		const entries = Object.entries(cart).filter(([id, quantity]) => productLookup.has(id) && quantity > 0);
		cart = Object.fromEntries(entries);
		const itemCount = entries.reduce((total, [, quantity]) => total + quantity, 0);
		const subtotal = entries.reduce((total, [id, quantity]) => {
			const product = getProductById(id);
			return total + product.offerPrice * quantity;
		}, 0);

		document.querySelectorAll(".cart-count").forEach((count) => { count.textContent = itemCount; });
		document.querySelector(".cart-title-count").textContent = `(${itemCount})`;
		cartItems.innerHTML = entries.map(([id, quantity]) => {
			const product = getProductById(id);
			return `
				<article class="cart-item">
					<img src="${product.image}" alt="" loading="lazy" decoding="async">
					<div class="cart-item-info"><h3>${product.name}</h3><span>${product.size}</span><strong>${currency.format(product.offerPrice * quantity)}</strong>
						<div class="quantity-control" aria-label="Cantidad de ${product.name}">
							<button type="button" data-quantity="${id}" data-change="-1" aria-label="Quitar una unidad"><i class="bi bi-dash" aria-hidden="true"></i></button><span>${quantity}</span><button type="button" data-quantity="${id}" data-change="1" aria-label="Agregar una unidad"><i class="bi bi-plus" aria-hidden="true"></i></button>
						</div>
					</div>
					<button class="remove-item" type="button" data-remove="${id}" aria-label="Quitar ${product.name} del carrito"><i class="bi bi-trash3" aria-hidden="true"></i></button>
				</article>`;
		}).join("");
		cartEmpty.hidden = itemCount > 0;
		cartFooter.hidden = itemCount === 0;
		cartSubtotal.textContent = currency.format(subtotal);
		if (orderButton) {
			const items = Object.entries(cart).map(([id, quantity]) => `${quantity} x ${getProductById(id).name}`).join(", ");
			const text = encodeURIComponent(`Hola, quiero hacer un pedido de los siguientes productos: ${items}`);
			orderButton.href = `https://wa.me/56975407155?text=${text}`;
			orderButton.setAttribute("aria-label", "Enviar pedido por WhatsApp");
		}
		saveStorage(cartStorageKey, cart);
	}

	function addToCart(id) {
		cart[id] = (cart[id] || 0) + 1;
		renderCart();
		const button = productGrid.querySelector(`[data-add="${id}"]`);
		if (button) {
			const label = button.querySelector("span");
			const icon = button.querySelector("i");
			button.setAttribute("aria-label", `${getProductById(id).name} agregado al carrito`);
			label.textContent = "Agregado";
			icon.className = "bi bi-check-lg";
			button.classList.add("just-added");
			window.setTimeout(() => {
				button.classList.remove("just-added");
				button.setAttribute("aria-label", `Agregar ${getProductById(id).name}`);
				label.textContent = "Agregar";
				icon.className = "bi bi-plus-lg";
			}, 1400);
		}
	}

	categoryButtons.forEach((button) => {
		button.addEventListener("click", () => {
			setCategory(button.dataset.category);
			document.querySelector("#catalogo").scrollIntoView({ behavior: "smooth" });
		});
	});

	document.querySelectorAll("[data-category-link]").forEach((link) => {
		link.addEventListener("click", () => setCategory(link.dataset.categoryLink));
	});

	document.querySelector(".search-toggle").addEventListener("click", () => {
		document.querySelector("#catalogo").scrollIntoView({ behavior: "smooth" });
		window.setTimeout(() => searchInput.focus(), 350);
	});

	document.querySelectorAll(".filter-pill").forEach((button) => {
		button.addEventListener("click", () => setCategory(button.dataset.category));
	});

	searchInput.addEventListener("input", debounce(renderProducts, 120));
	sortSelect.addEventListener("change", renderProducts);
	clearFiltersButton.addEventListener("click", () => {
		searchInput.value = "";
		setCategory("Todos");
	});
	document.querySelector("#resetCatalog").addEventListener("click", () => {
		searchInput.value = "";
		setCategory("Todos");
		searchInput.focus();
	});

	productGrid.addEventListener("click", (event) => {
		const addButton = event.target.closest("[data-add]");
		const favoriteButton = event.target.closest("[data-favorite]");
		if (addButton) addToCart(addButton.dataset.add);
		if (favoriteButton) {
			const id = favoriteButton.dataset.favorite;
			favorites.has(id) ? favorites.delete(id) : favorites.add(id);
			saveStorage(favoriteStorageKey, [...favorites]);
			renderProducts();
		}
	});

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

	if (orderButton) {
		orderButton.addEventListener("click", (event) => {
			event.preventDefault();
			if (Object.keys(cart).length === 0) {
				return;
			}
			const items = Object.entries(cart).map(([id, quantity]) => `${quantity} x ${getProductById(id).name}`).join(", ");
			const text = encodeURIComponent(`Hola, quiero hacer un pedido de los siguientes productos: ${items}`);
			const waLink = `https://wa.me/56975407155?text=${text}`;
			window.open(waLink, "_blank", "noopener,noreferrer");
		});
	}

	renderProducts();
	renderCart();
})();
