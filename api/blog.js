const { getAuthUser } = require("./_auth");
const LOCAL_BLOG = require("../data/blog.json");

const REPO_FILE = "data/blog.json";
const GITHUB_API = "https://api.github.com";

function githubEnv() {
  return {
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH || "main",
    token: process.env.GITHUB_TOKEN,
  };
}

function githubConfigured() {
  const env = githubEnv();
  return Boolean(env.owner && env.repo && env.token);
}

function configError() {
  return "GitHub environment variables (GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH, GITHUB_TOKEN) are not configured";
}

function isLocalRequest(req) {
  const host = String(req.headers.host || "").split(":")[0].toLowerCase();
  return host === "localhost" || host === "127.0.0.1";
}

function localBlog() {
  const posts = Array.isArray(LOCAL_BLOG.posts) ? LOCAL_BLOG.posts : [];
  return { posts: posts };
}

function readBody(body) {
  if (!body) return null;
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch (err) {
      return null;
    }
  }
  return body;
}

function normalizePost(post) {
  if (!post || typeof post !== "object") return post;
  const copy = Object.assign({}, post);
  if (copy.status !== "draft") copy.status = "published";
  delete copy.featured;
  return copy;
}

function normalizeBlog(blog) {
  if (!blog || typeof blog !== "object") return blog;
  const posts = Array.isArray(blog.posts) ? blog.posts : [];
  return { posts: posts.map(normalizePost) };
}

function validatePost(post) {
  if (!post || typeof post !== "object") return { error: "Invalid post." };
  if (typeof post.slug !== "string" || !post.slug.trim()) return { error: "Slug required." };
  if (typeof post.title !== "string" || !post.title.trim()) return { error: "Title required." };
  if (typeof post.category !== "string" || !post.category.trim()) return { error: "Category required." };
  if (typeof post.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(post.date)) return { error: "Valid date required." };
  if (!Array.isArray(post.content) || !post.content.length) return { error: "Content required." };
  if (post.status && post.status !== "draft" && post.status !== "published") return { error: "Invalid status." };
  return { ok: true };
}

function validateBlogPosts(posts) {
  if (!Array.isArray(posts)) return { error: "Blog must contain a posts array." };
  const slugs = new Set();
  for (const post of posts) {
    const v = validatePost(post);
    if (v.error) return v;
    const slug = String(post.slug).trim();
    if (slugs.has(slug)) return { error: 'Duplicate blog slug "' + slug + '".' };
    slugs.add(slug);
  }
  return { ok: true };
}

async function getGitHubFile() {
  const env = githubEnv();
  if (!env.owner || !env.repo || !env.token) throw new Error(configError());
  const url = GITHUB_API + "/repos/" + env.owner + "/" + env.repo + "/contents/" + REPO_FILE + "?ref=" + encodeURIComponent(env.branch);
  const response = await fetch(url, {
    headers: { Authorization: "Bearer " + env.token, Accept: "application/vnd.github.v3+json", "User-Agent": "nilgiribytes-admin" },
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const text = await response.text();
    throw new Error("GitHub read failed (" + response.status + "): " + text);
  }
  const data = await response.json();
  const raw = data && typeof data.content === "string" ? Buffer.from(data.content, "base64").toString("utf8") : "";
  if (!raw.trim()) return { sha: data ? data.sha || null : null, blog: null };
  let parsed;
  try { parsed = JSON.parse(raw); } catch (err) { throw new Error(REPO_FILE + " is not valid JSON. Repair it in GitHub before continuing."); }
  if (Array.isArray(parsed)) parsed = { posts: parsed };
  if (!parsed || typeof parsed !== "object") throw new Error(REPO_FILE + " must contain a JSON object.");
  if (!Array.isArray(parsed.posts)) throw new Error(REPO_FILE + " must contain a posts array.");
  return { sha: data ? data.sha || null : null, blog: normalizeBlog(parsed) };
}

async function putGitHubFile(sha, blog, message) {
  const env = githubEnv();
  if (!env.owner || !env.repo || !env.token) throw new Error(configError());
  const url = GITHUB_API + "/repos/" + env.owner + "/" + env.repo + "/contents/" + REPO_FILE;
  const payload = { message, content: Buffer.from(JSON.stringify(blog, null, 2)).toString("base64"), branch: env.branch };
  if (sha) payload.sha = sha;
  const response = await fetch(url, {
    method: "PUT",
    headers: { Authorization: "Bearer " + env.token, Accept: "application/vnd.github.v3+json", "User-Agent": "nilgiribytes-admin", "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (response.status === 409) { const error = new Error("Another update changed the blog. Please retry."); error.code = "CONFLICT"; throw error; }
  if (!response.ok) { const text = await response.text(); throw new Error("GitHub write failed (" + response.status + "): " + text); }
  return response.json();
}

async function loadBlog(req) {
  const user = getAuthUser(req);
  const local = isLocalRequest(req);
  let sha = null;
  let blog = null;
  if (!local && githubConfigured()) {
    try {
      const file = await getGitHubFile();
      if (file) { sha = file.sha; blog = file.blog; }
    } catch (err) {
      console.error("Blog read failed:", err.message);
    }
  }
  if (!blog) blog = normalizeBlog(localBlog());
  let posts = Array.isArray(blog.posts) ? blog.posts : [];
  if (!user) posts = posts.filter(function (p) { return normalizePost(p).status === "published"; });
  return { posts: posts, version: sha };
}

async function saveBlog(user, posts, sha, message) {
  if (!user) throw new Error("Unauthorized");
  if (!githubConfigured()) throw new Error(configError());
  const normalized = normalizeBlog({ posts: posts });
  const v = validateBlogPosts(normalized.posts);
  if (v.error) { const err = new Error(v.error); err.status = 400; throw err; }
  try {
    await putGitHubFile(sha, normalized, message);
    return { ok: true, posts: normalized.posts.length };
  } catch (err) {
    if (err.code === "CONFLICT") { err.status = 409; throw err; }
    if (!err.status) err.status = 500;
    throw err;
  }
}

module.exports = async (req, res) => {
  const method = req.method;
  res.setHeader("Cache-Control", "no-store");
  const user = getAuthUser(req);

  if (method === "GET" || method === "HEAD") {
    try {
      const data = await loadBlog(req);
      if (method === "HEAD") { res.status(200).end(); return; }
      res.status(200).json(data);
      return;
    } catch (err) {
      console.error("Blog read failed:", err);
      const fallback = normalizeBlog(localBlog());
      let posts = Array.isArray(fallback.posts) ? fallback.posts : [];
      if (!user) posts = posts.filter(function (p) { return normalizePost(p).status === "published"; });
      if (method === "HEAD") { res.status(200).end(); return; }
      res.status(200).json({ posts: posts, version: null });
      return;
    }
  }

  if (method === "POST") {
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const body = readBody(req.body) || {};
    if (body.action === "publish") {
      const slug = String(body.slug || "").trim();
      const version = body.version || null;
      if (!slug) { res.status(400).json({ error: "Slug required." }); return; }
      try {
        const latest = await getGitHubFile();
        const sha = latest && latest.sha ? latest.sha : version;
        const posts = Array.isArray(latest && latest.blog && latest.blog.posts) ? latest.blog.posts.map(normalizePost) : [];
        let found = false;
        const updated = posts.map(function (p) {
          if (String(p.slug).trim() === slug) { found = true; return Object.assign({}, p, { status: "published" }); }
          return p;
        });
        if (!found) { res.status(404).json({ error: "Post not found." }); return; }
        const result = await saveBlog(user, updated, sha, "Publish blog post via /api/blog (admin)");
        res.status(200).json(Object.assign({ ok: true }, result));
        return;
      } catch (err) {
        if (err.status === 409) { res.status(409).json({ error: err.message, code: "CONFLICT" }); return; }
        if (err.status === 400) { res.status(400).json({ error: err.message }); return; }
        if (err.status === 503) { res.status(503).json({ error: err.message }); return; }
        console.error("Blog publish failed:", err);
        res.status(500).json({ error: err.message });
        return;
      }
    }
    res.setHeader("Allow", "GET, HEAD, PUT, POST, DELETE");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  if (method === "PUT") {
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const body = readBody(req.body) || {};
    const incoming = body.post ? body.post : body;
    const post = normalizePost(Object.assign({}, incoming));
    if (!post.slug) { res.status(400).json({ error: "Slug required." }); return; }
    const originalSlug = body.originalSlug ? String(body.originalSlug).trim() : String(post.slug).trim();
    const version = body.version || null;
    try {
      const latest = await getGitHubFile();
      const sha = latest && latest.sha ? latest.sha : version;
      const posts = Array.isArray(latest && latest.blog && latest.blog.posts) ? latest.blog.posts.map(normalizePost) : [];
      const updated = [];
      let replaced = false;
      posts.forEach(function (p) {
        if (String(p.slug).trim() === originalSlug) { updated.push(post); replaced = true; }
        else updated.push(p);
      });
      if (!replaced) updated.unshift(post);
      const result = await saveBlog(user, updated, sha, "Update blog via /api/blog (admin)");
      res.status(200).json(Object.assign({ ok: true, post: post }, result));
      return;
    } catch (err) {
      if (err.status === 409) { res.status(409).json({ error: err.message, code: "CONFLICT" }); return; }
      if (err.status === 400) { res.status(400).json({ error: err.message }); return; }
      if (err.status === 503) { res.status(503).json({ error: err.message }); return; }
      console.error("Blog write failed:", err);
      res.status(500).json({ error: err.message });
      return;
    }
  }

  if (method === "DELETE") {
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const body = readBody(req.body) || {};
    const slug = String(body.slug || req.query && req.query.slug || "").trim();
    const version = body.version || null;
    if (!slug) { res.status(400).json({ error: "Slug required." }); return; }
    try {
      const latest = await getGitHubFile();
      const sha = latest && latest.sha ? latest.sha : version;
      const posts = Array.isArray(latest && latest.blog && latest.blog.posts) ? latest.blog.posts.map(normalizePost) : [];
      const updated = posts.filter(function (p) { return String(p.slug).trim() !== slug; });
      const result = await saveBlog(user, updated, sha, "Delete blog post via /api/blog (admin)");
      res.status(200).json(Object.assign({ ok: true }, result));
      return;
    } catch (err) {
      if (err.status === 409) { res.status(409).json({ error: err.message, code: "CONFLICT" }); return; }
      if (err.status === 400) { res.status(400).json({ error: err.message }); return; }
      if (err.status === 503) { res.status(503).json({ error: err.message }); return; }
      console.error("Blog delete failed:", err);
      res.status(500).json({ error: err.message });
      return;
    }
  }

  res.setHeader("Allow", "GET, HEAD, PUT, POST, DELETE");
  res.status(405).json({ error: "Method not allowed." });
};
