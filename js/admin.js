/* ==========================================================================
   admin.html — client-side product & combo manager.
   Loads data/products.json + data/combos.json, edits them in memory,
   and persists a draft to localStorage for this browser.
   ========================================================================== */

(function () {
  "use strict";

  const DRAFT_KEY = "veb_admin_draft";

  const state = {
    products: [],
    combos: [],
    editing: null, // { type: "product"|"combo", index: number|null }
  };

  const $ = function (sel, root) {
    return (root || document).querySelector(sel);
  };
  const $$ = function (sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  };

  const els = {
    productsList: $("[data-products-list]"),
    combosList: $("[data-combos-list]"),
    drawer: $("[data-admin-drawer]"),
    overlay: $("[data-admin-overlay]"),
    drawerTitle: $("[data-admin-drawer-title]"),
    form: $("[data-admin-form]"),
    sizes: $("[data-admin-sizes]"),
    sizesRows: $("[data-admin-sizes-rows]"),
    comboFields: $("[data-admin-combo-fields]"),
    deleteBtn: $("[data-admin-delete]"),
  };

  let lastFocus = null;

  /* ---------- Load / persist ---------- */

  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const draft = JSON.parse(raw);
      if (!Array.isArray(draft.products) || !Array.isArray(draft.combos)) return null;
      return draft;
    } catch (e) {
      return null;
    }
  }

  function saveDraft() {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ products: state.products, combos: state.combos })
    );
  }

  function loadData() {
    const draft = loadDraft();
    if (draft) {
      state.products = draft.products;
      state.combos = draft.combos;
      renderAll();
      return Promise.resolve();
    }
    return Promise.all([
      fetch("data/products.json").then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      }),
      fetch("data/combos.json").then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      }),
    ])
      .then(function (res) {
        state.products = res[0].products || [];
        state.combos = res[1].combos || [];
        saveDraft();
        renderAll();
      })
      .catch(function (err) {
        console.error(err);
        renderAll();
      });
  }

  /* ---------- List rendering ---------- */

  function renderAll() {
    renderList(els.productsList, state.products, "product");
    renderList(els.combosList, state.combos, "combo");
  }

  const FIXED_SIZE_LABELS = ["200g", "250g", "400g", "500g"];

  function renderList(container, items, type) {
    if (!container) return;
    container.innerHTML = "";
    if (!items.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = type === "product" ? 7 : 5;
      td.className = "admin-empty";
      td.textContent = type === "product" ? "No products yet." : "No combos yet.";
      tr.appendChild(td);
      container.appendChild(tr);
      return;
    }
    items.forEach(function (item, index) {
      container.appendChild(buildRow(item, type, index));
    });
  }

  function buildRow(item, type, index) {
    const tr = document.createElement("tr");

    /* Image */
    const tdImg = document.createElement("td");
    tdImg.className = "admin-cell_img";
    const img = document.createElement("img");
    img.src = item.image || "";
    img.alt = "";
    img.loading = "lazy";
    img.addEventListener("error", function () {
      img.style.visibility = "hidden";
    });
    tdImg.appendChild(img);
    tr.appendChild(tdImg);

    /* Name */
    const tdName = document.createElement("td");
    const name = document.createElement("p");
    name.className = "admin-row_name";
    name.textContent = item.name;
    tdName.appendChild(name);
    tr.appendChild(tdName);

    if (type === "product") {
      /* One column per fixed size label; blank if the product lacks it. */
      const byLabel = {};
      (item.sizes || []).forEach(function (s) {
        byLabel[s.label] = s;
      });
      FIXED_SIZE_LABELS.forEach(function (label) {
        const td = document.createElement("td");
        td.className = "admin-cell_price";
        const size = byLabel[label];
        td.textContent = size ? "₹" + size.price : "—";
        if (size && size.price > 1) td.classList.add("is-set");
        tr.appendChild(td);
      });
    } else {
      const tdWeight = document.createElement("td");
      tdWeight.textContent = item.weight || "—";
      tr.appendChild(tdWeight);

      const tdPrice = document.createElement("td");
      tdPrice.className = "admin-cell_price is-set";
      tdPrice.textContent = "₹" + item.price;
      tr.appendChild(tdPrice);
    }

    /* Action */
    const tdAction = document.createElement("td");
    tdAction.className = "admin-cell_actions";

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "admin-icon-btn";
    edit.setAttribute("aria-label", "Edit " + item.name);
    edit.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.1 5.6a2 2 0 0 1 2.8 0l1.5 1.5a2 2 0 0 1 0 2.8L9.4 19.3a2 2 0 0 1-.9.5l-3.8 1a.8.8 0 0 1-1-1l1-3.8a2 2 0 0 1 .5-.9zM15 7l-8.5 8.5-1 3.5 3.5-1L17 9z"/></svg>';
    edit.addEventListener("click", function () {
      openEditor(type, index);
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "admin-icon-btn admin-icon-btn--danger";
    del.setAttribute("aria-label", "Delete " + item.name);
    del.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4zM6 9h12l-1 12H7zm4 2v8h2v-8zm4 0v8h2v-8z"/></svg>';
    del.addEventListener("click", function () {
      deleteItem(type, index);
    });

    tdAction.appendChild(edit);
    tdAction.appendChild(del);
    tr.appendChild(tdAction);

    return tr;
  }

  function deleteItem(type, index) {
    const list = type === "product" ? state.products : state.combos;
    const item = list[index];
    if (!item) return;
    if (!confirm('Delete "' + item.name + '"?')) return;
    list.splice(index, 1);
    saveDraft();
    renderAll();
  }

  /* ---------- Sizes editor helpers ---------- */

  function addSizeRow(size) {
    const row = document.createElement("div");
    row.className = "admin-size-row";
    row.innerHTML =
      '<input type="text" data-size-label placeholder="Label" value="' +
      escapeAttr((size && size.label) || "") +
      '">' +
      '<input type="number" data-size-grams min="0" placeholder="Grams" value="' +
      (size && size.grams != null ? size.grams : "") +
      '">' +
      '<input type="number" data-size-price min="0" step="1" placeholder="Price ₹" value="' +
      (size && size.price != null ? size.price : "") +
      '">' +
      '<button type="button" class="admin-size-remove" aria-label="Remove size">×</button>';
    row.querySelector(".admin-size-remove").addEventListener("click", function () {
      row.remove();
    });
    els.sizesRows.appendChild(row);
  }

  function escapeAttr(str) {
    return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  function readSizes() {
    return $$(".admin-size-row", els.sizesRows)
      .map(function (row) {
        const label = row.querySelector("[data-size-label]").value.trim();
        const grams = parseInt(row.querySelector("[data-size-grams]").value, 10);
        const price = parseFloat(row.querySelector("[data-size-price]").value);
        if (!label || isNaN(price)) return null;
        return { label: label, grams: isNaN(grams) ? null : grams, price: price };
      })
      .filter(Boolean);
  }

  /* ---------- Editor drawer ---------- */

  function syncTypeFields() {
    const isCombo = state.editing && state.editing.type === "combo";
    els.sizes.hidden = isCombo;
    els.comboFields.hidden = !isCombo;
  }

  function openEditor(type, index) {
    lastFocus = document.activeElement;
    state.editing = { type: type, index: index == null ? null : index };
    const item =
      index == null
        ? defaultItem(type)
        : type === "product"
          ? state.products[index]
          : state.combos[index];

    els.form.id.value = item.id || "";
    els.form.name.value = item.name || "";
    els.form.category.value = item.category || "";
    els.form.description.value = item.description || "";
    els.form.image.value = item.image || "";

    els.sizesRows.innerHTML = "";
    (item.sizes || []).forEach(addSizeRow);
    if (!(item.sizes || []).length && type === "product") addSizeRow();

    els.form.price.value = item.price != null ? item.price : "";
    els.form.weight.value = item.weight || "";
    els.form.includes.value = (item.includes || [])
      .map(function (i) {
        return i.name + " | " + i.quantity;
      })
      .join("\n");

    syncTypeFields();
    els.drawerTitle.textContent =
      (index == null ? "Add " : "Edit ") + (type === "combo" ? "combo" : "product");
    els.deleteBtn.hidden = index == null;

    els.drawer.hidden = false;
    els.overlay.hidden = false;
    requestAnimationFrame(function () {
      els.drawer.classList.add("is-open");
      els.overlay.classList.add("is-open");
    });
    document.body.style.overflow = "hidden";
    els.form.id.focus();
  }

  function closeEditor() {
    els.drawer.classList.remove("is-open");
    els.overlay.classList.remove("is-open");
    document.body.style.overflow = "";
    window.setTimeout(function () {
      els.drawer.hidden = true;
      els.overlay.hidden = true;
    }, 200);
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  function defaultItem(type) {
    if (type === "combo") {
      return {
        id: "",
        name: "",
        category: "Combos",
        description: "",
        image: "assets/images/products/varkey.png",
        weight: "1 kg total",
        price: 0,
        includes: [],
      };
    }
    return {
      id: "",
      name: "",
      category: "Varkey",
      description: "",
      image: "assets/images/products/varkey.png",
      sizes: [{ label: "200g", grams: 200, price: 1 }],
    };
  }

  function slugify(str) {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function submitEditor(e) {
    e.preventDefault();
    const edit = state.editing;
    if (!edit) return;

    const type = edit.type;
    const id = els.form.id.value.trim() || slugify(els.form.name.value);
    if (!id) {
      alert("ID (or a name to slugify) is required.");
      return;
    }

    /* ID uniqueness within its collection */
    const list = type === "product" ? state.products : state.combos;
    const dupe = list.some(function (item, i) {
      return item.id === id && i !== edit.index;
    });
    if (dupe) {
      alert('ID "' + id + '" already exists. IDs must be unique.');
      return;
    }

    const base = {
      id: id,
      name: els.form.name.value.trim(),
      category: els.form.category.value.trim() || (type === "combo" ? "Combos" : "Varkey"),
      description: els.form.description.value.trim(),
      image: els.form.image.value.trim(),
    };

    let item;
    if (type === "combo") {
      item = Object.assign(base, {
        category: "Combos",
        price: parseFloat(els.form.price.value) || 0,
        weight: els.form.weight.value.trim() || "1 kg total",
        includes: els.form.includes.value
          .split("\n")
          .map(function (line) {
            const parts = line.split("|");
            if (parts.length < 2) return null;
            const name = parts[0].trim();
            const quantity = parts[1].trim();
            if (!name) return null;
            return { productId: slugify(name), name: name, quantity: quantity };
          })
          .filter(Boolean),
      });
    } else {
      item = Object.assign(base, { sizes: readSizes() });
      if (!item.sizes.length) {
        alert("Add at least one size with a label and price.");
        return;
      }
    }

    if (edit.index == null) list.push(item);
    else list[edit.index] = item;

    saveDraft();
    renderAll();
    closeEditor();
  }

  function deleteCurrent() {
    const edit = state.editing;
    if (!edit || edit.index == null) return;
    const list = edit.type === "product" ? state.products : state.combos;
    const item = list[edit.index];
    if (!confirm('Delete "' + item.name + '"?')) return;
    list.splice(edit.index, 1);
    saveDraft();
    renderAll();
    closeEditor();
  }

  /* ---------- Boot ---------- */

  function switchView(view) {
    $$("[data-admin-view]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-admin-view") === view);
    });
    $$("[data-admin-view-panel]").forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-admin-view-panel") !== view;
    });
    const title = $("[data-admin-title]");
    const actions = $("[data-admin-actions]");
    if (title) title.textContent = view === "blog" ? "Blog" : "Catalog";
    if (actions) actions.hidden = view === "blog";
  }

  document.addEventListener("DOMContentLoaded", function () {
    els.form.addEventListener("submit", submitEditor);
    els.deleteBtn.addEventListener("click", deleteCurrent);
    $("[data-admin-close]").addEventListener("click", closeEditor);
    els.overlay.addEventListener("click", closeEditor);

    $$("[data-admin-view]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        switchView(btn.getAttribute("data-admin-view"));
      });
    });

    $("[data-admin-add]").addEventListener("click", function () {
      openEditor("product", null);
    });
    $("[data-admin-add-combo]").addEventListener("click", function () {
      openEditor("combo", null);
    });
    $("[data-admin-add-size]").addEventListener("click", function () {
      addSizeRow();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !els.drawer.hidden) closeEditor();
    });

    loadData();
  });
})();
