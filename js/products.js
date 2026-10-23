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
      poster: p.poster || "",
      sizeImages: p.sizeImages || {},
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
      sizes: [],
      price: c.price,
      includes: c.includes || [],
      weight: c.weight || "",
    };
  }

  function loadPublishedCatalog() {
    return fetch("api/catalog", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
      .then(function (r) {
        if (!r.ok) throw new Error("catalog API HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        if (!data || !Array.isArray(data.products) || !Array.isArray(data.combos)) {
          throw new Error("Catalog API returned unexpected data");
        }
        return data;
      });
  }

  function loadStaticCatalog() {
    return fetch("data/catalog.json")
      .then(function (r) {
        if (!r.ok) throw new Error("catalog.json HTTP " + r.status);
        return r.json();
      })
      .then(function (catalog) {
        return {
          products: catalog && Array.isArray(catalog.products) ? catalog.products : [],
          combos: catalog && Array.isArray(catalog.combos) ? catalog.combos : [],
        };
      });
  }

  Bakery.loadProducts = function () {
    if (allItems) return Promise.resolve(allItems);

    return loadPublishedCatalog()
      .catch(function () {
        return loadStaticCatalog();
      })
      .then(function (catalog) {
        allItems = []
          .concat(catalog.products.map(normalizeProduct))
          .concat(catalog.combos.map(normalizeCombo));
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

  Bakery.itemImage = function (item, sizeIndex) {
    if (Bakery.isCombo(item)) return item.image;
    const size = item.sizes[sizeIndex || 0];
    const key = size ? size.label : "";
    return (item.sizeImages && item.sizeImages[key]) || item.image;
  };

  /* ---------- Product card ---------- */

  function buildCard(item, options) {
    const animate = !options || options.reveal !== false;
    const card = document.createElement("article");
    card.className = "product-card" + (animate ? " reveal" : "");
    card.dataset.itemId = item.id;
    if (animate) card.setAttribute("data-reveal", "fade-up");

    // Media
    const media = document.createElement("div");
    media.className = "product-card_media";
    const img = document.createElement("img");
    img.alt = item.name + " — " + item.category + " from Nilgiribytes";
    img.width = 480;
    img.height = 360;
    img.loading = "lazy";
    img.setAttribute("data-fallback", item.name + " — photo coming soon");
    img.addEventListener("error", function () {
      Bakery.handleImageError(img, item.name + " — photo coming soon");
    });
    media.appendChild(img);
    const imageLoader = Bakery.attachImageLoader(media, img, "Loading " + item.name);
    imageLoader.setSrc(Bakery.itemImage(item, 0));

    media.addEventListener("click", function () {
      openModal(item);
    });

    // Quick-view maximize icon — sits in the top-right corner of the image.
    const viewBtn = document.createElement("button");
    viewBtn.type = "button";
    viewBtn.className = "product-card_view";
    viewBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<path d="M15 3h6v6"/>' +
      '<path d="M9 21H3v-6"/>' +
      '<path d="M21 3l-7 7"/>' +
      '<path d="M3 21l7-7"/></svg>';
    viewBtn.setAttribute("aria-label", "View details for " + item.name);
    viewBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      openModal(item);
    });
    media.appendChild(viewBtn);

    // Body
    const body = document.createElement("div");
    body.className = "product-card_body";

    // Top row: product name + price share one line
    const topRow = document.createElement("div");
    topRow.className = "product-card_top";

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

    topRow.appendChild(nameWrap);
    topRow.appendChild(price);
    body.appendChild(topRow);

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
      const selectorWrap = document.createElement("div");
      selectorWrap.className = "size-select_wrap";

      const selectorLabel = document.createElement("span");
      selectorLabel.className = "size-select_label";
      selectorLabel.textContent = "Size";
      selectorWrap.appendChild(selectorLabel);

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
          imageLoader.setSrc(Bakery.itemImage(item, idx));
          updatePrice();
          /* Different size = a different cart line; start the action over. */
          cartQty = 0;
          renderAddControl();
        });
        selector.appendChild(btn);
      });

      selectorWrap.appendChild(selector);
      footer.appendChild(selectorWrap);
    }

    function updatePrice() {
      price.textContent = Bakery.formatPrice(Bakery.itemPrice(item, sizeIndex)) +
        (Bakery.isCombo(item) ? "" : " / " + Bakery.itemSizeLabel(item, sizeIndex));
    }
    updatePrice();

    /* "Add to cart" swaps into a qty stepper once the item is added
       (same behaviour as the product modal). */
    let cartQty = 0;

    function renderAddControl() {
      actionSlot.innerHTML = "";

      if (cartQty < 1) {
        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "btn btn--primary btn--block";
        addBtn.textContent = "Add to cart";
        addBtn.addEventListener("click", function () {
          cartQty = 1;
          Bakery.cart.add(item, sizeIndex, 1, { openDrawer: false });
          renderAddControl();
        });
        actionSlot.appendChild(addBtn);
        return;
      }

      const stepper = document.createElement("div");
      stepper.className = "qty-stepper qty-stepper--card";
      stepper.setAttribute("aria-label", "Quantity in cart");

      const minus = document.createElement("button");
      minus.type = "button";
      minus.textContent = "−";
      minus.setAttribute("aria-label", "Decrease quantity");

      const qtyLabel = document.createElement("span");
      qtyLabel.textContent = String(cartQty);
      qtyLabel.setAttribute("aria-live", "polite");

      const plus = document.createElement("button");
      plus.type = "button";
      plus.textContent = "+";
      plus.setAttribute("aria-label", "Increase quantity");

      minus.addEventListener("click", function () {
        Bakery.cart.updateQty(Bakery.cart.lineKey(item, sizeIndex), -1);
        cartQty -= 1;
        renderAddControl();
      });

      plus.addEventListener("click", function () {
        if (cartQty >= 20) return;
        Bakery.cart.updateQty(Bakery.cart.lineKey(item, sizeIndex), 1);
        cartQty += 1;
        renderAddControl();
      });

      stepper.appendChild(minus);
      stepper.appendChild(qtyLabel);
      stepper.appendChild(plus);
      actionSlot.appendChild(stepper);
    }

    const actionSlot = document.createElement("div");
    actionSlot.className = "product-card_action";
    renderAddControl();
    footer.appendChild(actionSlot);

    body.appendChild(footer);
    card.appendChild(media);
    card.appendChild(body);
    return card;
  }

  Bakery.buildProductCard = buildCard;

  function renderInto(container, items, options) {
    const quick = Boolean(options && options.quick);
    const reveal = !options || options.reveal !== false;
    container.innerHTML = "";
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No products match your search. Try a different keyword or category.";
      container.appendChild(empty);
      return;
    }
    items.forEach(function (item) {
      const card = buildCard(item, { reveal: reveal });
      /* Re-renders (filter / search / sort) use a quick fade instead of
         replaying the full stagger. */
      if (quick && reveal) card.classList.add("is-quick");
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
      const combos = items.filter(Bakery.isCombo);
      const products = items.filter(function (i) {
        return !Bakery.isCombo(i);
      });
      /* Show 4 bestsellers: the combos first, then the first products. */
      renderInto(grid, combos.concat(products).slice(0, 4));
    });
  }

  /* ---------- Home: signature range posters ---------- */
  function initPosterRail() {
    const rail = document.getElementById("poster-rail");
    if (!rail) return;

    function createPoster(item) {
      const card = document.createElement("div");
      card.className = "poster-card";

      const img = document.createElement("img");
      img.className = "poster-card_img";
      img.src = item.poster;
      img.alt = item.name + " — Nilgiribytes";
      img.width = 1122;
      img.height = 1402;
      img.loading = "lazy";
      img.addEventListener("error", function () {
        Bakery.handleImageError(img, item.name + " poster coming soon");
      });

      card.appendChild(img);
      return card;
    }

    Bakery.loadProducts().then(function (items) {
      const posters = items.filter(function (item) {
        return Boolean(item.poster);
      });

      if (!posters.length) {
        const section = rail.closest("section");
        if (section) section.hidden = true;
        return;
      }

      const cards = posters.map(function (item) {
        const card = createPoster(item);
        rail.appendChild(card);
        return card;
      });

      const prevBtn = document.getElementById("poster-prev");
      const nextBtn = document.getElementById("poster-next");
      const deck = rail.closest(".poster-deck") || rail;
      const count = cards.length;
      const reduceMotion =
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      let active = 0;
      let paused = false;
      let visible = true;
      let timer = 0;

      function render() {
        cards.forEach(function (card, i) {
          let offset = i - active;
          if (offset > count / 2) offset -= count;
          if (offset < -count / 2) offset += count;

          const abs = Math.abs(offset);
          card.dataset.offset = String(offset);
          card.style.setProperty("--offset", offset);
          card.style.setProperty("--scale", Math.max(0.62, 1 - abs * 0.11));
          card.style.setProperty(
            "--opacity",
            abs > 3 ? 0 : Math.max(0.3, 1 - abs * 0.16)
          );
          card.style.zIndex = String(20 - abs);
          card.classList.toggle("is-active", offset === 0);
        });
      }

      function setActive(i) {
        active = (i + count) % count;
        render();
      }

      function restartTimer() {
        window.clearInterval(timer);
        if (reduceMotion) return;
        timer = window.setInterval(function () {
          if (!paused && visible && !document.body.classList.contains("is-locked")) {
            setActive(active + 1);
          }
        }, 4200);
      }

      if (prevBtn) {
        prevBtn.addEventListener("click", function () {
          setActive(active - 1);
          restartTimer();
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener("click", function () {
          setActive(active + 1);
          restartTimer();
        });
      }

      deck.addEventListener("mouseenter", function () {
        paused = true;
      });
      deck.addEventListener("mouseleave", function () {
        paused = false;
      });
      deck.addEventListener("focusin", function () {
        paused = true;
      });
      deck.addEventListener("focusout", function () {
        paused = false;
      });
      deck.addEventListener("pointerdown", function () {
        paused = true;
      });
      deck.addEventListener("pointerup", function () {
        window.setTimeout(function () {
          paused = false;
        }, 900);
      });
      deck.addEventListener("pointercancel", function () {
        paused = false;
      });

      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
          visible = entries[0].isIntersecting;
        }).observe(deck);
      }

      render();
      restartTimer();
    });
  }

  /* ---------- Shop page ---------- */
  function initShop() {
    const grid = document.getElementById("shop-grid");
    if (!grid) return;

    const chips = Array.from(document.querySelectorAll("[data-filter]"));
    const sortSelect = document.getElementById("shop-sort");
    const resultCount = document.getElementById("shop-count");

    const params = new URLSearchParams(window.location.search);
    let activeCategory = params.get("category") || "All";
    let sort = "featured";
    /* The first render plays the full stagger; later renders (filter, search,
       sort) use a quick fade so the stagger is not replayed every time. */
    let rendered = false;
    let loaderStartedAt = 0;
    let renderTimer = 0;

    function showGridLoader() {
      grid.innerHTML = "";
      const wrap = document.createElement("div");
      wrap.className = "shop-loader";
      wrap.appendChild(Bakery.logoLoader("Loading products"));
      const label = document.createElement("p");
      label.className = "shop-loader_text";
      label.textContent = "Loading fresh bakes…";
      wrap.appendChild(label);
      grid.appendChild(wrap);
      loaderStartedAt = Date.now();
    }

    function renderList(list) {
      if (renderTimer) {
        window.clearTimeout(renderTimer);
        renderTimer = 0;
      }
      renderInto(grid, list, { quick: rendered, reveal: false });
      rendered = true;
      loaderStartedAt = 0;

      if (resultCount) {
        resultCount.textContent =
          list.length + (list.length === 1 ? " product" : " products");
      }
    }

    function apply() {
      Bakery.loadProducts().then(function (items) {
        let list = items.slice();

        if (activeCategory !== "All") {
          list = list.filter(function (i) {
            return i.category === activeCategory;
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
        }
        /* Default "featured" sort keeps the original data-file order. */

        const wait = Math.max(0, loaderStartedAt + 450 - Date.now());
        if (wait > 0) {
          renderTimer = window.setTimeout(function () {
            renderList(list);
          }, wait);
        } else {
          renderList(list);
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

    if (sortSelect) {
      sortSelect.addEventListener("change", function () {
        sort = sortSelect.value;
        apply();
      });
    }

    showGridLoader();
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

    // Media
    const media = el.querySelector("[data-modal-media]");
    media.innerHTML = "";
    const img = document.createElement("img");
    img.alt = item.name + " — " + item.category;
    img.width = 640;
    img.height = 480;
    img.setAttribute("data-fallback", item.name + " — photo coming soon");
    media.appendChild(img);
    const imageLoader = Bakery.attachImageLoader(media, img, "Loading " + item.name);
    imageLoader.setSrc(Bakery.itemImage(item, 0));
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
          imageLoader.setSrc(Bakery.itemImage(item, idx));
          renderPrice();
          /* Different size = a different cart line; start the action over. */
          cartQty = 0;
          renderActions();
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

    // Actions: "Add to cart" swaps into a qty stepper once the item is added.
    const actions = el.querySelector("[data-modal-actions]");
    let cartQty = 0;

    function renderActions() {
      actions.innerHTML = "";

      if (cartQty < 1) {
        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "btn btn--primary";
        addBtn.textContent = "Add to cart";
        addBtn.addEventListener("click", function () {
          cartQty = 1;
          Bakery.cart.add(item, sizeIndex, 1, { openDrawer: false });
          renderActions();
        });
        actions.appendChild(addBtn);
        return;
      }

      const stepper = document.createElement("div");
      stepper.className = "qty-stepper";
      stepper.setAttribute("aria-label", "Quantity in cart");

      const minus = document.createElement("button");
      minus.type = "button";
      minus.textContent = "−";
      minus.setAttribute("aria-label", "Decrease quantity");

      const qtyLabel = document.createElement("span");
      qtyLabel.textContent = String(cartQty);
      qtyLabel.setAttribute("aria-live", "polite");

      const plus = document.createElement("button");
      plus.type = "button";
      plus.textContent = "+";
      plus.setAttribute("aria-label", "Increase quantity");

      minus.addEventListener("click", function () {
        Bakery.cart.updateQty(Bakery.cart.lineKey(item, sizeIndex), -1);
        cartQty -= 1;
        renderActions();
      });

      plus.addEventListener("click", function () {
        if (cartQty >= 20) return;
        Bakery.cart.updateQty(Bakery.cart.lineKey(item, sizeIndex), 1);
        cartQty += 1;
        renderActions();
      });

      stepper.appendChild(minus);
      stepper.appendChild(qtyLabel);
      stepper.appendChild(plus);
      actions.appendChild(stepper);
    }
    renderActions();

    el.classList.add("is-open");
    el.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-locked");
    el.querySelector(".modal_close").focus();
  }

  Bakery.openProductModal = openModal;

  /* ---------- Boot ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    initBestsellers();
    initPosterRail();
    initShop();
  });
})();
