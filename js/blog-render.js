/* ==========================================================================
   blog-render.js — shared blog content renderer
   ========================================================================== */
(function () {
  "use strict";
  const Bakery = (window.Bakery = window.Bakery || {});

  function renderBlocks(blocks) {
    const frag = document.createDocumentFragment();
    (blocks || []).forEach(function (block) {
      if (!block || typeof block !== "object") return;
      if (block.type === "p") {
        const p = document.createElement("p");
        p.textContent = block.text || "";
        frag.appendChild(p);
      } else if (block.type === "h2") {
        const h = document.createElement("h2");
        h.textContent = block.text || "";
        frag.appendChild(h);
      } else if (block.type === "h3") {
        const h = document.createElement("h3");
        h.textContent = block.text || "";
        frag.appendChild(h);
      } else if (block.type === "list" || block.type === "ul") {
        const ul = document.createElement("ul");
        (block.items || []).forEach(function (item) {
          const li = document.createElement("li");
          li.textContent = item || "";
          ul.appendChild(li);
        });
        frag.appendChild(ul);
      } else if (block.type === "ol") {
        const ol = document.createElement("ol");
        (block.items || []).forEach(function (item) {
          const li = document.createElement("li");
          li.textContent = item || "";
          ol.appendChild(li);
        });
        frag.appendChild(ol);
      }
    });
    return frag;
  }

  function wordCount(blocks) {
    let count = 0;
    (blocks || []).forEach(function (block) {
      if (!block) return;
      if (block.text) count += String(block.text).trim().split(/\s+/).filter(Boolean).length;
      if (Array.isArray(block.items)) {
        block.items.forEach(function (item) {
          count += String(item || "").trim().split(/\s+/).filter(Boolean).length;
        });
      }
    });
    return count;
  }

  function readingTimeFromBlocks(blocks) {
    const words = wordCount(blocks);
    const mins = Math.max(1, Math.round(words / 200));
    return mins + " min read";
  }

  function excerptFromBlocks(blocks, maxLen) {
    maxLen = maxLen || 160;
    for (let i = 0; i < (blocks || []).length; i += 1) {
      const block = blocks[i];
      if (block && block.type === "p" && block.text) {
        const text = String(block.text).trim();
        if (text.length <= maxLen) return text;
        return text.slice(0, maxLen).trim() + "...";
      }
    }
    return "";
  }

  Bakery.renderBlocks = renderBlocks;
  Bakery.wordCount = wordCount;
  Bakery.readingTimeFromBlocks = readingTimeFromBlocks;
  Bakery.excerptFromBlocks = excerptFromBlocks;
})();
