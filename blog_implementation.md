# Blog Manager — Implementation Plan

**Goal:** Let a non-technical admin with basic English create, edit and publish a blog post from `admin.html` without touching code, JSON, HTML, Markdown or image paths.

---

## 1. Recommended approach

Use a **simple block editor + live preview + draft/publish workflow**.

The admin writes normal prose in plain fields. Internally the post is still stored as the existing `content` block array, so the public blog keeps working with no schema break.

Do **not** expose raw HTML, Markdown or a complex WYSIWYG toolbar in v1. They add jargon, security risk and failure modes without helping the target user.

### UX in one sentence

> Click **Add post** → fill in title, photo and summary → write paragraphs/headings/lists → **Save draft** → preview → **Publish** from the post’s Action column.

---

## 2. Scope

### In scope (v1)

- Add post
- Edit post
- Save as draft
- Publish a draft from the post’s Action column
- Delete post (already exists; keep it)
- Cover-image upload with preview
- Cover-image alt text
- Title, category, author, date, summary
- Paragraph, section heading, sub-heading, bullet list and numbered list blocks
- Reorder/remove content blocks
- Automatic reading time
- Automatic unique slug
- Draft/Published status; drafts are hidden from the public blog
- Draft preview inside admin
- Publish to `data/blog.json` via GitHub, with clear success/error states
- Unsaved-changes protection and local autosave
- Mobile and keyboard accessibility

### Out of scope (v1)

- Rich inline formatting (bold, italic, links)
- Multi-author accounts / roles
- Scheduling future posts
- Unpublish / archive workflow
- Separate draft revisions for already-published posts
- Featured posts
- Comments, tags, SEO per-post fields
- Image library browser

### Phase 2 (only if needed)

- Scheduled publishing
- Unpublish / archive
- Draft revisions for published posts
- Inline links and bold/italic (requires a safe inline schema)
- Search/filter in the blog table
- Image library / image reuse

---

## 3. User experience

### 3.1 Blog list

Replace the current table actions with:

| Column | Content |
|---|---|
| Image | Cover thumbnail |
| Title | Post title |
| Category | Category name |
| Date | Publish date |
| Status | `Draft` / `Published` |
| Action | **Edit** (pencil), **Publish** (drafts only), **Delete** (trash) |

- Add an **Add post** button in the toolbar when the Blog tab is active.
- Empty state: “No posts yet.” + **Write your first post** button.
- Draft rows show a clear **Publish** button in the Action column.
- Published rows show Edit and Delete; no Publish action is needed.
- Keep the existing Delete confirmation.
- Do not add a “View” action (removed by request).
- Remove the Featured column and all featured logic.

### 3.2 Editor layout

Use a dedicated full-width editor view inside the admin page, not the current 680 px drawer. A drawer is too narrow for writing and previewing.

**Desktop:** two columns — form on the left, live preview on the right.
**Mobile:** one column with a **Write / Preview** switch.

Header:

- “New post” or “Edit post”
- `← Back to posts`
- Status badge: **Draft** or **Published**
- Status text (Saving, Saved, Error)

Sticky footer:

- **Cancel**
- **Preview** (mobile only)
- **Save draft** for new and draft posts
- **Save changes** for published posts (updates the live post immediately)

### 3.3 Editor sections

Use numbered, plain-language sections:

#### 1. Post details

- **Title** — required. Example: “Five ways to enjoy varkey with tea”.
- **Category** — dropdown: Bakery Stories, Recipes, Baking Tips, Ingredients, News.
- **Author** — default `Nilgiribytes Team`.
- **Date** — defaults to today.
- **Short summary** — 1–2 sentences. Helper: “Shown on the blog list and in search results.” If left blank, generate from the first paragraph.

#### 2. Cover image

- Large click-or-drag upload area.
- Accept JPG, PNG or WebP; compress in the browser before upload.
- Show a preview and a **Remove / Replace** action.
- Helper: “Use a wide photo, at least 1200 px wide.”
- **Image description (alt text)** — optional, defaults to the post title.
- No visible file-path input in the normal flow.

#### 3. Content

Start every new post with one empty paragraph block.

Buttons:

- **+ Paragraph**
- **+ Heading**
- **+ Sub-heading**
- **+ Bullet list**
- **+ Numbered list**

Each block is a card with:

- Type label
- Large textarea (or item rows for lists)
- **Move up / Move down**
- **Remove**

For lists, use repeatable item rows with **+ Add item** rather than “one item per line”. This is clearer for basic English users and avoids formatting mistakes.

Show a live word count and the calculated reading time: “About 3 min read”.

#### 4. Preview

- Renders the real article: title, meta, cover, summary and content.
- Uses the same renderer and CSS classes as `blog.html` so it is not a different-looking mock.
- Validation errors do not block preview.

### 3.4 Draft and publish flow

**Save draft (editor)**

1. User clicks **Save draft**.
2. Client validates and focuses the first problem.
3. Button becomes **Saving…** and is disabled.
4. API commits the post to `data/blog.json` with `status: "draft"`.
5. Success: return to the blog list with “Draft saved. Publish it when you are ready.”
6. Failure: stay in the editor, keep every word, show the error and a **Try again** button.

**Publish (post Action column)**

1. The row shows a **Publish** button only for drafts.
2. User clicks Publish.
3. Confirm only if needed; the post title makes the action clear.
4. API sets `status: "published"` and commits the file.
5. Success: the row updates to Published and shows “Post published. It may take a minute to appear on the live site.”
6. Failure: the post stays a draft and the error is shown above the table.

Drafts are never returned by the public blog. There is no global “Publish changes” button for blog posts.

### 3.5 Editing an existing post

- Load the post into the same editor.
- Keep the existing slug/link stable when the title changes.
- **Draft:** Save draft keeps it hidden from the public blog.
- **Published:** show a notice — “This post is live. Saving changes will update it right away.” The save button reads **Save changes**.
- If the post cannot be loaded, show a clear error and return to the list.

### 3.6 Protection against lost work

- Warn before leaving with unsaved changes.
- Autosave the draft in `localStorage` while typing.
- On re-open, offer: “You have an unsaved draft for this post. Restore it?”
- Clear the autosave after a successful publish or explicit discard.
- Do not autosave passwords or published server state.

---

## 4. Data model

Keep the existing shape:

```json
{
  "slug": "five-ways-to-enjoy-your-tea-time-combo",
  "status": "published",
  "title": "Five Ways to Enjoy Your Tea Time Combo",
  "category": "Recipes",
  "author": "Nilgiribytes Team",
  "date": "2026-01-22",
  "readingTime": "3 min read",
  "image": "assets/images/blog/example.jpg",
  "excerpt": "From a morning chai to a quick dessert…",
  "content": [
    { "type": "p", "text": "…" },
    { "type": "h2", "text": "…" },
    { "type": "h3", "text": "…" },
    { "type": "list", "items": ["…"] },
    { "type": "ol", "items": ["…"] }
  ]
}
```

Proposed optional fields:

- `imageAlt` — image description for accessibility; fall back to title.
- `updatedAt` — optional audit timestamp.

Rules:

- `status` is `"draft"` or `"published"`. Existing posts migrate to `"published"`.
- The public blog filters out drafts.
- `slug` is generated once from the title and then kept stable.
- `readingTime` is calculated automatically from word count (about 200 words/minute, minimum 1 minute).
- `excerpt` is auto-generated from the first paragraph when blank (about 160 characters).
- `date` is `YYYY-MM-DD`.
- New posts are inserted at the top of the array; the public list sorts by date descending.
- Remove the `featured` field from all posts and remove all featured logic.

---

## 5. API changes

### 5.1 `api/blog.js`

Keep `GET`, but return a version so two people cannot silently overwrite each other:

```json
{ "posts": [], "version": "github-file-sha-or-null" }
```

Add write operations:

- **Upsert one post** (`PUT`): body `{ post, originalSlug, version }`
  - Reads the latest file.
  - Replaces the post with `originalSlug` or adds it.
  - Accepts `status: "draft"` or `"published"`.
  - Commits the file.
  - Returns the saved post, all posts and the new version.
- **Publish one draft** (`POST`): body `{ action: "publish", slug, version }`
  - Reads the latest file.
  - Sets that post’s `status` to `"published"`.
  - Commits the file.
  - Returns the published post, all posts and the new version.
- **Delete one post** (`DELETE`): body/query `{ slug, version }`
  - Removes only that post.
  - Commits the file.
  - Returns the new version.

Why per-post instead of sending the whole array: it avoids wiping another admin's changes and keeps the admin payload small.

Server-side validation:

- Auth required for all writes.
- Title required, maximum reasonable length.
- Slug required after generation; unique.
- `status` must be `"draft"` or `"published"` (missing means published for old data).
- Category must be in the allowed list.
- Author and excerpt length limits.
- Date must be valid `YYYY-MM-DD`.
- Content must be an array of allowed block types with non-empty text/items.
- At least one content block with text.
- Image path must be a safe local `assets/...` path (no external URLs in v1).
- Limit posts, blocks and total body size.
- Return useful errors that the admin can display directly.
- On GitHub SHA conflict: return `409 CONFLICT`; the admin keeps the editor content and shows a retry message.


### 5.2 `api/blog-image.js` (new)

`POST` with authenticated JSON:

```json
{ "filename": "tea.jpg", "contentType": "image/jpeg", "data": "<base64>" }
```

- Validate auth, MIME type and decoded size.
- Allow only JPEG, PNG and WebP. Reject SVG.
- Generate a safe unique name: `assets/images/blog/<date>-<slug>-<random>.<ext>`.
- Commit the image to GitHub with the same token/config as the blog API.
- Return the public path.
- Enforce a small payload limit (target input ≤ 5 MB; client compresses below ~1.5 MB).
- Local development: preview the chosen file with a temporary object URL. The committed image becomes available after the GitHub commit/redeploy; show “Image uploaded” only after the API responds.

Client-side compression before upload:

- Resize to a maximum width of 1600 px.
- Convert photos to JPEG/WebP around 0.85 quality.
- Preserve aspect ratio.
- Show upload progress and a clear failure message.

### 5.3 Local development

Keep the existing localhost preference that serves `data/blog.json` directly, so new image paths and posts are testable without GitHub. Writes still use GitHub when configured; document that localhost fallback clearly in status messages if an upload cannot be published.

---

## 6. Front-end files

### `admin.html`

- Blog toolbar: **Add post**.
- Blog table: columns Image, Title, Category, Date, Status, Action with **Edit**, **Publish** (drafts only), **Delete**. No featured column.
- Dedicated blog editor view with the fields and block editor (Save draft / Save changes).
- Hidden/advanced link field if needed; no path typing in the main flow.
- Keep the existing catalog editor untouched.

### `js/admin.js`

- Blog state: posts, loaded version, current editor draft, dirty flag, saving flag.
- List rendering with Edit/Publish/Delete and status badges.
- Editor open/close, load existing post, reset for new post.
- Slug generation and uniqueness.
- Reading-time and excerpt generation.
- Validation with inline messages and focus management.
- Content block add/remove/move and list item rows.
- Image choose/compress/upload/preview.
- Save draft, save changes (published), publish draft, and delete calls; version handling.
- Autosave/restore and unsaved-change guard.
- Plain-language status messages via `aria-live`.

### `js/blog-render.js` (new shared renderer)

- Move/reuse the existing `renderBlocks` logic from `js/blog.js`.
- Export a small API on `window.Bakery`:
  - `renderBlocks(content)` → DOM fragment
  - `wordCount(content)` / `readingTime(content)`
  - `excerptFrom(content)`
- Used by both the public article page and the admin preview so they cannot drift apart.
- Keep all output text-safe (`textContent`, never `innerHTML` with user text).

### `js/blog.js`

- Load the shared renderer.
- Filter to `status !== "draft"` for the public listing.
- Sort posts by date descending before displaying.
- Remove all featured logic and the featured card. Render all published posts in the grid.
- Use `imageAlt` when present.
- No other behavioural change.

### `css/admin.css`

- Full-width editor layout.
- Two-column form/preview on desktop; tabs on mobile.
- Block cards, reorder controls and list item rows.
- Upload drop zone and image preview.
- Clear inline validation and success/error states.
- Status badges (Draft/Published) and publish buttons.
- Keep the existing visual language (Playfair headings, cream/gold palette).
- Responsive rules for 320 px and up.

### `README.md` / this file

- Document the editor, image upload and publish flow.
- Update the API notes to mention the version field and image endpoint.

---

## 7. Validation and error messages

Use short, human messages:

- “Please add a title.”
- “Please write at least one paragraph.”
- “Please choose a category.”
- “Please add a cover image.” (if cover is required for publish)
- “This image is too large. Please choose a smaller photo.”
- “The blog was updated somewhere else. Please try again.”
- “Could not publish. Your text is safe — please try again.”
- “Published. It may take a minute to appear on the live site.”

Avoid technical wording such as “slug”, “excerpt”, “block”, “payload”, “409” or “GitHub SHA” in the admin UI. Use them only in code/docs.

---

## 8. Security and safety

- Require the existing authenticated admin session for every write and upload.
- Validate everything again on the server.
- Never inject user text with `innerHTML`.
- Reject SVG uploads and non-image MIME types.
- Sanitize generated filenames; never trust the original filename.
- Limit image size, post count, block count and text length.
- Do not delete old images automatically in v1.
- Keep the existing GitHub conflict handling; never silently overwrite a newer file.
- Do not log tokens or secret environment values.

---

## 9. Accessibility and mobile

- Every field has a visible label and helper text.
- Errors are announced and focus moves to the first invalid field.
- Reorder buttons are real buttons with accessible names.
- Preview and Write tabs are keyboard accessible.
- Sticky publish bar must not cover content on small screens.
- Support 320 px width without horizontal scrolling.
- Respect reduced motion for opening/closing panels.

---

## 10. Implementation order

1. **API foundation**
   - Extend `api/blog.js`: full validation, GET version, per-post upsert/delete.
   - Add `api/blog-image.js`.
   - Verify with authenticated requests and localhost fallback.
2. **List and editor shell**
   - Add-post button, Edit action, dedicated editor view.
   - Fields, slug/reading-time/excerpt generation, validation.
3. **Block editor + preview**
   - Add shared `js/blog-render.js`.
   - Paragraph/heading/list blocks, reorder, live preview.
4. **Image upload**
   - Client compression, upload endpoint, preview, alt text.
5. **Publish and safety**
   - Publish/update flow, featured exclusivity, autosave, unsaved guard, conflict messages.
6. **Polish and QA**
   - Mobile layout, accessibility, empty/loading/error states.
   - End-to-end checks on localhost and the deployed site.

---

## 11. Acceptance criteria

- A user with basic English can create a draft post, add content and a cover image, and publish it from the Action column without knowing HTML, Markdown, JSON or file paths.
- The editor explains every field in plain language.
- A cover image can be uploaded and previewed without typing a path.
- Paragraphs, headings and lists can be added, reordered and removed.
- Preview matches the published article.
- Drafts are hidden from the public blog until published.
- Editing a published post updates it immediately when saved; draft posts stay hidden until published.
- Publishing shows clear progress, success and failure states; failures never lose text.
- Delete still works and is confirmed.
- All posts look the same with no featured distinction.
- No user-provided text is rendered as raw HTML.
- The flow works on a phone and with a keyboard.
- Existing catalog management is unaffected.

---

## 12. Decisions to confirm before coding

Recommended choices are marked.

1. **Publishing** — per-post **Publish** in the Action column (drafts only); editor **Save draft** / **Save changes** (recommended). Resolved.
2. **Drafts** — required; public blog hides drafts (recommended). Resolved.
3. **Inline formatting** — block-level only in v1 (recommended). Resolved.
4. **Cover image** — upload with preview (recommended). Resolved.
5. **Featured posts** — remove entirely; all posts equal (recommended). Resolved.
6. **Slug visibility** — auto-generated and hidden under “Advanced” (recommended). Resolved.
