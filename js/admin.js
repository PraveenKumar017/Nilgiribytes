/* ==========================================================================
   admin.html — catalog manager backed by the Vercel catalog API.
   ========================================================================== */

(function () {
  "use strict";

  const API_URL = "api/catalog";
  const BLOG_URL = "api/blog";

  const state = {
    products: [],
    combos: [],
    blogPosts: [],
    blogLoaded: false,
    blogLoading: false,
    blogSaving: false,
    editing: null, // { type: "product"|"combo", index: number|null }
    dirty: false,
    publishing: false,
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
    blogList: $("[data-blog-list]"),
    drawer: $("[data-admin-drawer]"),
    overlay: $("[data-admin-overlay]"),
    drawerTitle: $("[data-admin-drawer-title]"),
    form: $("[data-admin-form]"),
    sizes: $("[data-admin-sizes]"),
    sizesRows: $("[data-admin-sizes-rows]"),
    comboFields: $("[data-admin-combo-fields]"),
    publishBtn: $("[data-admin-publish]"),
    status: $("[data-admin-status]"),
    loginScreen: $("#login-screen"),
    adminScreen: $("#admin-screen"),
    loginForm: $("#login-form"),
    loginBtn: $("#login-btn"),
    loginError: $("#login-error"),
    username: $("#username"),
    password: $("#password"),
    passwordToggle: $("#password-toggle"),
    logoutBtn: $("[data-admin-logout]"),
  };

  let lastFocus = null;

  /* ---------- Auth / API ---------- */

  function setStatus(message, tone) {
    if (!els.status) return;
    els.status.textContent = message || "";
    if (tone) els.status.setAttribute("data-tone", tone);
    else els.status.removeAttribute("data-tone");
  }

  function updatePublishState() {
    if (!els.publishBtn) return;
    els.publishBtn.disabled = state.publishing || !state.dirty;
    els.publishBtn.textContent = state.publishing ? "Publishing..." : "Publish changes";
  }

  function markDirty() {
    state.dirty = true;
    updatePublishState();
    setStatus("Unsaved changes. Publish to update the live site.", "dirty");
  }

  function applyCatalog(catalog) {
    state.products = Array.isArray(catalog.products) ? catalog.products : [];
    state.combos = Array.isArray(catalog.combos) ? catalog.combos : [];
    renderAll();
  }

  function showLogin() {
    if (els.loginScreen) els.loginScreen.hidden = false;
    if (els.adminScreen) els.adminScreen.hidden = true;
    if (els.password) els.password.value = "";
    if (els.loginError) els.loginError.hidden = true;
    if (els.username) els.username.focus();
  }

  function showAdmin() {
    if (els.loginScreen) els.loginScreen.hidden = true;
    if (els.adminScreen) els.adminScreen.hidden = false;
  }

  function api(path, options) {
    const opts = options || {};
    const headers = Object.assign({ Accept: "application/json" }, opts.headers || {});
    if (opts.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    return fetch(path, Object.assign({}, opts, {
      credentials: "same-origin",
      cache: "no-store",
      headers: headers,
    }))
      .then(function (res) {
        return res
          .json()
          .catch(function () {
            return {};
          })
          .then(function (data) {
            if (res.status === 401) showLogin();
            if (!res.ok) {
              const error = new Error(
                data.error || "Request failed (" + res.status + ")."
              );
              error.status = res.status;
              error.code = data.code;
              throw error;
            }
            return data;
          });
      });
  }

  function handleLogin(e) {
    e.preventDefault();
    if (!els.loginForm) return;

    const username = els.username ? els.username.value.trim() : "";
    const password = els.password ? els.password.value : "";

    if (els.loginError) els.loginError.hidden = true;
    if (els.loginBtn) {
      els.loginBtn.disabled = true;
      els.loginBtn.textContent = "Signing in...";
    }

    fetch("api/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username, password: password }),
    })
      .then(function (res) {
        return res
          .json()
          .catch(function () {
            return {};
          })
          .then(function (data) {
            if (!res.ok) {
              throw new Error(data.error || "Login failed (" + res.status + ").");
            }
            return data;
          });
      })
      .then(function () {
        if (els.password) els.password.value = "";
        showAdmin();
        if (!state.dirty) loadData();
      })
      .catch(function (err) {
        if (els.loginError) {
          els.loginError.textContent = err.message || "Login failed.";
          els.loginError.hidden = false;
        }
        if (els.password) els.password.value = "";
      })
      .finally(function () {
        if (els.loginBtn) {
          els.loginBtn.disabled = false;
          els.loginBtn.textContent = "Login";
        }
      });
  }

  function logout() {
    fetch("api/logout", { method: "POST", credentials: "same-origin" })
      .catch(function () {
        return null;
      })
      .finally(function () {
        state.dirty = false;
        updatePublishState();
        showLogin();
        setStatus("Logged out.", "muted");
      });
  }

  function initAuth() {
    fetch("api/me", { credentials: "same-origin", cache: "no-store" })
      .then(function (res) {
        return res
          .json()
          .catch(function () {
            return {};
          })
          .then(function (data) {
            return { res: res, data: data };
          });
      })
      .then(function (result) {
        if (result.res.ok && result.data.authenticated) {
          showAdmin();
          loadData();
        } else {
          showLogin();
        }
      })
      .catch(function () {
        showLogin();
      });
  }

  function loadData() {
    return api(API_URL)
      .then(function (catalog) {
        applyCatalog(catalog);
        state.dirty = false;
        updatePublishState();
        setStatus("");
      })
      .catch(function (err) {
        console.error(err);
        renderAll();
        setStatus(err.message || "Could not load the catalog.", "error");
      });
  }

  function loadBlog() {
    if (!els.blogList || state.blogLoading || state.blogLoaded) return;
    state.blogLoading = true;
    renderBlogMessage("Loading posts...");

    api(BLOG_URL)
      .then(function (blog) {
        state.blogPosts = Array.isArray(blog.posts) ? blog.posts : [];
        state.blogLoaded = true;
        renderBlogList();
      })
      .catch(function (err) {
        console.error(err);
        state.blogPosts = [];
        renderBlogMessage(err.message || "Could not load blog posts.");
      })
      .finally(function () {
        state.blogLoading = false;
      });
  }

  function deleteBlogPost(index) {
    if (state.blogSaving) return;
    const post = state.blogPosts[index];
    if (!post) return;
    if (!confirm('Delete "' + (post.title || "this post") + '"? This will remove it from the live blog.')) {
      return;
    }

    const removed = state.blogPosts.splice(index, 1)[0];
    state.blogSaving = true;
    renderBlogList();
    setStatus('Deleting "' + (post.title || "post") + '"...', "muted");

    api(BLOG_URL, {
      method: "PUT",
      body: JSON.stringify({ posts: state.blogPosts }),
    })
      .then(function (result) {
        state.blogLoaded = true;
        setStatus(
          'Deleted "' + (post.title || "post") + '". ' +
            result.posts + " posts published.",
          "success"
        );
      })
      .catch(function (err) {
        state.blogPosts.splice(index, 0, removed);
        renderBlogList();
        setStatus(err.message || "Delete failed.", "error");
      })
      .finally(function () {
        state.blogSaving = false;
      });
  }

  async function publishCatalog() {
    if (state.publishing || !state.dirty) return;

    state.publishing = true;
    updatePublishState();
    setStatus("Publishing to GitHub...", "muted");

    const body = JSON.stringify({
      products: state.products,
      combos: state.combos,
    });

    try {
      let result = null;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          result = await api(API_URL, { method: "PUT", body: body });
          break;
        } catch (err) {
          if (err.code === "CONFLICT" && attempt === 0) {
            setStatus("Another update was detected. Retrying...", "dirty");
            continue;
          }
          throw err;
        }
      }

      state.dirty = false;
      setStatus(
        "Published " + result.products + " products and " +
          result.combos + " combos.",
        "success"
      );
    } catch (err) {
      setStatus(err.message || "Publish failed.", "error");
    } finally {
      state.publishing = false;
      updatePublishState();
    }
  }

  /* ---------- List rendering ---------- */

  function renderAll() {
    renderList(els.productsList, state.products, "product");
    renderList(els.combosList, state.combos, "combo");
  }

  function renderBlogMessage(message) {
    if (!els.blogList) return;
    els.blogList.innerHTML = "";
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.className = "admin-empty";
    td.textContent = message;
    tr.appendChild(td);
    els.blogList.appendChild(tr);
  }

  function formatBlogDate(iso) {
    const d = new Date(String(iso || "") + "T00:00:00");
    if (isNaN(d.getTime())) return iso || "—";
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function renderBlogList() {
    if (!els.blogList) return;
    if (!state.blogPosts.length) {
      renderBlogMessage("No blog posts found.");
      return;
    }

    els.blogList.innerHTML = "";
    state.blogPosts.forEach(function (post, index) {
      const tr = document.createElement("tr");

      const tdImg = document.createElement("td");
      tdImg.className = "admin-cell_img";
      const img = document.createElement("img");
      img.src = post.image || "";
      img.alt = "";
      img.loading = "lazy";
      img.addEventListener("error", function () {
        img.style.visibility = "hidden";
      });
      tdImg.appendChild(img);
      tr.appendChild(tdImg);

      const tdTitle = document.createElement("td");
      const title = document.createElement("p");
      title.className = "admin-row_name";
      title.textContent = post.title || "(Untitled)";
      tdTitle.appendChild(title);
      tr.appendChild(tdTitle);

      const tdCategory = document.createElement("td");
      tdCategory.textContent = post.category || "—";
      tr.appendChild(tdCategory);

      const tdDate = document.createElement("td");
      tdDate.className = "admin-cell_price";
      tdDate.textContent = formatBlogDate(post.date);
      tr.appendChild(tdDate);

      const tdFeatured = document.createElement("td");
      tdFeatured.className = post.featured ? "admin-cell_price is-set" : "admin-cell_price";
      tdFeatured.textContent = post.featured ? "Yes" : "—";
      tr.appendChild(tdFeatured);

      const tdAction = document.createElement("td");
      tdAction.className = "admin-cell_actions";
      const link = document.createElement("a");
      link.className = "admin-blog-link";
      link.href = "blog.html?slug=" + encodeURIComponent(post.slug || "");
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "View";
      tdAction.appendChild(link);

      const del = document.createElement("button");
      del.type = "button";
      del.className = "admin-icon-btn admin-icon-btn--danger";
      del.setAttribute("aria-label", "Delete " + (post.title || "post"));
      del.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4zM6 9h12l-1 12H7zm4 2v8h2v-8zm4 0v8h2v-8z"/></svg>';
      del.addEventListener("click", function () {
        deleteBlogPost(index);
      });
      tdAction.appendChild(del);

      tr.appendChild(tdAction);

      els.blogList.appendChild(tr);
    });
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
    markDirty();
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

  /* ---------- Editor modal ---------- */

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

    els.drawer.hidden = false;
    els.overlay.hidden = false;
    requestAnimationFrame(function () {
      els.drawer.classList.add("is-open");
      els.overlay.classList.add("is-open");
    });
    document.body.style.overflow = "hidden";
    els.form.name.focus();
  }

  function closeEditor() {
    els.drawer.classList.remove("is-open");
    els.overlay.classList.remove("is-open");
    document.body.style.overflow = "";
    window.setTimeout(function () {
      els.drawer.hidden = true;
      els.overlay.hidden = true;
    }, 220);
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

  function nextId(type) {
    var prefix = type === "combo" ? "cm-" : "pr-";
    var list = type === "combo" ? state.combos : state.products;
    var max = 0;
    list.forEach(function (item) {
      var match = String(item.id || "").match(
        new RegExp("^" + prefix + "(\\d+)$"),
      );
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return prefix + String(max + 1).padStart(3, "0");
  }

  function submitEditor(e) {
    e.preventDefault();
    const edit = state.editing;
    if (!edit) return;

    const type = edit.type;
    const list = type === "product" ? state.products : state.combos;
    const existing = edit.index == null ? null : list[edit.index];
    const name = els.form.name.value.trim();
    if (!name) {
      alert("Name is required.");
      return;
    }

    const id = existing && existing.id ? existing.id : nextId(type);

    const base = {
      id: id,
      name: name,
      category: els.form.category.value.trim() || (type === "combo" ? "Combos" : "Varkey"),
      description: els.form.description.value.trim(),
      image: els.form.image.value.trim(),
    };

    let item;
    if (type === "combo") {
      item = Object.assign({}, existing || {}, base, {
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
            const product = state.products.find(function (p) {
              return p.name.trim().toLowerCase() === name.toLowerCase();
            });
            return {
              productId: product ? product.id : "",
              name: name,
              quantity: quantity,
            };
          })
          .filter(Boolean),
      });
    } else {
      item = Object.assign({}, existing || {}, base, { sizes: readSizes() });
      if (!item.sizes.length) {
        alert("Add at least one size with a label and price.");
        return;
      }
    }

    if (edit.index == null) list.push(item);
    else list[edit.index] = item;

    markDirty();
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
    if (view === "blog") loadBlog();
  }

  document.addEventListener("DOMContentLoaded", function () {
    els.form.addEventListener("submit", submitEditor);
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
    els.publishBtn.addEventListener("click", publishCatalog);

    if (els.loginForm) els.loginForm.addEventListener("submit", handleLogin);
    if (els.logoutBtn) els.logoutBtn.addEventListener("click", logout);

    if (els.passwordToggle && els.password) {
      els.passwordToggle.addEventListener("click", function () {
        const show = els.password.type === "password";
        els.password.type = show ? "text" : "password";
        els.passwordToggle.classList.toggle("is-visible", show);
        els.passwordToggle.setAttribute(
          "aria-label",
          show ? "Hide password" : "Show password"
        );
      });
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !els.drawer.hidden) closeEditor();
    });

    updatePublishState();
    initAuth();
  });
})();
