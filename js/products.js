/* ==========================================================================
   products.js — product data loading, card rendering, shop filtering,
   product detail modal, bestsellers on the home page.
   Requires: js/main.js (Bakery helpers), js/cart.js (Bakery.cart)
   ========================================================================== */

(function () {
  "use strict";

  const Bakery = (window.Bakery = window.Bakery || {});
  let allItems = null;

  /* ---------- Data ---------- */

  function normalizeProduct(p) {
    return {
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description || "",
      ingredients: p.ingredients || "",
      allergens: p.allergens || "",
      image: p.image,
      featured: Boolean(p.featured),
      sizes: p.sizes || [],
      price: null,
      includes: null,
      weight: null,
    };
  }

  function normalizeCombo(c) {
    return {
      id: c.id,
      name: c.name,
      category: c.category,
      description: c.description || "",
      ingredients: c.ingredients || "",
      allergens: c.allergens || "",
      image: c.image,
      featured: c.featured !== false,
      sizes: [],
      price: c.price,
      includes: c.includes || [],
      weight: c.weight || "",
    };
  }

  Bakery.loadProducts = function () {
    if (allItems) return Promise.resolve(allItems);

    return Promise.all([
      fetch("data/products.json").then(function (r) {
        if (!r.ok) throw new Error("products.json HTTP " + r.status);
        return r.json();
      }),
      fetch("data/combos.json").then(function (r) {
        if (!r.ok) throw new Error("combos.json HTTP " + r.status);
        return r.json();
      }),
    ])
      .then(function (results) {
        allItems = []
          .concat(results[0].products.map(normalizeProduct))
          .concat(results[1].combos.map(normalizeCombo));
        return allItems;
      })
      .catch(function (err) {
        console.error("Failed to load product data:", err);
        return [];
      });
  };

  Bakery.isCombo = function (item) {
    return item.category === "Combos";
  };

  Bakery.itemPrice = function (item, sizeIndex) {
    if (Bakery.isCombo(item)) return item.price;
    const size = item.sizes[sizeIndex || 0];
    return size ? size.price : 0;
  };

  Bakery.itemSizeLabel = function (item, sizeIndex) {
    if (Bakery.isCombo(item)) return item.weight || "1 kg total";
    const size = item.sizes[sizeIndex || 0];
    return size ? size.label : "";
  };

  /* ---------- Product card ---------- */

  function buildCard(item) {
    const card = document.createElement("article");
    card.className = "product-card reveal";
    card.dataset.itemId = item.id;
    card.setAttribute("data-reveal", "fade-up");

    // Media
    const media = document.createElement("div");
    media.className = "product-card_media";
    const img = document.createElement("img");
    img.src = item.image;
    img.alt = item.name + " — " + item.category + " from Nilgiribytes";
    img.width = 480;
    img.height = 360;
    img.loading = "lazy";
    img.setAttribute("data-fallback", item.name + " — photo coming soon");
    img.addEventListener("error", function () {
      Bakery.handleImageError(img, item.name + " — photo coming soon");
    });
    media.appendChild(img);

    const tag = document.createElement("span");
    tag.className = "product-card_tag";
    tag.textContent = item.category;
    media.appendChild(tag);
    media.addEventListener("click", function () {
      openModal(item);
    });

    // "View Product" link — slides in over the bottom of the image on hover.
    const viewBtn = document.createElement("button");
    viewBtn.type = "button";
    viewBtn.className = "product-card_view";
    viewBtn.textContent = "View Product";
    viewBtn.setAttribute("aria-label", "View details for " + item.name);
    viewBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      openModal(item);
    });
    media.appendChild(viewBtn);

    // Body
    const body = document.createElement("div");
    body.className = "product-card_body";

    const nameWrap = document.createElement("h3");
    nameWrap.className = "product-card_name";
    const nameBtn = document.createElement("button");
    nameBtn.type = "button";
    nameBtn.className = "product-card_link-btn";
    nameBtn.textContent = item.name;
    nameBtn.setAttribute("aria-label", "View details for " + item.name);
    nameBtn.addEventListener("click", function () {
      openModal(item);
    });
    nameWrap.appendChild(nameBtn);

    const price = document.createElement("p");
    price.className = "product-card_price";

    body.appendChild(nameWrap);
    body.appendChild(price);

    if (Bakery.isCombo(item)) {
      const inc = document.createElement("p");
      inc.className = "product-card_includes";
      inc.textContent =
        "Includes: " +
        item.includes
          .map(function (i) {
            return i.name + " " + i.quantity;
          })
          .join(" · ");
      body.appendChild(inc);
    }

    const footer = document.createElement("div");
    footer.className = "product-card_footer";

    let sizeIndex = 0;

    if (!Bakery.isCombo(item)) {
      const selector = document.createElement("div");
      selector.className = "size-select";
      selector.setAttribute("role", "group");
      selector.setAttribute("aria-label", "Choose size for " + item.name);

      item.sizes.forEach(function (size, idx) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "size-select_btn";
        btn.textContent = size.label;
        btn.setAttribute("aria-pressed", String(idx === 0));
        btn.addEventListener("click", function () {
          sizeIndex = idx;
          selector.querySelectorAll("button").forEach(function (b, i) {
            b.setAttribute("aria-pressed", String(i === idx));
          });
          updatePrice();
        });
        selector.appendChild(btn);
      });

      footer.appendChild(selector);
    }

    function updatePrice() {
      price.textContent = Bakery.formatPrice(Bakery.itemPrice(item, sizeIndex)) +
        (Bakery.isCombo(item) ? "" : " / " + Bakery.itemSizeLabel(item, sizeIndex));
    }
    updatePrice();

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn btn--primary btn--block";
    addBtn.textContent = "Add to cart";
    addBtn.addEventListener("click", function () {
      Bakery.cart.add(item, sizeIndex, 1);
      addBtn.textContent = "Added ✓";
      setTimeout(function () {
        addBtn.textContent = "Add to cart";
      }, 1200);
    });
    footer.appendChild(addBtn);

    body.appendChild(footer);
    card.appendChild(media);
    card.appendChild(body);
    return card;
  }

  Bakery.buildProductCard = buildCard;

  function renderInto(container, items, options) {
    const quick = Boolean(options && options.quick);
    container.innerHTML = "";
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No products match your search. Try a different keyword or category.";
      container.appendChild(empty);
      return;
    }
    items.forEach(function (item) {
      const card = buildCard(item);
      /* Re-renders (filter / search / sort) use a quick fade instead of
         replaying the full stagger. */
      if (quick) card.classList.add("is-quick");
      container.appendChild(card);
    });
    // observe new cards for scroll-reveal animation
    if (typeof window.refreshReveals === "function") {
      window.refreshReveals(container);
    } else if (typeof Bakery.observeReveals === "function") {
      Bakery.observeReveals(container);
    }
  }

  /* ---------- Home: bestsellers ---------- */
  function initBestsellers() {
    const grid = document.getElementById("bestsellers-grid");
    if (!grid) return;

    Bakery.loadProducts().then(function (items) {
      const combos = items.filter(function (i) {
        return Bakery.isCombo(i) && i.featured;
      });
      const top = items.filter(function (i) {
        return !Bakery.isCombo(i) && i.featured;
      });
      // Show 4 bestsellers: the 3 combos + the top featured item
      renderInto(grid, combos.concat(top).slice(0, 4));
    });
  }

  /* ---------- Shop page ---------- */
  function initShop() {
    const grid = document.getElementById("shop-grid");
    if (!grid) return;

    const chips = Array.from(document.querySelectorAll("[data-filter]"));
    const searchInput = document.getElementById("shop-search");
    const sortSelect = document.getElementById("shop-sort");
    const resultCount = document.getElementById("shop-count");

    const params = new URLSearchParams(window.location.search);
    let activeCategory = params.get("category") || "All";
    let query = params.get("q") || "";
    let sort = "featured";
    /* The first render plays the full stagger; later renders (filter, search,
       sort) use a quick fade so the stagger is not replayed every time. */
    let rendered = false;

    if (searchInput) searchInput.value = query;

    function apply() {
      Bakery.loadProducts().then(function (items) {
        let list = items.slice();

        if (activeCategory !== "All") {
          list = list.filter(function (i) {
            return i.category === activeCategory;
          });
        }

        if (query) {
          const q = query.toLowerCase();
          list = list.filter(function (i) {
            return (
              i.name.toLowerCase().indexOf(q) > -1 ||
              i.category.toLowerCase().indexOf(q) > -1
            );
          });
        }

        if (sort === "price-asc") {
          list.sort(function (a, b) {
            return Bakery.itemPrice(a, 0) - Bakery.itemPrice(b, 0);
          });
        } else if (sort === "price-desc") {
          list.sort(function (a, b) {
            return Bakery.itemPrice(b, 0) - Bakery.itemPrice(a, 0);
          });
        } else if (sort === "name") {
          list.sort(function (a, b) {
            return a.name.localeCompare(b.name);
          });
        } else {
          list.sort(function (a, b) {
            return Number(b.featured) - Number(a.featured);
          });
        }

        renderInto(grid, list, { quick: rendered });
        rendered = true;

        if (resultCount) {
          resultCount.textContent =
            list.length + (list.length === 1 ? " product" : " products");
        }
      });
    }

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        activeCategory = chip.getAttribute("data-filter");
        chips.forEach(function (c) {
          c.setAttribute("aria-pressed", String(c === chip));
        });
        apply();
      });
      // sync initial state from URL
      if (chip.getAttribute("data-filter") === activeCategory) {
        chips.forEach(function (c) {
          c.setAttribute("aria-pressed", String(c === chip));
        });
      }
    });

    if (searchInput) {
      let t;
      searchInput.addEventListener("input", function () {
        clearTimeout(t);
        t = setTimeout(function () {
          query = searchInput.value.trim();
          apply();
        }, 200);
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener("change", function () {
        sort = sortSelect.value;
        apply();
      });
    }

    apply();
  }

  /* ---------- Product detail modal ---------- */
  let modal = null;
  let modalLastFocus = null;

  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement("div");
    modal.className = "modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "modal-title");
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML =
      '<div class="modal_panel">' +
      '<button class="icon-btn modal_close" type="button" aria-label="Close product details">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
      "</button>" +
      '<div class="modal_grid">' +
      '<div class="modal_media" data-modal-media></div>' +
      '<div class="modal_body">' +
      '<h2 class="modal_title" id="modal-title" data-modal-title></h2>' +
      '<p class="modal_price" data-modal-price></p>' +
      '<p class="modal_desc" data-modal-desc></p>' +
      '<div data-modal-includes></div>' +
      '<p class="modal_availability">✓ In stock — baked fresh daily</p>' +
      '<div data-modal-sizes></div>' +
      '<div class="modal_actions" data-modal-actions></div>' +
      "</div></div></div>";
    document.body.appendChild(modal);

    modal.querySelector(".modal_close").addEventListener("click", closeModal);
    modal.addEventListener("click", function (e) {
      if (e.target === modal) closeModal();
    });
    modal.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeModal();
      if (e.key === "Tab") trapFocus(e);
    });
    return modal;
  }

  function trapFocus(e) {
    const items = Array.from(
      modal.querySelectorAll('a[href], button:not([disabled]), input, select')
    ).filter(function (el) {
      return el.offsetParent !== null;
    });
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-locked");
    if (modalLastFocus) modalLastFocus.focus();
  }

  function openModal(item) {
    const el = ensureModal();
    modalLastFocus = document.activeElement;

    let sizeIndex = 0;
    let qty = 1;

    // Media
    const media = el.querySelector("[data-modal-media]");
    media.innerHTML = "";
    const img = document.createElement("img");
    img.src = item.image;
    img.alt = item.name + " — " + item.category;
    img.width = 640;
    img.height = 480;
    img.setAttribute("data-fallback", item.name + " — photo coming soon");
    media.appendChild(img);
    // run fallback for this fresh image if it errors
    img.addEventListener("error", function () {
      Bakery.handleImageError(img, item.name + " — photo coming soon");
    });

    el.querySelector("[data-modal-title]").textContent = item.name;

    const desc = el.querySelector("[data-modal-desc]");
    if (item.description && item.description.indexOf("TODO") !== 0) {
      desc.textContent = item.description;
    } else {
      desc.innerHTML =
        '<span class="todo-note">Description: ' +
        Bakery.escapeHTML(item.description) +
        "</span>";
    }

    // Includes (combos)
    const includesWrap = el.querySelector("[data-modal-includes]");
    includesWrap.innerHTML = "";
    if (Bakery.isCombo(item)) {
      const label = document.createElement("p");
      label.className = "modal_label";
      label.textContent = "What's included (" + item.weight + ")";
      const list = document.createElement("ul");
      list.className = "modal_includes";
      item.includes.forEach(function (inc) {
        const li = document.createElement("li");
        li.textContent = inc.name + " — " + inc.quantity;
        list.appendChild(li);
      });
      includesWrap.appendChild(label);
      includesWrap.appendChild(list);
    }

    // Sizes
    const sizesWrap = el.querySelector("[data-modal-sizes]");
    sizesWrap.innerHTML = "";
    if (!Bakery.isCombo(item)) {
      const label = document.createElement("p");
      label.className = "modal_label";
      label.textContent = "Choose size";
      const selector = document.createElement("div");
      selector.className = "size-select";
      selector.setAttribute("role", "group");
      selector.setAttribute("aria-label", "Choose size");
      item.sizes.forEach(function (size, idx) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "size-select_btn";
        btn.textContent = size.label + " · ₹" + size.price;
        btn.setAttribute("aria-pressed", String(idx === 0));
        btn.addEventListener("click", function () {
          sizeIndex = idx;
          selector.querySelectorAll("button").forEach(function (b, i) {
            b.setAttribute("aria-pressed", String(i === idx));
          });
          renderPrice();
        });
        selector.appendChild(btn);
      });
      sizesWrap.appendChild(label);
      sizesWrap.appendChild(selector);
    }

    const priceEl = el.querySelector("[data-modal-price]");

    function renderPrice() {
      priceEl.textContent =
        Bakery.formatPrice(Bakery.itemPrice(item, sizeIndex)) +
        (Bakery.isCombo(item)
          ? " · " + item.weight
          : " · " + Bakery.itemSizeLabel(item, sizeIndex));
    }
    renderPrice();

    // Actions: qty stepper + add
    const actions = el.querySelector("[data-modal-actions]");
    actions.innerHTML = "";

    const stepper = document.createElement("div");
    stepper.className = "qty-stepper";
    stepper.setAttribute("aria-label", "Quantity");
    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "−";
    minus.setAttribute("aria-label", "Decrease quantity");
    const qtyLabel = document.createElement("span");
    qtyLabel.textContent = "1";
    qtyLabel.setAttribute("aria-live", "polite");
    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    plus.setAttribute("aria-label", "Increase quantity");

    minus.addEventListener("click", function () {
      if (qty > 1) {
        qty -= 1;
        qtyLabel.textContent = String(qty);
      }
    });
    plus.addEventListener("click", function () {
      if (qty < 20) {
        qty += 1;
        qtyLabel.textContent = String(qty);
      }
    });

    stepper.appendChild(minus);
    stepper.appendChild(qtyLabel);
    stepper.appendChild(plus);

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn btn--primary";
    addBtn.textContent = "Add to cart";
    addBtn.addEventListener("click", function () {
      Bakery.cart.add(item, sizeIndex, qty);
      closeModal();
    });

    actions.appendChild(stepper);
    actions.appendChild(addBtn);

    el.classList.add("is-open");
    el.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-locked");
    el.querySelector(".modal_close").focus();
  }

  Bakery.openProductModal = openModal;

  /* ---------- Boot ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    initBestsellers();
    initShop();
  });
})();
