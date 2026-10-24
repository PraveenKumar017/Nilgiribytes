/* ==========================================================================
   blog.js — blog list (featured, filter, search) and article detail view
   rendered from blog.html?slug=... using data/blog.json.
   ========================================================================== */

(function () {
  "use strict";

  const Bakery = (window.Bakery = window.Bakery || {});
  const SITE_URL = "https://www.niligibytes.com/"; // TODO: replace with the real domain

  let posts = [];

  const CATEGORIES = [
    "Baking Tips",
    "Bakery Stories",
    "Ingredients",
    "Recipes",
    "News",
  ];

  /* ---------- Data ---------- */

  function loadPosts() {
    if (posts.length) return Promise.resolve(posts);
    return fetch("data/blog.json")
      .then(function (r) {
        if (!r.ok) throw new Error("blog.json HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        posts = Array.isArray(data.posts) ? data.posts : [];
        return posts;
      })
      .catch(function (err) {
        console.error("Failed to load posts:", err);
        return [];
      });
  }

  function formatDate(iso) {
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  /* ---------- Meta helpers (SEO) ---------- */

  function setMeta(selector, attr, value) {
    const el = document.head.querySelector(selector);
    if (el) el.setAttribute(attr, value);
  }

  function setDetailSEO(post) {
    const url = SITE_URL + "blog.html?slug=" + encodeURIComponent(post.slug);
    document.title = post.title + " | Nilgiribytes Blog";
    setMeta('meta[name="description"]', "content", post.excerpt || "");
    setMeta("[data-canonical]", "href", url);
    setMeta("[data-og-title]", "content", post.title);
    setMeta("[data-og-desc]", "content", post.excerpt || "");
    setMeta("[data-og-url]", "content", url);
    if (post.image) setMeta("[data-og-image]", "content", SITE_URL + post.image);

    // Article JSON-LD
    const ld = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title,
      description: post.excerpt || "",
      image: SITE_URL + (post.image || ""),
      datePublished: post.date,
      author: { "@type": "Person", name: post.author || "Nilgiribytes" },
      publisher: {
        "@type": "Organization",
        name: "Nilgiribytes",
        url: SITE_URL,
      },
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
    };
    const script = document.getElementById("article-jsonld");
    if (script) script.textContent = JSON.stringify(ld);
  }

  /* ---------- List view ---------- */

  function postCard(post, featured) {
    const card = document.createElement("article");
    card.className = "post-card reveal" + (featured ? " post-card--featured" : "");
    card.setAttribute("data-reveal", featured ? "zoom-in" : "fade-up");

    const media = document.createElement("a");
    media.className = "post-card_media";
    media.href = "blog.html?slug=" + encodeURIComponent(post.slug);
    media.setAttribute("aria-label", "Read " + post.title);
    const img = document.createElement("img");
    img.src = post.image;
    img.alt = post.title;
    img.width = 800;
    img.height = 450;
    img.loading = featured ? "eager" : "lazy";
    img.setAttribute("data-fallback", "Article image coming soon");
    img.addEventListener("error", function () {
      Bakery.handleImageError(img, "Article image coming soon");
    });
    media.appendChild(img);

    /* Reading-time badge — top-right over the image. */
    const readBadge = document.createElement("span");
    readBadge.className = "post-card_read";
    readBadge.textContent = post.readingTime;
    media.appendChild(readBadge);

    const body = document.createElement("div");
    body.className = "post-card_body";

    const meta = document.createElement("p");
    meta.className = "post-card_meta";
    const cat = document.createElement("span");
    cat.className = "post-card_category";
    cat.textContent = post.category;
    const date = document.createElement("span");
    date.textContent = formatDate(post.date);
    meta.appendChild(cat);
    meta.appendChild(date);

    const title = document.createElement("h3");
    title.className = "post-card_title";
    const titleLink = document.createElement("a");
    titleLink.href = "blog.html?slug=" + encodeURIComponent(post.slug);
    titleLink.textContent = post.title;
    title.appendChild(titleLink);

    const excerpt = document.createElement("p");
    excerpt.className = "post-card_excerpt";
    excerpt.textContent = post.excerpt;

    const link = document.createElement("a");
    link.className = "post-card_link";
    link.href = "blog.html?slug=" + encodeURIComponent(post.slug);
    link.textContent = "Read article →";

    body.appendChild(meta);
    body.appendChild(title);
    body.appendChild(excerpt);
    body.appendChild(link);

    card.appendChild(media);
    card.appendChild(body);
    return card;
  }

  function initList() {
    const featuredWrap = document.getElementById("blog-featured");
    const grid = document.getElementById("blog-grid");
    if (!grid) return;

    const chips = Array.from(document.querySelectorAll("[data-post-filter]"));
    const searchInput = document.getElementById("blog-search");

    let category = "All";
    let query = "";

    function apply() {
      loadPosts().then(function (all) {
        let list = all.slice();

        if (category !== "All") {
          list = list.filter(function (p) {
            return p.category === category;
          });
        }
        if (query) {
          const q = query.toLowerCase();
          list = list.filter(function (p) {
            return (
              p.title.toLowerCase().indexOf(q) > -1 ||
              p.excerpt.toLowerCase().indexOf(q) > -1 ||
              p.category.toLowerCase().indexOf(q) > -1
            );
          });
        }

        // Featured article: first featured match, only when unfiltered
        featuredWrap.innerHTML = "";
        const canFeature = category === "All" && !query;
        if (canFeature) {
          const featIdx = list.findIndex(function (p) {
            return p.featured;
          });
          if (featIdx > -1) {
            const feat = list.splice(featIdx, 1)[0];
            featuredWrap.appendChild(postCard(feat, true));
          }
        }

        grid.innerHTML = "";
        if (!list.length) {
          const empty = document.createElement("p");
          empty.className = "empty-state";
          empty.textContent = "No articles match your search. Try another keyword or category.";
          grid.appendChild(empty);
          return;
        }
        list.forEach(function (post) {
          grid.appendChild(postCard(post, false));
        });

        if (typeof window.refreshReveals === "function") {
          window.refreshReveals(featuredWrap);
          window.refreshReveals(grid);
        } else if (typeof Bakery.observeReveals === "function") {
          Bakery.observeReveals(featuredWrap);
          Bakery.observeReveals(grid);
        }
      });
    }

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        category = chip.getAttribute("data-post-filter");
        chips.forEach(function (c) {
          c.setAttribute("aria-pressed", String(c === chip));
        });
        apply();
      });
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

    apply();
  }

  /* ---------- Detail view ---------- */

  function renderBlocks(blocks) {
    const frag = document.createDocumentFragment();
    (blocks || []).forEach(function (block) {
      if (block.type === "p") {
        const p = document.createElement("p");
        p.textContent = block.text;
        frag.appendChild(p);
      } else if (block.type === "h2") {
        const h = document.createElement("h2");
        h.textContent = block.text;
        frag.appendChild(h);
      } else if (block.type === "h3") {
        const h = document.createElement("h3");
        h.textContent = block.text;
        frag.appendChild(h);
      } else if (block.type === "list" || block.type === "ul") {
        const ul = document.createElement("ul");
        (block.items || []).forEach(function (item) {
          const li = document.createElement("li");
          li.textContent = item;
          ul.appendChild(li);
        });
        frag.appendChild(ul);
      } else if (block.type === "ol") {
        const ol = document.createElement("ol");
        (block.items || []).forEach(function (item) {
          const li = document.createElement("li");
          li.textContent = item;
          ol.appendChild(li);
        });
        frag.appendChild(ol);
      }
    });
    return frag;
  }

  function shareButtons(post) {
    const wrap = document.createElement("div");
    wrap.className = "article_share";

    const url = SITE_URL + "blog.html?slug=" + encodeURIComponent(post.slug);
    const text = post.title;

    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "btn btn--outline btn--small";
    copy.textContent = "Copy link";
    copy.addEventListener("click", function () {
      const done = function () {
        copy.textContent = "Link copied ✓";
        setTimeout(function () {
          copy.textContent = "Copy link";
        }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done).catch(done);
      } else {
        done();
      }
    });

    const fb = document.createElement("a");
    fb.className = "btn btn--ghost btn--small";
    fb.href = "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(url);
    fb.target = "_blank";
    fb.rel = "noopener";
    fb.textContent = "Share on Facebook";

    const wa = document.createElement("a");
    wa.className = "btn btn--ghost btn--small";
    wa.href =
      "https://wa.me/?text=" + encodeURIComponent(text + " " + url);
    wa.target = "_blank";
    wa.rel = "noopener";
    wa.textContent = "Share on WhatsApp";

    wrap.appendChild(copy);
    wrap.appendChild(fb);
    wrap.appendChild(wa);
    return wrap;
  }

  function initDetail(slug) {
    const list = document.getElementById("blog-list-view");
    const detail = document.getElementById("blog-detail-view");
    const root = document.getElementById("article-root");

    loadPosts().then(function (all) {
      const post = all.find(function (p) {
        return p.slug === slug;
      });

      if (!post) {
        if (list) list.hidden = false;
        if (detail) detail.hidden = true;
        document.title = "Article not found | Nilgiribytes";
        return;
      }

      if (list) list.hidden = true;
      if (detail) detail.hidden = false;
      setDetailSEO(post);

      // Back link
      const back = document.createElement("p");
      const backLink = document.createElement("a");
      backLink.className = "link-arrow";
      backLink.href = "blog.html";
      backLink.textContent = "← Back to all articles";
      back.appendChild(backLink);

      // Title
      const h1 = document.createElement("h1");
      h1.className = "page-hero_title";
      h1.textContent = post.title;

      // Meta
      const meta = document.createElement("p");
      meta.className = "article_meta";
      [
        "By " + (post.author || "Nilgiribytes"),
        formatDate(post.date),
        post.readingTime,
        post.category,
      ].forEach(function (part) {
        const span = document.createElement("span");
        span.textContent = part;
        meta.appendChild(span);
      });

      // Cover
      const coverWrap = document.createElement("div");
      coverWrap.className = "article_cover";
      const cover = document.createElement("img");
      cover.src = post.image;
      cover.alt = post.title;
      cover.width = 1200;
      cover.height = 675;
      cover.setAttribute("data-fallback", "Article image coming soon");
      cover.addEventListener("error", function () {
        Bakery.handleImageError(cover, "Article image coming soon");
      });
      coverWrap.appendChild(cover);

      // Content
      const content = document.createElement("div");
      content.className = "article_content";
      content.appendChild(renderBlocks(post.content));

      root.innerHTML = "";
      root.appendChild(back);
      root.appendChild(h1);
      root.appendChild(meta);
      root.appendChild(coverWrap);
      root.appendChild(content);
      root.appendChild(shareButtons(post));

      // Related posts (same category first, then others)
      const related = all
        .filter(function (p) {
          return p.slug !== post.slug;
        })
        .sort(function (a, b) {
          const aMatch = a.category === post.category ? 0 : 1;
          const bMatch = b.category === post.category ? 0 : 1;
          return aMatch - bMatch;
        })
        .slice(0, 3);

      if (related.length) {
        const section = document.createElement("section");
        section.className = "related";
        const h2 = document.createElement("h2");
        h2.className = "section-heading text-left";
        h2.textContent = "Related posts";
        const grid = document.createElement("div");
        grid.className = "blog-grid mt-2";
        related.forEach(function (p) {
          grid.appendChild(postCard(p, false));
        });
        section.appendChild(h2);
        section.appendChild(grid);
        root.appendChild(section);
        if (typeof window.refreshReveals === "function") {
          window.refreshReveals(root);
        } else if (typeof Bakery.observeReveals === "function") {
          Bakery.observeReveals(root);
        }
      }
    });
  }

  /* ---------- Boot ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    const slug = new URLSearchParams(window.location.search).get("slug");
    if (slug) {
      initDetail(slug);
    } else {
      initList();
    }
  });
})();
