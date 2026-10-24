# Nilgiribytes — Static Website

A multi-page static website built with plain **HTML5, CSS3 and vanilla JavaScript**.
No frontend framework or build step. The catalog API runs as Vercel Functions.

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
- **Products** — `data/products.json` and `data/combos.json` are the local
  fallback. Published updates are stored in `data/catalog.json` in the GitHub
  repository and served by `/api/catalog`.
- **Admin publishing** — set these Vercel environment variables:
  - `ADMIN_USERNAME` / `ADMIN_PASSWORD` — admin login credentials.
  - `AUTH_SECRET` — random secret used to sign the admin session cookie.
  - `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH` — repository containing the site.
  - `GITHUB_TOKEN` — token with read/write access to repository contents.

  Open `admin.html`, sign in, make changes, then use **Publish changes**. Each
  publish commits `data/catalog.json` to GitHub, which triggers a Vercel
  redeploy. If another edit commits first, the API detects the SHA conflict and
  the admin retries once with the latest data.
- **Blog posts** — `data/blog.json`. The admin Blog tab lists published posts and
  deletes them through `/api/blog`, which commits the updated file to GitHub.
- **Domain** — replace `https://www.niligibytes.com` in `sitemap.xml`,
  `robots.txt`, `js/blog.js` (`SITE_URL`) and the canonical/OG tags in each page.
