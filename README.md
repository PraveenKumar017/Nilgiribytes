# Nilgiribytes — Static Website

A multi-page static website built with plain **HTML5, CSS3 and vanilla JavaScript**.
No frameworks, no build tools, no backend.

## Pages

| File | Purpose |
|---|---|
| `index.html` | Home |
| `shop.html` | Shop with filters, search, sorting, cart & WhatsApp ordering |
| `about.html` | Brand story, timeline, values, visit info |
| `blog.html` | Blog list + article detail via `?slug=` |
| `header.html` / `footer.html` | Shared partials loaded with `fetch()` |

## Running locally (required)

Shared partials are loaded with `fetch()`, which browsers block on `file://`
protocol. **Open the site through a local static server** instead:

Option A — VS Code **Live Server** extension (simplest):
1. Install the "Live Server" extension.
2. Open this folder in VS Code and click **Go Live**.

Option B — Python:
```bash
# Python 3.x
python -m http.server 8080
# then open http://localhost:8080
```

Option C — Node (no npm install needed if npx is available):
```bash
npx serve .
```

If you open the pages directly via `file://`, a fallback note will appear where
the header and footer should be.

## Configuration

- **WhatsApp number** — set once at the top of `js/cart.js` (`WHATSAPP_NUMBER`).
- **Design tokens** — all colors/typography in `css/variables.css`.
- **Products** — `data/products.json` and `data/combos.json`.
- **Blog posts** — `data/posts.json`.
- **Domain** — replace `https://www.niligibytes.com` in `sitemap.xml`,
  `robots.txt`, `js/blog.js` (`SITE_URL`) and the canonical/OG tags in each page.

See `master_notes.md` for the full documentation and the TODO checklist of
content the bakery must supply before launch.
