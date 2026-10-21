/* ==========================================================================
   cart.js — cart state (localStorage), cart drawer UI, WhatsApp ordering.
   ========================================================================== */

/* --------------------------------------------------------------------------
   The WhatsApp number lives in ONE place: js/main.js → Bakery.config.whatsappNumber
   (set once, in the "Site configuration" block).
   Current: +91 93449 21647 (owner-confirmed).
   The literal below is only a fallback for the unlikely case that main.js
   failed to load.
   -------------------------------------------------------------------------- */
const WHATSAPP_NUMBER =
  (window.Bakery && window.Bakery.config && window.Bakery.config.whatsappNumber) ||
  "919344921647";

const STORAGE_KEY = "veb_cart";

(function () {
  "use strict";

  const Bakery = (window.Bakery = window.Bakery || {});

  /* ---------- State ---------- */

  function readCart() {
    const lines = Bakery.storage.get(STORAGE_KEY, []);
    return Array.isArray(lines) ? lines : [];
  }

  function writeCart(lines) {
    Bakery.storage.set(STORAGE_KEY, lines);
    render();
    if (typeof Bakery.refreshCartBadge === "function") {
      Bakery.refreshCartBadge();
    }
    announce();
  }

  function lineKey(line) {
    return line.id + "::" + line.sizeLabel;
  }

  function cartSubtotal(lines) {
    return lines.reduce(function (sum, line) {
      return sum + line.price * line.qty;
    }, 0);
  }

  function cartCount(lines) {
    return lines.reduce(function (sum, line) {
      return sum + line.qty;
    }, 0);
  }

  /* ---------- Public API ---------- */

  Bakery.cart = {
    /** Add an item (from products.js) with a selected size index.
        Pass { openDrawer: false } to update the cart silently (no drawer). */
    add: function (item, sizeIndex, qty, options) {
      const lines = readCart();
      const sizeLabel = Bakery.itemSizeLabel(item, sizeIndex);
      const price = Bakery.itemPrice(item, sizeIndex);
      const existing = lines.find(function (l) {
        return l.id === item.id && l.sizeLabel === sizeLabel;
      });

      if (existing) {
        existing.qty += qty;
      } else {
        lines.push({
          id: item.id,
          name: item.name,
          sizeLabel: sizeLabel,
          price: price,
          qty: qty,
          image: item.image,
          category: item.category,
        });
      }
      writeCart(lines);
      if (!options || options.openDrawer !== false) openDrawer();
    },

    updateQty: function (key, delta) {
      const lines = readCart();
      const line = lines.find(function (l) {
        return lineKey(l) === key;
      });
      if (!line) return;
      line.qty += delta;
      const next = lines.filter(function (l) {
        return l.qty > 0;
      });
      writeCart(next);
    },

    remove: function (key) {
      const lines = readCart().filter(function (l) {
        return lineKey(l) !== key;
      });
      writeCart(lines);
    },

    /** Cart line key for an item + size (matches updateQty/remove). */
    lineKey: function (item, sizeIndex) {
      return item.id + "::" + Bakery.itemSizeLabel(item, sizeIndex);
    },
  };

  /* ---------- Drawer UI ---------- */

  let drawer = null;
  let overlay = null;
  let lastFocus = null;

  function openDrawer() {
    if (!drawer) return;
    lastFocus = document.activeElement;
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    const toggle = document.querySelector("[data-cart-toggle]");
    if (toggle) toggle.setAttribute("aria-expanded", "true");
    if (overlay) {
      overlay.hidden = false;
      requestAnimationFrame(function () {
        overlay.classList.add("is-open");
      });
    }
    document.body.classList.add("is-locked");
    const closeBtn = drawer.querySelector("[data-cart-close]");
    if (closeBtn) closeBtn.focus();
    document.addEventListener("keydown", onKeydown);
  }

  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    const toggle = document.querySelector("[data-cart-toggle]");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
    if (overlay) overlay.classList.remove("is-open");
    document.body.classList.remove("is-locked");
    document.removeEventListener("keydown", onKeydown);
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  function onKeydown(e) {
    if (e.key === "Escape") {
      closeDrawer();
      return;
    }
    if (e.key !== "Tab" || !drawer.classList.contains("is-open")) return;
    const items = Array.from(
      drawer.querySelectorAll('a[href], button:not([disabled])')
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

  function announce() {
    const live = document.querySelector("[data-cart-live]");
    if (!live) return;
    const lines = readCart();
    const count = cartCount(lines);
    live.textContent =
      count === 0
        ? "Cart is empty."
        : count + (count === 1 ? " item" : " items") + " in cart. Subtotal " +
        Bakery.formatPrice(cartSubtotal(lines)) + ".";
  }

  function buildCartRow(line) {
    const key = lineKey(line);
    const row = document.createElement("div");
    row.className = "cart-line";

    const media = document.createElement("div");
    media.className = "cart-line_media";
    const img = document.createElement("img");
    img.className = "cart-line_img";
    img.src = line.image;
    img.alt = "";
    img.width = 64;
    img.height = 64;
    img.loading = "lazy";
    img.addEventListener("error", function () {
      Bakery.handleImageError(img, "");
    });
    media.appendChild(img);

    const info = document.createElement("div");
    info.className = "cart-line_info";

    /* Row 1: name — stepper */
    const row1 = document.createElement("div");
    row1.className = "cart-line_row";
    const name = document.createElement("p");
    name.className = "cart-line_name";
    name.textContent = line.name;

    const stepper = document.createElement("div");
    stepper.className = "qty-stepper";
    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "−";
    minus.setAttribute("aria-label", "Decrease quantity of " + line.name);
    minus.addEventListener("click", function () {
      Bakery.cart.updateQty(key, -1);
    });
    const qty = document.createElement("span");
    qty.textContent = String(line.qty);
    qty.setAttribute("aria-live", "polite");
    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    plus.setAttribute("aria-label", "Increase quantity of " + line.name);
    plus.addEventListener("click", function () {
      Bakery.cart.updateQty(key, 1);
    });
    stepper.appendChild(minus);
    stepper.appendChild(qty);
    stepper.appendChild(plus);

    row1.appendChild(name);
    row1.appendChild(stepper);

    /* Row 2: size · unit price — line total */
    const row2 = document.createElement("div");
    row2.className = "cart-line_row";
    const meta = document.createElement("p");
    meta.className = "cart-line_meta";
    meta.textContent = line.sizeLabel + " · " + Bakery.formatPrice(line.price) + " each";
    const priceEl = document.createElement("p");
    priceEl.className = "cart-line_price";
    priceEl.textContent = Bakery.formatPrice(line.price * line.qty);

    row2.appendChild(meta);
    row2.appendChild(priceEl);

    info.appendChild(row1);
    info.appendChild(row2);

    row.appendChild(media);
    row.appendChild(info);
    return row;
  }

  function render() {
    const lines = readCart();

    if (drawer) {
      const wrap = drawer.querySelector("[data-cart-lines]");
      const subtotalEl = drawer.querySelector("[data-cart-subtotal]");
      if (wrap) {
        wrap.innerHTML = "";

        if (!lines.length) {
          const empty = document.createElement("p");
          empty.className = "empty-state";
          empty.textContent = "Your cart is empty. Add something fresh from the shop.";
          wrap.appendChild(empty);
        } else {
          lines.forEach(function (line) {
            wrap.appendChild(buildCartRow(line));
          });
        }
      }

      if (subtotalEl) {
        subtotalEl.textContent = Bakery.formatPrice(cartSubtotal(lines));
      }

      const orderBtn = drawer.querySelector("[data-order-whatsapp]");
      if (orderBtn) orderBtn.disabled = lines.length === 0;
    }

    renderCartPage(lines);
    renderCartBar(lines);
  }

  /* ---------- Cart page (cart.html) ---------- */

  function renderCartPage(lines) {
    const page = document.querySelector("[data-cart-page]");
    if (!page) return;

    const wrap = page.querySelector("[data-cart-page-lines]");
    const subtotalEl = page.querySelector("[data-cart-page-subtotal]");
    const countEl = page.querySelector("[data-cart-page-count]");
    const orderBtn = page.querySelector("[data-order-whatsapp]");
    const emptyEl = page.querySelector("[data-cart-page-empty]");
    const contentEl = page.querySelector("[data-cart-page-content]");
    if (!wrap) return;

    wrap.innerHTML = "";

    if (!lines.length) {
      if (emptyEl) emptyEl.hidden = false;
      if (contentEl) contentEl.hidden = true;
      return;
    }

    if (emptyEl) emptyEl.hidden = true;
    if (contentEl) contentEl.hidden = false;

    lines.forEach(function (line) {
      wrap.appendChild(buildCartRow(line));
    });

    if (subtotalEl) {
      subtotalEl.textContent = Bakery.formatPrice(cartSubtotal(lines));
    }
    if (countEl) {
      const count = cartCount(lines);
      countEl.textContent = count + (count === 1 ? " item" : " items");
    }
    if (orderBtn) orderBtn.disabled = false;
  }

  /* ---------- Sticky bottom cart bar ---------- */

  function renderCartBar(lines) {
    const bar = document.querySelector("[data-cart-bar]");
    if (!bar) return;

    /* You're already on the cart page — the bar would be redundant. */
    if (document.body.getAttribute("data-page") === "cart") {
      bar.classList.remove("is-visible");
      bar.hidden = true;
      return;
    }

    const count = cartCount(lines);
    if (count === 0) {
      bar.classList.remove("is-visible");
      bar.hidden = true;
      return;
    }

    const countEl = bar.querySelector("[data-cart-bar-count]");
    const totalEl = bar.querySelector("[data-cart-bar-total]");
    if (countEl) {
      countEl.textContent = count + (count === 1 ? " item" : " items");
    }
    if (totalEl) {
      totalEl.textContent = Bakery.formatPrice(cartSubtotal(lines));
    }

    bar.hidden = false;
    /* Double rAF so the browser paints the hidden position before sliding up. */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        bar.classList.add("is-visible");
      });
    });
  }

  /* ---------- WhatsApp order ---------- */

  function buildOrderMessage() {
    const lines = readCart();
    const total = cartSubtotal(lines);

    const itemLines = lines.map(function (line, idx) {
      return (
        idx + 1 +
        ". " +
        line.name +
        " (" +
        line.sizeLabel +
        ") x" +
        line.qty +
        " — ₹" +
        line.price * line.qty
      );
    });

    return [
      "Hello Nilgiribytes! I would like to place an order:",
      "",
      itemLines.join("\n"),
      "",
      "Total: ₹" + total,
      "",
      "Items: " + cartCount(lines),
      "(Please confirm delivery/pickup details. — order from website)",
    ].join("\n");
  }

  function orderOnWhatsApp() {
    const lines = readCart();
    if (!lines.length) return;
    const message = buildOrderMessage();
    const url =
      typeof Bakery.whatsappLink === "function"
        ? Bakery.whatsappLink(message)
        : "https://wa.me/" +
          WHATSAPP_NUMBER +
          "?text=" +
          encodeURIComponent(message);
    window.open(url, "_blank", "noopener");
  }

  /* ---------- Boot ---------- */
  function init() {
    drawer = document.getElementById("cart-drawer");
    overlay = document.querySelector("[data-overlay]");

    document.querySelectorAll("[data-cart-toggle]").forEach(function (btn) {
      btn.addEventListener("click", openDrawer);
    });
    document.querySelectorAll("[data-cart-close]").forEach(function (btn) {
      btn.addEventListener("click", closeDrawer);
    });
    if (overlay) {
      overlay.addEventListener("click", function () {
        if (drawer && drawer.classList.contains("is-open")) closeDrawer();
        const nav = document.getElementById("site-nav");
        if (nav && nav.classList.contains("is-open")) {
          const navClose = document.querySelector("[data-nav-close]");
          if (navClose) navClose.click();
        }
      });
    }

    if (drawer) {
      const drawerOrderBtn = drawer.querySelector("[data-order-whatsapp]");
      if (drawerOrderBtn) drawerOrderBtn.addEventListener("click", orderOnWhatsApp);
    }

    /* Sticky bar "View Cart" → dedicated cart page. */
    document.querySelectorAll("[data-cart-bar-view]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        window.location.href = "cart.html";
      });
    });

    /* Cart page order button (guard against double-binding on partials:ready). */
    document.querySelectorAll("[data-order-whatsapp]").forEach(function (btn) {
      if (btn.closest("#cart-drawer") || btn.dataset.bound === "1") return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", orderOnWhatsApp);
    });

    render();
    announce();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Partials may arrive after cart init; re-init when they do.
  document.addEventListener("partials:ready", function () {
    drawer = null;
    init();
    render();
  });
})();
