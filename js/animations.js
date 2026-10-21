/* ==========================================================================
   animations.js — motion layer for Nilgiribytes
   Loaded with `defer` after js/main.js on every page.

   Features
     01  Cinematic hero reveal ................ golden reveal +
     02  Product card hover ................... all packages (CSS only)
     03  Scroll-triggered storytelling ........ golden reveal +
     04  Signature intro ...................... signature experience only
     +    Refined page transitions ............ signature experience only
     +    Selected parallax .................... signature experience only
     +    Silk motion basics ................... all packages (CSS only)

   Every lower tier is a strict subset of the tier above it, so switching
   MOTION_PACKAGE changes the behaviour without touching any other file.

   Requires: js/main.js (for window.Bakery.config / window.Bakery helpers).
   ========================================================================== */

(function () {
  "use strict";

  /* --------------------------------------------------------------------------
     CONFIG
     -------------------------------------------------------------------------- */

  /** Active motion package. Change this single value to switch tiers.
   *  "silk-motion"           → hovers + gentle fades only
   *  "golden-reveal"         → + hero sequence, scroll reveals, stagger
   *  "signature-experience"  → + intro, page transitions, parallax
   */
  const MOTION_PACKAGE = "golden-reveal";

  const CONFIG = {
    reveal: {
      threshold: 0.15,
      rootMargin: "0px 0px -8% 0px",
      staggerCap: 6, /* max number of --i steps in a stagger group */
    },
    hero: {
      delay: 120, /* ms between page ready and the start of the hero sequence */
    },
    intro: {
      duration: 2200, /* hard ceiling for the intro, in ms */
    },
    transition: {
      duration: 260, /* ms fade-out before the browser navigates */
    },
    parallax: {
      max: 40, /* px of vertical travel */
      minWidth: 768, /* disabled below this viewport width */
    },
  };

  const PACKAGES = {
    "silk-motion": 1,
    "golden-reveal": 2,
    "signature-experience": 3,
  };

  const root = document.documentElement;
  const tier = PACKAGES[MOTION_PACKAGE] || 1;
  const isGolden = tier >= 2;
  const isSignature = tier >= 3;

  const motionQuery =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
  const reduceMotion = Boolean(motionQuery && motionQuery.matches);

  /* Publish the active package so CSS can gate features with
     [data-motion~="golden-reveal"] and friends. */
  root.dataset.motion = MOTION_PACKAGE;
  root.classList.add("js");
  window.NILGIRI_MOTION_READY = true;

  /* --------------------------------------------------------------------------
     03 — Scroll reveals
     -------------------------------------------------------------------------- */

  let revealObserver = null;

  function isRevealEl(el) {
    return (
      el.hasAttribute("data-reveal") || el.classList.contains("reveal")
    );
  }

  /** Set --i (stagger index) for the element inside its own group. */
  function assignStagger(el) {
    const parent = el.parentElement;
    if (parent) {
      const siblings = Array.prototype.filter.call(parent.children, isRevealEl);
      const index = siblings.indexOf(el);
      const capped = Math.min(
        Math.max(index, 0),
        CONFIG.reveal.staggerCap
      );
      el.style.setProperty("--i", String(capped));
    }

    /* Optional manual offset: data-reveal-delay="120ms" */
    const delay = el.getAttribute("data-reveal-delay");
    if (delay) {
      el.style.transitionDelay = /ms$/.test(delay) ? delay : delay + "ms";
    }
  }

  /**
   * Observe every reveal element inside `scope` (defaults to the document).
   * Call this after any dynamic render (product grid, blog grid, …).
   */
  function refreshReveals(scope) {
    const container = scope || document;
    const nodes = container.querySelectorAll("[data-reveal], .reveal");
    if (!nodes.length) return;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(nodes, function (el) {
        el.classList.add("is-visible");
      });
      return;
    }

    if (!revealObserver) {
      revealObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            if (entry.target.id === "varkey-target-card" && !entry.target.classList.contains("is-landed")) {
              entry.target.classList.add("is-landed");
            }
            revealObserver.unobserve(entry.target);
          });
        },
        {
          threshold: CONFIG.reveal.threshold,
          rootMargin: CONFIG.reveal.rootMargin,
        }
      );
    }

    Array.prototype.forEach.call(nodes, function (el) {
      if (el.classList.contains("is-visible")) return;
      assignStagger(el);
      revealObserver.observe(el);
    });
  }

  /* Public API — js/products.js and js/blog.js call this after every render. */
  window.refreshReveals = refreshReveals;

  /* --------------------------------------------------------------------------
     01 — Cinematic hero reveal
     -------------------------------------------------------------------------- */

  function startHero() {
    const hero = document.querySelector(".hero");
    if (!hero) return;

    hero.classList.add("is-loaded");

    /* will-change is only useful during the animation. */
    const media = hero.querySelector(".hero_media");
    if (media && !reduceMotion) {
      media.addEventListener(
        "animationend",
        function () {
          media.style.willChange = "auto";
        },
        { once: true }
      );
    }
  }

  /* --------------------------------------------------------------------------
     04 — Signature intro (signature experience only)
     -------------------------------------------------------------------------- */

  function initIntro(onDone) {
    const intro = document.getElementById("intro");

    /* Home page only, once per session, never when motion is reduced. */
    if (
      !intro ||
      !isSignature ||
      reduceMotion ||
      document.body.getAttribute("data-page") !== "home"
    ) {
      onDone();
      return;
    }

    let seen = false;
    try {
      seen = window.sessionStorage.getItem("veb_intro_seen") === "1";
    } catch (err) {
      seen = false;
    }
    if (seen) {
      onDone();
      return;
    }

    const skipBtn = intro.querySelector("[data-intro-skip]");
    let done = false;
    let timer = null;

    function finish() {
      if (done) return;
      done = true;

      if (timer) window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown, true);
      intro.classList.remove("is-active");
      document.body.classList.remove("is-locked");

      try {
        window.sessionStorage.setItem("veb_intro_seen", "1");
      } catch (err) {
        /* storage unavailable — the intro simply plays again next time */
      }

      window.setTimeout(function () {
        intro.hidden = true;
      }, 420);

      /* Return focus to the page. */
      const main = document.getElementById("main-content");
      if (main) {
        main.setAttribute("tabindex", "-1");
        try {
          main.focus({ preventScroll: true });
        } catch (err) {
          main.focus();
        }
      }

      onDone();
    }

    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        finish();
      }
    }

    intro.hidden = false;
    document.body.classList.add("is-locked");
    document.addEventListener("keydown", onKeyDown, true);

    intro.addEventListener("click", function (e) {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;
      if (target === intro || target.closest("[data-intro-skip]")) finish();
    });

    if (skipBtn) skipBtn.focus();

    /* Two frames so the browser paints the hidden state before fading in. */
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        intro.classList.add("is-active");
      });
    });

    timer = window.setTimeout(finish, CONFIG.intro.duration);
  }

  /* --------------------------------------------------------------------------
     Page transitions (signature experience only)
     -------------------------------------------------------------------------- */

  function initPageTransitions() {
    if (!isSignature || reduceMotion) return;

    document.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const link = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!link) return;
      if (link.target && link.target !== "_self") return;
      if (link.hasAttribute("download")) return;

      const href = link.getAttribute("href");
      if (!href || href.charAt(0) === "#") return;

      let url;
      try {
        url = new URL(link.href, window.location.href);
      } catch (err) {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.href === window.location.href) return;

      e.preventDefault();
      root.classList.add("is-leaving");
      window.setTimeout(function () {
        window.location.href = url.href;
      }, CONFIG.transition.duration);
    });

    /* bfcache-safe: Back must never leave a blank page. */
    window.addEventListener("pageshow", function (e) {
      root.classList.remove("is-leaving");
      document.body.classList.add("is-ready");
      if (e.persisted) refreshReveals();
    });
  }

  /* --------------------------------------------------------------------------
     Parallax (signature experience only) — transform only, ±40px
     -------------------------------------------------------------------------- */

  function initParallax() {
    if (!isSignature || reduceMotion) return;
    if (window.innerWidth < CONFIG.parallax.minWidth) return;

    const items = Array.prototype.map.call(
      document.querySelectorAll("[data-parallax]"),
      function (el) {
        return {
          el: el,
          target: el.querySelector("img") || el,
          speed: parseFloat(el.getAttribute("data-parallax")) || 0.4,
        };
      }
    );
    if (!items.length) return;

    let ticking = false;

    function update() {
      ticking = false;
      const vh = window.innerHeight || 1;

      items.forEach(function (item) {
        const rect = item.el.getBoundingClientRect();
        if (rect.bottom < -100 || rect.top > vh + 100) return;

        /* -1 (below the fold) … 1 (above the fold) */
        const progress = (rect.top + rect.height / 2 - vh / 2) / vh;
        const clamped = Math.max(-1, Math.min(1, progress));
        const shift = clamped * CONFIG.parallax.max * item.speed;
        item.target.style.transform =
          "translate3d(0," + shift.toFixed(2) + "px,0)";
      });
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
  }

  /* --------------------------------------------------------------------------
     Silk motion accents
     -------------------------------------------------------------------------- */

  /** Small "pop" on the cart badge whenever the count changes. */
  function initCartBadge() {
    const badges = document.querySelectorAll("[data-cart-count]");
    if (!badges.length || !("MutationObserver" in window)) return;

    const observer = new MutationObserver(function () {
      Array.prototype.forEach.call(badges, function (badge) {
        badge.classList.remove("is-pop");
        void badge.offsetWidth; /* restart the animation */
        badge.classList.add("is-pop");
      });
    });

    Array.prototype.forEach.call(badges, function (badge) {
      observer.observe(badge, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    });
  }

  /** Floating WhatsApp button — always visible, pulse ring repeats. */
  function initFloatingWhatsApp() {
    const btn = document.querySelector("[data-float-wa]");
    if (!btn || btn.dataset.waReady === "1") return;
    btn.dataset.waReady = "1";

    const config = (window.Bakery && window.Bakery.config) || {};
    if (config.whatsappNumber) {
      btn.setAttribute(
        "href",
        "https://wa.me/" + config.whatsappNumber
      );
    }

    btn.classList.add("is-visible");

    if (reduceMotion) return;

    const PULSE_MS = 1600;
    const REPEAT_MS = 7000;

    let pulsing = false;
    let lastPulse = 0;

    /** Restart the ring animation from scratch. */
    function pulse() {
      if (pulsing) return;
      pulsing = true;
      lastPulse = Date.now();

      btn.classList.remove("is-pulse");
      void btn.offsetWidth; /* force reflow so the animation replays */
      btn.classList.add("is-pulse");

      window.setTimeout(function () {
        btn.classList.remove("is-pulse");
        pulsing = false;
      }, PULSE_MS + 100);
    }

    /* First pulse straight away, then keep repeating while the page is open. */
    window.setTimeout(pulse, 400);
    window.setInterval(pulse, REPEAT_MS);

    /* Pulse again whenever the visitor comes back to the tab. */
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) pulse();
    });

    /* …and once more after a scroll, but never more often than REPEAT_MS. */
    window.addEventListener(
      "scroll",
      function () {
        if (Date.now() - lastPulse < REPEAT_MS) return;
        pulse();
      },
      { passive: true }
    );
  }

  /* --------------------------------------------------------------------------
     Boot
     -------------------------------------------------------------------------- */

  function boot() {
    refreshReveals();

    /* Body fade-in for the signature page transition. */
    if (isSignature) document.body.classList.add("is-ready");

    initCartBadge();
    initFloatingWhatsApp();
    initPageTransitions();
    initParallax();

    if (isSignature) {
      initIntro(startHero);
    } else {
      window.setTimeout(startHero, CONFIG.hero.delay);
    }
  }

  document.addEventListener("DOMContentLoaded", boot);

  /* The header/footer partials arrive after boot — wire them up then. */
  document.addEventListener("partials:ready", function () {
    initCartBadge();
    initFloatingWhatsApp();
  });

  /* React to a live change of the reduced-motion preference. */
  if (motionQuery && motionQuery.addEventListener) {
    motionQuery.addEventListener("change", function () {
      refreshReveals();
    });
  }
})();
