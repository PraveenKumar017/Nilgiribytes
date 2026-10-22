/* ==========================================================================
   main.js — shared behaviour for every page
   - Loads header.html / footer.html partials via fetch()
   - Accessible mobile navigation (aria-expanded, Esc, focus trap)
   - Header search, active nav link, scroll reveal, cart badge sync
   ========================================================================== */

(function () {
  "use strict";

  /* ---------- Shared helpers (also used by other scripts) ---------- */
  window.Bakery = window.Bakery || {};

  /* ---------- Site configuration (single source of truth) ---------- */
  window.Bakery.config = {
    /** WhatsApp number — country code + digits only (no "+" or spaces). */
    whatsappNumber: "919344921647",
    /** Site root — TODO: replace with the bakery's real domain. */
    siteUrl: "https://www.niligibytes.com/",
  };

  /** Build a wa.me link with an optional prefilled message. */
  window.Bakery.whatsappLink = function (message) {
    const number = window.Bakery.config.whatsappNumber;
    const base = "https://wa.me/" + number;
    return message
      ? base + "?text=" + encodeURIComponent(message)
      : base;
  };

  window.Bakery.storage = {
    get: function (key, fallback) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (err) {
        return fallback;
      }
    },
    set: function (key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (err) {
        /* storage unavailable (private mode) — fail silently */
      }
    },
  };

  /** Format an amount as Indian rupees. */
  window.Bakery.formatPrice = function (amount) {
    return "₹" + amount;
  };

  /** Escape untrusted text before inserting via innerHTML. */
  window.Bakery.escapeHTML = function (value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[ch];
    });
  };

  /** Replace an image with a graceful fallback block if it fails to load. */
  window.Bakery.handleImageError = function (img, message) {
    const fallback = document.createElement("div");
    fallback.className = "image-fallback";
    fallback.textContent = message || "Image coming soon";
    if (img && img.parentNode) {
      img.replaceWith(fallback);
    }
  };

  /** Build the logo-outline loading indicator. */
  window.Bakery.logoLoader = function (label) {
    const loader = document.createElement("span");
    loader.className = "logo-loader";
    loader.setAttribute("role", "status");
    const mark = document.createElement("span");
    mark.className = "logo-loader_mark";
    mark.setAttribute("aria-hidden", "true");
    loader.appendChild(mark);
    const text = document.createElement("span");
    text.className = "sr-only";
    text.textContent = label || "Loading";
    loader.appendChild(text);
    return loader;
  };

  /** Cover an image container with the logo loader until the image loads. */
  window.Bakery.attachImageLoader = function (container, img, label) {
    const MIN_VISIBLE_MS = 400;
    const overlay = document.createElement("div");
    overlay.className = "image-loader is-ready";
    overlay.appendChild(window.Bakery.logoLoader(label));
    container.appendChild(overlay);

    let currentSrc = "";
    let shownAt = 0;
    let hideTimer = 0;

    function now() {
      return window.performance && window.performance.now
        ? window.performance.now()
        : Date.now();
    }

    function show() {
      if (hideTimer) {
        window.clearTimeout(hideTimer);
        hideTimer = 0;
      }
      if (!overlay.classList.contains("is-ready")) return;
      shownAt = now();
      overlay.classList.remove("is-ready");
    }

    function hide() {
      if (overlay.classList.contains("is-ready")) return;
      const remaining = MIN_VISIBLE_MS - (now() - shownAt);
      if (remaining > 0) {
        if (hideTimer) window.clearTimeout(hideTimer);
        hideTimer = window.setTimeout(function () {
          hideTimer = 0;
          overlay.classList.add("is-ready");
        }, remaining);
      } else {
        overlay.classList.add("is-ready");
      }
    }

    function setSrc(src) {
      currentSrc = src;
      if (img.getAttribute("src") === src) {
        if (!img.complete) show();
        return;
      }
      show();
      img.src = src;
      if (img.complete && img.naturalWidth > 0) hide();
    }

    img.addEventListener("load", function () {
      if (img.getAttribute("src") === currentSrc) hide();
    });
    img.addEventListener("error", function () {
      if (img.getAttribute("src") === currentSrc) hide();
    });

    return { setSrc: setSrc, show: show, hide: hide };
  };

  const FILE_PROTOCOL_HINT =
    "This page was opened via file://, so shared partials cannot be loaded. " +
    "Please run a local static server (for example the VS Code extension " +
    "'Live Server') and open the page through http://localhost.";

  /* ---------- Load shared partials ---------- */
  function loadPartials() {
    const placeholders = document.querySelectorAll("[data-include]");
    if (!placeholders.length) return Promise.resolve();

    const tasks = Array.from(placeholders).map(function (el) {
      const name = el.getAttribute("data-include"); // "header" | "footer"
      return fetch(name + ".html")
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.text();
        })
        .then(function (html) {
          el.innerHTML = html;
        })
        .catch(function () {
          el.innerHTML =
            '<p class="load-fallback" role="note">' +
            window.Bakery.escapeHTML(FILE_PROTOCOL_HINT) +
            "</p>";
        });
    });

    return Promise.all(tasks);
  }

  /* ---------- After partials are in the DOM ---------- */
  function initHeader() {
    const header = document.querySelector(".site-header");
    if (!header) return;

    const progressBar = document.querySelector("[data-scroll-progress]");
    if (progressBar) {
      function updateScrollProgress() {
        const doc = document.documentElement;
        const scrollTop = doc.scrollTop || document.body.scrollTop;
        const scrollHeight = doc.scrollHeight - doc.clientHeight;
        const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
        progressBar.style.width = progress.toFixed(2) + "%";
      }

      updateScrollProgress();
      window.addEventListener("scroll", updateScrollProgress, { passive: true });
      window.addEventListener("resize", updateScrollProgress);
    }

    // Logo fallback if logo.png is missing
    const logoImg = header.querySelector("[data-logo-img]");
    if (logoImg) {
      logoImg.addEventListener("error", function () {
        const logo = header.querySelector(".site-logo");
        if (logo) logo.classList.add("is-fallback");
      });
      // handle already-failed image (cached 404)
      if (logoImg.complete && logoImg.naturalWidth === 0) {
        const logo = header.querySelector(".site-logo");
        if (logo) logo.classList.add("is-fallback");
      }
    }

    // Mark active nav link
    const page =
      (window.location.pathname.split("/").pop() || "index.html").replace(
        ".html",
        ""
      ) || "index";
    document.querySelectorAll("[data-nav-link]").forEach(function (link) {
      if (link.getAttribute("data-nav-link") === page) {
        link.setAttribute("aria-current", "page");
      }
    });

    // Current year in footer
    document.querySelectorAll("[data-current-year]").forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });
  }

  /* ---------- Mobile navigation ---------- */
  function initNav() {
    const nav = document.getElementById("site-nav");
    const openBtn = document.querySelector("[data-nav-toggle]");
    const closeBtn = document.querySelector("[data-nav-close]");
    const overlay = document.querySelector("[data-overlay]");
    if (!nav || !openBtn) return;

    let lastFocused = null;

    function focusables() {
      return Array.from(
        nav.querySelectorAll('a[href], button:not([disabled])')
      ).filter(function (el) {
        return el.offsetParent !== null;
      });
    }

    function openNav() {
      lastFocused = document.activeElement;
      nav.classList.add("is-open");
      openBtn.setAttribute("aria-expanded", "true");
      /* Lift the header stacking context above the overlay (z-index 900).
         The nav is position:fixed with z-index 1100, but it is trapped
         inside .site-header (sticky, z-index 500) — without this, the
         overlay's blur paints over the open nav and blocks all clicks. */
      document.body.classList.add("nav-is-open");
      if (overlay) overlay.hidden = false;
      requestAnimationFrame(function () {
        if (overlay) overlay.classList.add("is-open");
      });
      document.body.classList.add("is-locked");
      const first = focusables()[0];
      if (first) first.focus();
      document.addEventListener("keydown", onKeydown);
    }

    function closeNav() {
      nav.classList.remove("is-open");
      openBtn.setAttribute("aria-expanded", "false");
      document.body.classList.remove("nav-is-open");
      if (overlay) overlay.classList.remove("is-open");
      document.body.classList.remove("is-locked");
      document.removeEventListener("keydown", onKeydown);
      if (lastFocused) lastFocused.focus();
    }

    function onKeydown(e) {
      if (e.key === "Escape") {
        closeNav();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
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

    openBtn.addEventListener("click", openNav);
    if (closeBtn) closeBtn.addEventListener("click", closeNav);
    if (overlay) {
      overlay.addEventListener("click", function () {
        if (nav.classList.contains("is-open")) closeNav();
      });
    }
    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        if (nav.classList.contains("is-open")) closeNav();
      });
    });
  }

  /* ---------- Header search ---------- */
  function initSearch() {
    const form = document.querySelector("[data-header-search]");
    const toggle = document.querySelector("[data-search-toggle]");
    const wrap = document.getElementById("header-search");
    if (!form || !toggle || !wrap) return;

    toggle.addEventListener("click", function () {
      const open = wrap.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      if (open) {
        const input = form.querySelector("input");
        if (input) input.focus();
      }
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const q = form.querySelector("input").value.trim();
      window.location.href = "shop.html" + (q ? "?q=" + encodeURIComponent(q) : "");
    });
  }

  /* ---------- Cart badge (works on every page) ---------- */
  function syncCartBadge() {
    const count = window.Bakery.storage.get("veb_cart", []).reduce(
      function (sum, line) {
        return sum + (line.qty || 0);
      },
      0
    );
    document.querySelectorAll("[data-cart-count]").forEach(function (el) {
      el.textContent = String(count);
      el.hidden = count === 0;
    });
  }

  window.Bakery.refreshCartBadge = syncCartBadge;
  window.addEventListener("storage", syncCartBadge);

  /* ---------- Scroll reveal ----------
     js/animations.js owns the reveal engine when it is available (single
     shared IntersectionObserver + window.refreshReveals). The code below is
     the fallback for when the motion layer is not loaded. */
  let revealObserver = null;

  function initReveal() {
    /* Prefer the shared engine from js/animations.js. */
    if (typeof window.refreshReveals === "function") {
      window.refreshReveals();
      return;
    }

    const reduce =
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      document.querySelectorAll(".reveal").forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }

    revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    document.querySelectorAll(".reveal").forEach(function (el) {
      revealObserver.observe(el);
    });
  }

  /** Observe .reveal elements injected after boot (product/post cards). */
  window.Bakery.observeReveals = function (root) {
    if (typeof window.refreshReveals === "function") {
      window.refreshReveals(root);
      return;
    }

    const scope = root || document;
    scope.querySelectorAll(".reveal").forEach(function (el) {
      if (revealObserver) {
        revealObserver.observe(el);
      } else {
        el.classList.add("is-visible");
      }
    });
  };

  /* ---------- Decorative image fallbacks ---------- */
  function initImageFallbacks() {
    document.querySelectorAll("img[data-remove-on-error]").forEach(function (img) {
      function handle() {
        const hero = img.closest(".hero");
        if (hero) hero.classList.add("hero--fallback");
        img.remove();
      }
      img.addEventListener("error", handle);
      if (img.complete && img.naturalWidth === 0) handle();
    });

    document.querySelectorAll("img[data-fallback]").forEach(function (img) {
      function handle() {
        window.Bakery.handleImageError(img, img.getAttribute("data-fallback"));
      }
      img.addEventListener("error", handle);
      if (img.complete && img.naturalWidth === 0) handle();
    });
  }

  /* ---------- Newsletter (front-end validation only) ---------- */
  function initNewsletter() {
    const form = document.getElementById("newsletter-form");
    if (!form) return;
    const input = document.getElementById("newsletter-email");
    const msg = document.getElementById("newsletter-msg");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const value = (input.value || "").trim();
      const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

      msg.classList.remove("is-error", "is-success");

      if (!valid) {
        msg.textContent = "Please enter a valid email address.";
        msg.classList.add("is-error");
        input.focus();
        return;
      }

      // TODO: connect a real email service (Mailchimp, Brevo, etc.).
      // No data is sent anywhere yet — validation is front-end only.
      msg.textContent = "Thank you! You're on the list.";
      msg.classList.add("is-success");
      form.reset();
    });
  }

  /* ---------- Boot ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    initImageFallbacks();
    initNewsletter();
    loadPartials().then(function () {
      initHeader();
      initNav();
      initSearch();
      syncCartBadge();
      document.dispatchEvent(new CustomEvent("partials:ready"));
    });
    initReveal();
  });
})();
