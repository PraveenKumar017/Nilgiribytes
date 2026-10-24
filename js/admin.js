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
    blogVersion: null,
    editing: null, // { type: "product"|"combo", index: number|null }
    blogEditing: null, // { index: number|null, post: object|null }
    blogSlugTouched: false,
    blogStatus: "draft",
    blogDirty: false,
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
    blogAddBtn: $("[data-blog-add]"),
    blogListPane: $("#blog-list-pane"),
    blogEditorPane: $("#blog-editor-pane"),
    blogBackBtn: $("[data-blog-back]"),
    blogEditorTitle: $("[data-blog-editor-title]"),
    blogEditorStatus: $("[data-blog-editor-status]"),
    blogLiveNotice: $("[data-blog-live-notice]"),
    blogTitle: $("[data-blog-title]"),
    blogCategory: $("[data-blog-category]"),
    blogAuthor: $("[data-blog-author]"),
    blogDate: $("[data-blog-date]"),
    blogExcerpt: $("[data-blog-excerpt]"),
    blogFile: $("[data-blog-file]"),
    blogUploadBtn: $("[data-blog-upload-btn]"),
    blogCoverWrap: $("[data-blog-cover-wrap]"),
    blogCoverImg: $("[data-blog-cover-img]"),
    blogCoverReplace: $("[data-blog-cover-replace]"),
    blogCoverRemove: $("[data-blog-cover-remove]"),
    blogImage: $("[data-blog-image]"),
    blogImageAlt: $("[data-blog-image-alt]"),
    blogBlocks: $("[data-blog-blocks]"),
    blogReadtime: $("[data-blog-readtime]"),
    blogReadingTimeInput: $("[data-blog-reading-time]"),
    blogSlug: $("[data-blog-slug]"),
    blogSaveBtn: $("[data-blog-save]"),
    blogSaveDraftBtn: $("[data-blog-save-draft]"),
    blogCancelBtn: $("[data-blog-cancel]"),
    blogPreviewRoot: $("[data-blog-preview-root]"),
    blogPreviewToggle: $("[data-blog-preview-toggle]"),
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

  function loadBlog(force) {
    if (!els.blogList) return;
    if (state.blogLoading) return;
    if (state.blogLoaded && !force) return;
    state.blogLoading = true;
    renderBlogMessage("Loading posts...");

    api(BLOG_URL)
      .then(function (blog) {
        state.blogPosts = Array.isArray(blog.posts) ? blog.posts : [];
        state.blogVersion = blog.version || null;
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

    state.blogSaving = true;
    renderBlogList();
    setStatus('Deleting "' + (post.title || "post") + '"...', "muted");

    api(BLOG_URL, {
      method: "DELETE",
      body: JSON.stringify({ slug: post.slug, version: state.blogVersion }),
    })
      .then(function (result) {
        state.blogVersion = result.version || state.blogVersion;
        state.blogLoaded = false;
        loadBlog(true);
        setStatus(
          'Deleted "' + (post.title || "post") + '".',
          "success"
        );
      })
      .catch(function (err) {
        loadBlog(true);
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
      if (!els.blogList) return;
      els.blogList.innerHTML = "";
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 6;
      td.className = "admin-empty";
      const msg = document.createElement("span");
      msg.textContent = "No posts yet. ";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn--small";
      btn.textContent = "Write your first post";
      btn.addEventListener("click", function () { openBlogEditor(null, null); });
      td.appendChild(msg);
      td.appendChild(btn);
      tr.appendChild(td);
      els.blogList.appendChild(tr);
      return;
    }

    els.blogList.innerHTML = "";
    state.blogPosts.forEach(function (post, index) {
      const tr = document.createElement("tr");

      const tdImg = document.createElement("td");
      tdImg.className = "admin-cell_img";
      const img = document.createElement("img");
      img.src = post.image || "";
      img.alt = post.imageAlt || post.title || "";
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

      const tdStatus = document.createElement("td");
      const badge = document.createElement("span");
      const isPublished = post.status === "published";
      badge.className = "admin-blog-badge admin-blog-badge--" + (isPublished ? "published" : "draft");
      badge.textContent = isPublished ? "Published" : "Draft";
      tdStatus.appendChild(badge);
      tr.appendChild(tdStatus);

      const tdAction = document.createElement("td");
      tdAction.className = "admin-cell_actions";

      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "admin-icon-btn";
      edit.setAttribute("aria-label", "Edit " + (post.title || "post"));
      edit.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.1 5.6a2 2 0 0 1 2.8 0l1.5 1.5a2 2 0 0 1 0 2.8L9.4 19.3a2 2 0 0 1-.9.5l-3.8 1a.8.8 0 0 1-1-1l1-3.8a2 2 0 0 1 .5-.9zM15 7l-8.5 8.5-1 3.5 3.5-1L17 9z"/></svg>';
      edit.addEventListener("click", function () {
        openBlogEditor(state.blogPosts[index], index);
      });
      tdAction.appendChild(edit);

      if (!isPublished) {
        const pub = document.createElement("button");
        pub.type = "button";
        pub.className = "admin-icon-btn";
        pub.setAttribute("aria-label", "Publish " + (post.title || "post"));
        pub.innerHTML =
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20h14v-2H5v2zm0-10h4v6h6v-6h4l-7-7-7 7z"/></svg>';
        pub.addEventListener("click", function () {
          publishBlogPost(index);
        });
        tdAction.appendChild(pub);
      }

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

  /* ---------- Blog editor ---------- */

  const BLOG_CATEGORIES = ["Bakery Stories", "Recipes", "Baking Tips", "Ingredients", "News"];
  const BLOG_AUTHOR_DEFAULT = "Nilgiribytes Team";

  function slugifyBlog(str) {
    return String(str || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function todayISO() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + mm + "-" + dd;
  }

  function countWords(str) {
    const trimmed = String(str || "").trim();
    if (!trimmed) return 0;
    return trimmed.split(" ").filter(Boolean).length;
  }

  function blogWordCount(content) {
    let words = 0;
    (content || []).forEach(function (block) {
      if (!block) return;
      if (block.text) words += countWords(block.text);
      if (Array.isArray(block.items)) {
        block.items.forEach(function (item) {
          words += countWords(item);
        });
      }
    });
    return words;
  }

  function blogReadingTimeLabel(mins) {
    const n = Math.max(1, Math.round(Number(mins) || 0));
    return n + " min read";
  }

  function blogReadingTime(content) {
    const mins = Math.max(1, Math.round(blogWordCount(content) / 200));
    return blogReadingTimeLabel(mins);
  }

  function blogExcerpt(content, maxLen) {
    maxLen = maxLen || 160;
    const blocks = content || [];
    for (let i = 0; i < blocks.length; i += 1) {
      const block = blocks[i];
      if (block && block.type === "p" && block.text) {
        const text = String(block.text).trim();
        if (text.length <= maxLen) return text;
        return text.slice(0, maxLen).trim() + "...";
      }
    }
    return "";
  }

  function generateBlogSlug(title) {
    const slug = slugifyBlog(title);
    return slug || "post";
  }

  function setBlogBlocks(content) {
    if (!els.blogBlocks) return;
    els.blogBlocks.innerHTML = "";
    const blocks = Array.isArray(content) && content.length ? content : [{ type: "p", text: "" }];
    blocks.forEach(function (block) {
      if (block && (block.type === "list" || block.type === "ol")) {
        const items = Array.isArray(block.items) ? block.items : [block.text || ""];
        const blockEl = addBlogBlock(block.type, "");
        blockEl.__blogItems = items.length ? items.slice() : [""];
        renderListItems(blockEl);
      } else {
        addBlogBlock(block.type, block ? block.text : "");
      }
    });
  }

  let blogBlockSeq = 0;

  function blogBlockLabel(type) {
    if (type === "h2") return "Heading";
    if (type === "h3") return "Sub-heading";
    if (type === "list") return "Bullet list";
    if (type === "ol") return "Numbered list";
    return "Paragraph";
  }

  function addBlogBlock(type, text) {
    if (!els.blogBlocks) return null;
    const blockEl = document.createElement("div");
    blockEl.className = "admin-blog-block";
    blockEl.setAttribute("data-blog-block-type", type);

    const head = document.createElement("div");
    head.className = "admin-blog-block_head";
    const label = document.createElement("span");
    label.className = "admin-blog-block_type";
    label.textContent = blogBlockLabel(type);
    head.appendChild(label);

    const actions = document.createElement("div");
    actions.className = "admin-blog-block_actions";

    const btnUp = document.createElement("button");
    btnUp.type = "button";
    btnUp.className = "admin-blog-block-move";
    btnUp.setAttribute("aria-label", "Move block up");
    btnUp.textContent = "Up";

    const btnDown = document.createElement("button");
    btnDown.type = "button";
    btnDown.className = "admin-blog-block-move";
    btnDown.setAttribute("aria-label", "Move block down");
    btnDown.textContent = "Down";

    const btnRemove = document.createElement("button");
    btnRemove.type = "button";
    btnRemove.className = "admin-blog-block-remove";
    btnRemove.setAttribute("aria-label", "Remove block");
    btnRemove.textContent = "Remove";

    btnUp.addEventListener("click", function (e) { e.stopPropagation(); moveBlogBlock(blockEl, -1); });
    btnDown.addEventListener("click", function (e) { e.stopPropagation(); moveBlogBlock(blockEl, 1); });
    btnRemove.addEventListener("click", function (e) { e.stopPropagation(); removeBlogBlock(blockEl); });

    actions.appendChild(btnUp);
    actions.appendChild(btnDown);
    actions.appendChild(btnRemove);
    head.appendChild(actions);
    blockEl.appendChild(head);

    const isList = type === "list" || type === "ol";

    if (!isList) {
      const inputWrap = document.createElement("div");
      inputWrap.className = "admin-blog-block_input";
      const textarea = document.createElement("textarea");
      textarea.className = "admin-blog-block_text";
      textarea.rows = 3;
      textarea.value = text || "";
      textarea.addEventListener("input", function () { updateBlogMeta(); markDirty(); });
      inputWrap.appendChild(textarea);
      blockEl.appendChild(inputWrap);
    }

    const items = isList ? String(text || "").split(" ").filter(Boolean) : [];
    if (isList && !items.length) items.push("");
    blockEl.__blogItems = isList ? items : null;

    if (isList) {
      const itemsWrap = document.createElement("div");
      itemsWrap.className = "admin-blog-block_items";
      itemsWrap.setAttribute("data-blog-block-items", "1");
      itemsWrap.hidden = false;
      blockEl.appendChild(itemsWrap);
      renderListItems(blockEl);
    }

    els.blogBlocks.appendChild(blockEl);
    updateBlogMeta();
    return blockEl;
  }

  function renderListItems(blockEl) {
    const itemsWrap = blockEl.querySelector("[data-blog-block-items]");
    if (!itemsWrap) return;
    itemsWrap.innerHTML = "";
    const items = blockEl.__blogItems || [];
    items.forEach(function (itemText, itemIdx) {
      const itemRow = document.createElement("div");
      itemRow.className = "admin-blog-block_item";
      const itemInput = document.createElement("input");
      itemInput.type = "text";
      itemInput.className = "admin-blog-block_item_input";
      itemInput.value = itemText;
      itemInput.addEventListener("input", function () {
        items[itemIdx] = itemInput.value;
        updateBlogMeta();
        markDirty();
      });
      const itemRemove = document.createElement("button");
      itemRemove.type = "button";
      itemRemove.className = "admin-blog-block_item_remove";
      itemRemove.setAttribute("aria-label", "Remove list item");
      itemRemove.textContent = "Remove";
      itemRemove.addEventListener("click", function (e) { e.stopPropagation(); items.splice(itemIdx, 1); renderListItems(blockEl); });
      itemRow.appendChild(itemInput);
      itemRow.appendChild(itemRemove);
      itemsWrap.appendChild(itemRow);
    });
    const addItemBtn = document.createElement("button");
    addItemBtn.type = "button";
    addItemBtn.className = "btn btn--small";
    addItemBtn.textContent = "+ Add item";
    addItemBtn.addEventListener("click", function (e) { e.stopPropagation(); items.push(""); renderListItems(blockEl); });
    itemsWrap.appendChild(addItemBtn);
  }

  function moveBlogBlock(blockEl, dir) {
    const parent = blockEl.parentElement;
    if (!parent) return;
    const blocks = Array.from(parent.children);
    const idx = blocks.indexOf(blockEl);
    const swap = dir < 0 ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= blocks.length) return;
    parent.insertBefore(blockEl, dir < 0 ? blocks[swap] : blocks[swap + 1]);
  }

  function removeBlogBlock(blockEl) {
    blockEl.remove();
  }

  function readBlogBlocks() {
    const blocks = [];
    if (!els.blogBlocks) return blocks;
    Array.from(els.blogBlocks.children).forEach(function (blockEl) {
      const type = blockEl.getAttribute("data-blog-block-type") || "p";
      if (type === "list" || type === "ol") {
        const items = [];
        const itemsWrap = blockEl.querySelector("[data-blog-block-items]");
        if (itemsWrap) {
          Array.from(itemsWrap.children).forEach(function (row) {
            const input = row.querySelector("input");
            const value = input ? input.value.trim() : "";
            if (value) items.push(value);
          });
        }
        blocks.push({ type: type, items: items.length ? items : [""] });
      } else {
        const textarea = blockEl.querySelector(".admin-blog-block_text");
        blocks.push({ type: type, text: textarea ? textarea.value.trim() : "" });
      }
    });
    return blocks;
  }

  function updateBlogMeta() {
    if (els.blogReadtime) els.blogReadtime.textContent = blogReadingTime(readBlogBlocks());
  }

  function setBlogStatus(status) {
    state.blogStatus = status === "draft" ? "draft" : "published";
    const isDraft = state.blogStatus === "draft";
    if (els.blogEditorStatus) {
      els.blogEditorStatus.textContent = isDraft ? "Draft" : "Published";
      els.blogEditorStatus.className = "admin-blog-status admin-blog-status--" + state.blogStatus;
    }
    if (els.blogLiveNotice) els.blogLiveNotice.hidden = true;
    if (els.blogSaveBtn) {
      els.blogSaveBtn.hidden = !isDraft;
      els.blogSaveBtn.textContent = "Save changes";
    }
    if (els.blogSaveDraftBtn) {
      els.blogSaveDraftBtn.hidden = isDraft;
      els.blogSaveDraftBtn.textContent = "Save draft";
    }
  }

  function resetBlogEditor() {
    if (els.blogTitle) els.blogTitle.value = "";
    if (els.blogCategory) els.blogCategory.value = BLOG_CATEGORIES[0];
    if (els.blogAuthor) els.blogAuthor.value = BLOG_AUTHOR_DEFAULT;
    if (els.blogDate) els.blogDate.value = todayISO();
    if (els.blogExcerpt) els.blogExcerpt.value = "";
    if (els.blogImage) els.blogImage.value = "";
    if (els.blogImageAlt) els.blogImageAlt.value = "";
    if (els.blogSlug) els.blogSlug.value = "";
    if (els.blogReadingTimeInput) els.blogReadingTimeInput.value = "";
    state.blogSlugTouched = false;
    state.blogStatus = "draft";
    setBlogBlocks([{ type: "p", text: "" }]);
    setBlogStatus("draft");
    if (els.blogEditorTitle) els.blogEditorTitle.textContent = "New post";
    if (els.blogLiveNotice) els.blogLiveNotice.hidden = true;
  }

  function openBlogEditor(post, index) {
    // Reset dirty tracking for new editor session
    state.blogDirty = false;
    window.removeEventListener("beforeunload", beforeUnloadHandler);

    state.blogEditing = { index: index == null ? null : index, post: post || null };
    const existing = post || null;

    if (existing) {
      if (els.blogTitle) els.blogTitle.value = existing.title || "";
      if (els.blogCategory) els.blogCategory.value = existing.category || BLOG_CATEGORIES[0];
      if (els.blogAuthor) els.blogAuthor.value = existing.author || BLOG_AUTHOR_DEFAULT;
      if (els.blogDate) els.blogDate.value = existing.date || todayISO();
      if (els.blogExcerpt) els.blogExcerpt.value = existing.excerpt || "";
      if (els.blogImage) els.blogImage.value = existing.image || "";
      if (els.blogImageAlt) els.blogImageAlt.value = existing.imageAlt || "";
      if (els.blogReadingTimeInput) {
        var rt = existing.readingTime || "";
        if (typeof rt === "string") {
          var m = rt.match(/(\d+)/);
          els.blogReadingTimeInput.value = m ? m[1] : "";
        } else {
          els.blogReadingTimeInput.value = rt || "";
        }
      }
      if (els.blogSlug) {
        els.blogSlug.value = existing.slug || generateBlogSlug(existing.title);
        state.blogSlugTouched = true;
      }
      // Init cover preview
      if (els.blogCoverWrap && els.blogCoverImg && existing.image) {
        els.blogCoverImg.src = existing.image;
        els.blogCoverWrap.hidden = false;
      } else if (els.blogCoverWrap) {
        els.blogCoverWrap.hidden = true;
      }
      setBlogBlocks(Array.isArray(existing.content) ? existing.content : [{ type: "p", text: "" }]);
      state.blogStatus = existing.status === "draft" ? "draft" : "published";
      if (els.blogEditorTitle) els.blogEditorTitle.textContent = "Edit post";
    } else {
      resetBlogEditor();
      if (els.blogCoverWrap) els.blogCoverWrap.hidden = true;

      // Check for an autosaved draft to restore
      try {
        var saved = JSON.parse(localStorage.getItem("nilgiribytes_blog_autosave") || "null");
        if (saved && saved.index == null && saved.title) {
          if (confirm('You have an unsaved draft ("' + saved.title + '"). Restore it?')) {
            restoreBlogAutosave(saved);
          } else {
            localStorage.removeItem("nilgiribytes_blog_autosave");
          }
        }
      } catch (e) { /* ignore */ }
    }

    setBlogStatus(state.blogStatus);
    updateBlogMeta();
    updateBlogPreview();

    if (els.blogPreviewRoot) els.blogPreviewRoot.hidden = true;
    if (els.blogPreviewToggle) els.blogPreviewToggle.textContent = "Show preview";

    if (els.blogListPane) els.blogListPane.hidden = true;
    if (els.blogEditorPane) els.blogEditorPane.hidden = false;
    var blogActions = $("[data-admin-blog-actions]");
    if (blogActions) blogActions.hidden = true;

    if (els.blogTitle) els.blogTitle.focus();
  }

  function hideBlogEditor(skipGuard) {
    if (!skipGuard && state.blogDirty) {
      if (!confirm("You have unsaved changes. Leave without saving?")) return;
    }
    clearBlogAutosave();
    state.blogDirty = false;
    window.removeEventListener("beforeunload", beforeUnloadHandler);
    if (els.blogEditorPane) els.blogEditorPane.hidden = true;
    if (els.blogListPane) els.blogListPane.hidden = false;
    var blogActions = $("[data-admin-blog-actions]");
    if (blogActions) blogActions.hidden = false;
    state.blogEditing = null;
  }

  /* ---- Autosave ---- */

  var AUTOSAVE_KEY = "nilgiribytes_blog_autosave";
  var autosaveTimer = null;

  function blogAutosaveData() {
    return {
      index: state.blogEditing ? state.blogEditing.index : null,
      slug: els.blogSlug ? els.blogSlug.value : "",
      title: els.blogTitle ? els.blogTitle.value : "",
      category: els.blogCategory ? els.blogCategory.value : "",
      author: els.blogAuthor ? els.blogAuthor.value : "",
      date: els.blogDate ? els.blogDate.value : "",
      excerpt: els.blogExcerpt ? els.blogExcerpt.value : "",
      image: els.blogImage ? els.blogImage.value : "",
      imageAlt: els.blogImageAlt ? els.blogImageAlt.value : "",
      readingTime: els.blogReadingTimeInput ? els.blogReadingTimeInput.value : "",
      blocks: readBlogBlocks(),
      status: state.blogStatus,
      slugTouched: state.blogSlugTouched,
    };
  }

  function scheduleBlogAutosave() {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(function () {
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(blogAutosaveData()));
      } catch (e) { /* quota */ }
    }, 1500);
  }

  function clearBlogAutosave() {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    try { localStorage.removeItem(AUTOSAVE_KEY); } catch (e) { /* ignore */ }
  }

  function restoreBlogAutosave(saved) {
    if (els.blogTitle) els.blogTitle.value = saved.title || "";
    if (els.blogCategory) els.blogCategory.value = saved.category || BLOG_CATEGORIES[0];
    if (els.blogAuthor) els.blogAuthor.value = saved.author || BLOG_AUTHOR_DEFAULT;
    if (els.blogDate) els.blogDate.value = saved.date || todayISO();
    if (els.blogExcerpt) els.blogExcerpt.value = saved.excerpt || "";
    if (els.blogImage) els.blogImage.value = saved.image || "";
    if (els.blogImageAlt) els.blogImageAlt.value = saved.imageAlt || "";
    if (els.blogReadingTimeInput) els.blogReadingTimeInput.value = saved.readingTime || "";
    if (els.blogSlug) els.blogSlug.value = saved.slug || "";
    state.blogSlugTouched = !!saved.slugTouched;
    state.blogStatus = saved.status === "draft" ? "draft" : "published";
    setBlogBlocks(Array.isArray(saved.blocks) && saved.blocks.length ? saved.blocks : [{ type: "p", text: "" }]);
    setBlogStatus(state.blogStatus);
    if (els.blogCoverWrap && els.blogCoverImg && saved.image) {
      els.blogCoverImg.src = saved.image;
      els.blogCoverWrap.hidden = false;
    }
    updateBlogMeta();
    updateBlogPreview();
  }

  function beforeUnloadHandler(e) {
    if (state.blogDirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  }

  /* ---- Validation ---- */

  function validateBlogForm() {
    const title = els.blogTitle ? els.blogTitle.value.trim() : "";
    if (!title) {
      showBlogFormError("Please add a title.", els.blogTitle);
      return false;
    }
    const blocks = readBlogBlocks();
    const hasContent = blocks.some(function (b) {
      if (b.type === "list" || b.type === "ol") return (b.items || []).some(function (i) { return String(i).trim(); });
      return String(b.text || "").trim().length > 0;
    });
    if (!hasContent) {
      showBlogFormError("Please write at least one paragraph.", els.blogBlocks);
      return false;
    }
    return true;
  }

  function showBlogFormError(msg, focusEl) {
    setStatus(msg, "error");
    if (focusEl && typeof focusEl.focus === "function") focusEl.focus();
  }

  /* ---- Slug uniqueness ---- */

  function ensureUniqueBlogSlug(slug, editingIndex) {
    var base = slug || "post";
    var candidate = base;
    var n = 2;
    while (state.blogPosts.some(function (p, i) {
      return i !== editingIndex && p.slug === candidate;
    })) {
      candidate = base + "-" + n;
      n += 1;
    }
    return candidate;
  }

  /* ---- Live preview ---- */

  function updateBlogPreview() {
    if (!els.blogPreviewRoot) return;
    var title = els.blogTitle ? els.blogTitle.value.trim() : "";
    var excerpt = els.blogExcerpt ? els.blogExcerpt.value.trim() : "";
    var image = els.blogImage ? els.blogImage.value.trim() : "";
    var imageAlt = els.blogImageAlt ? els.blogImageAlt.value.trim() : "";
    var author = els.blogAuthor ? els.blogAuthor.value.trim() : "";
    var date = els.blogDate ? els.blogDate.value.trim() : "";
    var blocks = readBlogBlocks();

    var frag = document.createDocumentFragment();

    if (title) {
      var h1 = document.createElement("h1");
      h1.className = "admin-blog-preview_title";
      h1.textContent = title;
      frag.appendChild(h1);
    }

    if (author || date) {
      var meta = document.createElement("p");
      meta.className = "admin-blog-preview_meta";
      if (author) { var s = document.createElement("span"); s.textContent = "By " + author; meta.appendChild(s); }
      if (date) {
        var sd = document.createElement("span");
        sd.textContent = formatBlogDate(date);
        meta.appendChild(sd);
      }
      frag.appendChild(meta);
    }

    if (image) {
      var coverWrap = document.createElement("div");
      coverWrap.className = "admin-blog-preview_cover";
      var coverImg = document.createElement("img");
      coverImg.src = image;
      coverImg.alt = imageAlt || title;
      coverWrap.appendChild(coverImg);
      frag.appendChild(coverWrap);
    }

    if (excerpt) {
      var excerptEl = document.createElement("p");
      excerptEl.className = "admin-blog-preview_excerpt";
      excerptEl.textContent = excerpt;
      frag.appendChild(excerptEl);
    }

    var contentWrap = document.createElement("div");
    contentWrap.className = "article_content";
    var renderer = (window.Bakery && window.Bakery.renderBlocks) ? window.Bakery.renderBlocks : null;
    if (renderer) {
      contentWrap.appendChild(renderer(blocks));
    } else {
      blocks.forEach(function (b) {
        if (!b) return;
        if (b.type === "h2") { var h = document.createElement("h2"); h.textContent = b.text || ""; contentWrap.appendChild(h); }
        else if (b.type === "h3") { var h = document.createElement("h3"); h.textContent = b.text || ""; contentWrap.appendChild(h); }
        else if (b.type === "list") { var ul = document.createElement("ul"); (b.items||[]).forEach(function(i){ var li=document.createElement("li"); li.textContent=i; ul.appendChild(li); }); contentWrap.appendChild(ul); }
        else if (b.type === "ol") { var ol = document.createElement("ol"); (b.items||[]).forEach(function(i){ var li=document.createElement("li"); li.textContent=i; ol.appendChild(li); }); contentWrap.appendChild(ol); }
        else { var p = document.createElement("p"); p.textContent = b.text || ""; contentWrap.appendChild(p); }
      });
    }
    frag.appendChild(contentWrap);

    els.blogPreviewRoot.innerHTML = "";
    els.blogPreviewRoot.appendChild(frag);
  }

  /* ---- Image upload ---- */

  function compressBlogImage(file, callback) {
    var MAX_W = 1600;
    var QUALITY = 0.85;
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var w = img.width;
        var h = img.height;
        if (w > MAX_W) { h = Math.round(h * MAX_W / w); w = MAX_W; }
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        var mimeOut = file.type === "image/png" ? "image/png" : "image/jpeg";
        canvas.toBlob(function (blob) {
          if (!blob) { callback(null, null, null); return; }
          var blobReader = new FileReader();
          blobReader.onload = function (ev) {
            var dataUrl = ev.target.result;
            var base64 = dataUrl.split(",")[1];
            callback(base64, mimeOut, blob.size);
          };
          blobReader.readAsDataURL(blob);
        }, mimeOut, QUALITY);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function uploadBlogImage(file) {
    if (!file) return;
    var MAX_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      setStatus("This image is too large. Please choose a smaller photo.", "error");
      return;
    }
    setStatus("Uploading image...", "muted");

    // Show a local preview immediately while the upload runs
    var localUrl = URL.createObjectURL(file);
    if (els.blogCoverWrap && els.blogCoverImg) {
      els.blogCoverImg.src = localUrl;
      els.blogCoverWrap.hidden = false;
    }

    compressBlogImage(file, function (base64, mimeOut, size) {
      if (!base64) {
        setStatus("Could not process the image. Please try another.", "error");
        return;
      }
      var ext = mimeOut === "image/png" ? "png" : "jpg";
      var safeName = slugifyBlog(file.name.replace(/\.[^.]+$/, "") || "image") + "." + ext;

      api("api/blog-image", {
        method: "POST",
        body: JSON.stringify({ filename: safeName, contentType: mimeOut, data: base64 }),
      })
        .then(function (result) {
          var path = result.path || "";
          if (!path) throw new Error("No path returned from image upload.");
          if (els.blogImage) els.blogImage.value = path;
          if (els.blogCoverWrap && els.blogCoverImg) {
            els.blogCoverImg.src = path;
            els.blogCoverWrap.hidden = false;
          }
          setStatus("Image uploaded.", "success");
          updateBlogPreview();
          scheduleBlogAutosave();
        })
        .catch(function (err) {
          // Keep local preview, clear path
          if (els.blogImage) els.blogImage.value = "";
          setStatus(err.message || "Image upload failed.", "error");
        })
        .finally(function () {
          URL.revokeObjectURL(localUrl);
        });
    });
  }

  /* ---- Save / Publish ---- */

  function saveBlogPost(isDraft) {
    if (state.blogSaving) return;
    if (!validateBlogForm()) return;

    var editingIndex = state.blogEditing ? state.blogEditing.index : null;
    var existingPost = state.blogEditing ? state.blogEditing.post : null;
    var originalSlug = existingPost ? existingPost.slug : null;

    var title = els.blogTitle.value.trim();
    var category = els.blogCategory ? els.blogCategory.value : BLOG_CATEGORIES[0];
    var author = (els.blogAuthor && els.blogAuthor.value.trim()) || BLOG_AUTHOR_DEFAULT;
    var date = (els.blogDate && els.blogDate.value) || todayISO();
    var excerpt = els.blogExcerpt ? els.blogExcerpt.value.trim() : "";
    var image = els.blogImage ? els.blogImage.value.trim() : "";
    var imageAlt = els.blogImageAlt ? els.blogImageAlt.value.trim() : "";
    var blocks = readBlogBlocks();

    if (!excerpt) excerpt = blogExcerpt(blocks);

    var rawSlug = els.blogSlug ? els.blogSlug.value.trim() : "";
    if (!rawSlug) rawSlug = slugifyBlog(title);
    var slug = ensureUniqueBlogSlug(rawSlug, editingIndex);
    if (els.blogSlug) els.blogSlug.value = slug;

    var targetStatus = isDraft ? "draft" : (existingPost ? existingPost.status : "draft");
    if (targetStatus !== "draft") targetStatus = "published";

    var readingTime = (els.blogReadingTimeInput && els.blogReadingTimeInput.value.trim())
      ? els.blogReadingTimeInput.value.trim()
      : blogReadingTime(blocks);

    var post = {
      slug: slug,
      status: targetStatus,
      title: title,
      category: category,
      author: author,
      date: date,
      readingTime: readingTime,
      image: image,
      imageAlt: imageAlt || title,
      excerpt: excerpt,
      content: blocks,
    };

    state.blogSaving = true;
    setBlogSavingUI(true);
    setStatus("Saving...", "muted");

    api(BLOG_URL, {
      method: "PUT",
      body: JSON.stringify({ post: post, originalSlug: originalSlug || slug, version: state.blogVersion }),
    })
      .then(function (result) {
        state.blogVersion = result.version || state.blogVersion;
        if (Array.isArray(result.posts)) {
          state.blogPosts = result.posts;
          state.blogLoaded = true;
        } else {
          state.blogLoaded = false;
        }
        clearBlogAutosave();
        state.blogDirty = false;
        window.removeEventListener("beforeunload", beforeUnloadHandler);

        var msg = isDraft
          ? "Draft saved. Publish it when you are ready."
          : "Changes saved.";
        setStatus(msg, "success");
        hideBlogEditor(true);
      })
      .catch(function (err) {
        if (err.code === "CONFLICT") {
          setStatus("The blog was updated somewhere else. Please try again.", "error");
        } else {
          setStatus((err.message || "Could not save. Your text is safe — please try again."), "error");
        }
      })
      .finally(function () {
        state.blogSaving = false;
        setBlogSavingUI(false);
      });
  }

  function setBlogSavingUI(saving) {
    if (els.blogSaveBtn) {
      els.blogSaveBtn.disabled = saving;
      els.blogSaveBtn.textContent = saving ? "Saving..." : "Save changes";
    }
    if (els.blogSaveDraftBtn) {
      els.blogSaveDraftBtn.disabled = saving;
      els.blogSaveDraftBtn.textContent = saving ? "Saving..." : "Save draft";
    }
    if (els.blogCancelBtn) els.blogCancelBtn.disabled = saving;
  }

  function publishBlogPost(index) {
    if (state.blogSaving) return;
    var post = state.blogPosts[index];
    if (!post) return;
    if (post.status === "published") return;

    state.blogSaving = true;
    renderBlogList();
    setStatus('Publishing "' + (post.title || "post") + '"...', "muted");

    api(BLOG_URL, {
      method: "POST",
      body: JSON.stringify({ action: "publish", slug: post.slug, version: state.blogVersion }),
    })
      .then(function (result) {
        state.blogVersion = result.version || state.blogVersion;
        state.blogLoaded = false;
        loadBlog(true);
        setStatus(
          '"' + (post.title || "Post") + '" published. It may take a minute to appear on the live site.',
          "success"
        );
      })
      .catch(function (err) {
        renderBlogList();
        if (err.code === "CONFLICT") {
          setStatus("The blog was updated somewhere else. Please try again.", "error");
        } else {
          setStatus(err.message || "Could not publish. Please try again.", "error");
        }
      })
      .finally(function () {
        state.blogSaving = false;
      });
  }

  /* ---------- Dirty tracking helpers ---------- */

  function markBlogDirty() {
    state.blogDirty = true;
    window.addEventListener("beforeunload", beforeUnloadHandler);
    scheduleBlogAutosave();
    updateBlogPreview();
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
    const blogActions = $("[data-admin-blog-actions]");
    if (title) title.textContent = view === "blog" ? "Blog" : "Catalog";
    if (actions) actions.hidden = view === "blog";
    if (blogActions) blogActions.hidden = view !== "blog";
    if (view === "blog") loadBlog();
  }

  document.addEventListener("DOMContentLoaded", function () {
    // Strip any credentials that leaked into the URL (e.g. from a native GET submit).
    try {
      var url = new URL(window.location.href);
      if (url.searchParams.has("username") || url.searchParams.has("password")) {
        url.searchParams.delete("username");
        url.searchParams.delete("password");
        window.history.replaceState({}, "", url.pathname + url.search + url.hash);
      }
    } catch (e) { /* ignore */ }

    if (els.form) els.form.addEventListener("submit", submitEditor);
    var closeBtn = $("[data-admin-close]");
    if (closeBtn) closeBtn.addEventListener("click", closeEditor);
    if (els.overlay) els.overlay.addEventListener("click", closeEditor);

    $$("[data-admin-view]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        switchView(btn.getAttribute("data-admin-view"));
      });
    });

    var addBtn = $("[data-admin-add]");
    if (addBtn) addBtn.addEventListener("click", function () {
      openEditor("product", null);
    });
    var addComboBtn = $("[data-admin-add-combo]");
    if (addComboBtn) addComboBtn.addEventListener("click", function () {
      openEditor("combo", null);
    });
    var addSizeBtn = $("[data-admin-add-size]");
    if (addSizeBtn) addSizeBtn.addEventListener("click", function () {
      addSizeRow();
    });
    if (els.publishBtn) els.publishBtn.addEventListener("click", publishCatalog);

    if (els.loginForm) els.loginForm.addEventListener("submit", handleLogin);
    if (els.logoutBtn) els.logoutBtn.addEventListener("click", logout);

    /* ---- Blog list actions ---- */
    if (els.blogAddBtn) {
      els.blogAddBtn.addEventListener("click", function () {
        openBlogEditor(null, null);
      });
    }
    if (els.blogBackBtn) els.blogBackBtn.addEventListener("click", function () { hideBlogEditor(false); });
    if (els.blogCancelBtn) els.blogCancelBtn.addEventListener("click", function () { hideBlogEditor(false); });
    if (els.blogSaveBtn) els.blogSaveBtn.addEventListener("click", function () { saveBlogPost(false); });
    if (els.blogSaveDraftBtn) els.blogSaveDraftBtn.addEventListener("click", function () { saveBlogPost(true); });

    /* ---- Block editor buttons ---- */
    $$("[data-blog-add-block]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        addBlogBlock(btn.getAttribute("data-blog-add-block"));
        markBlogDirty();
      });
    });

    /* ---- Image upload ---- */
    if (els.blogUploadBtn && els.blogFile) {
      els.blogUploadBtn.addEventListener("click", function () { els.blogFile.click(); });
    }
    if (els.blogFile) {
      els.blogFile.addEventListener("change", function () {
        uploadBlogImage(els.blogFile.files && els.blogFile.files[0]);
        els.blogFile.value = "";
      });
    }
    if (els.blogCoverReplace && els.blogFile) {
      els.blogCoverReplace.addEventListener("click", function () { els.blogFile.click(); });
    }
    if (els.blogCoverRemove) {
      els.blogCoverRemove.addEventListener("click", function () {
        if (els.blogImage) els.blogImage.value = "";
        if (els.blogCoverWrap) els.blogCoverWrap.hidden = true;
        markBlogDirty();
      });
    }
    if (els.blogImage) {
      els.blogImage.addEventListener("input", function () {
        if (els.blogCoverWrap && els.blogCoverImg) {
          if (els.blogImage.value.trim()) {
            els.blogCoverImg.src = els.blogImage.value.trim();
            els.blogCoverWrap.hidden = false;
          } else {
            els.blogCoverWrap.hidden = true;
          }
        }
        markBlogDirty();
      });
    }

    /* ---- Preview toggle ---- */
    if (els.blogPreviewToggle) {
      els.blogPreviewToggle.addEventListener("click", function () {
        var target = els.blogPreviewRoot;
        if (!target) return;
        var isHidden = target.hasAttribute("hidden") || target.style.display === "none";
        if (isHidden) {
          target.hidden = false;
          target.style.display = "";
          els.blogPreviewToggle.textContent = "Hide preview";
        } else {
          target.hidden = true;
          els.blogPreviewToggle.textContent = "Show preview";
        }
      });
    }

    /* ---- Title / slug / meta live wiring ---- */
    if (els.blogTitle) {
      els.blogTitle.addEventListener("input", function () {
        if (els.blogSlug && !state.blogSlugTouched) {
          els.blogSlug.value = generateBlogSlug(els.blogTitle.value);
        }
        updateBlogMeta();
        markBlogDirty();
      });
    }
    if (els.blogSlug) {
      els.blogSlug.addEventListener("input", function () {
        state.blogSlugTouched = true;
        markBlogDirty();
      });
    }
    if (els.blogBlocks) {
      els.blogBlocks.addEventListener("input", function () {
        updateBlogMeta();
        markBlogDirty();
      });
    }
    [
      els.blogCategory, els.blogAuthor, els.blogDate,
      els.blogExcerpt, els.blogImageAlt, els.blogReadingTimeInput,
    ].forEach(function (el) {
      if (el) el.addEventListener("input", function () { markBlogDirty(); });
    });

    /* ---- Password toggle ---- */
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
