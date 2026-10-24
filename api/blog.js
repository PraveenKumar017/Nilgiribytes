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

function localBlog() {
  return { posts: LOCAL_BLOG.posts || [] };
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

function validateBlog(body) {
  const blog = readBody(body);
  if (!blog || typeof blog !== "object") {
    return { error: "A JSON blog body is required." };
  }
  if (!Array.isArray(blog.posts)) {
    return { error: "Blog must contain a posts array." };
  }

  const slugs = new Set();
  for (const post of blog.posts) {
    if (!post || typeof post !== "object") {
      return { error: "Every blog post must be an object." };
    }
    if (typeof post.slug !== "string" || !post.slug.trim()) {
      return { error: "Every blog post needs a non-empty slug." };
    }
    if (typeof post.title !== "string" || !post.title.trim()) {
      return { error: "Every blog post needs a non-empty title." };
    }
    const slug = post.slug.trim();
    if (slugs.has(slug)) {
      return { error: 'Duplicate blog slug "' + slug + '".' };
    }
    slugs.add(slug);
  }

  return { blog: { posts: blog.posts } };
}

async function getGitHubFile() {
  const env = githubEnv();
  if (!env.owner || !env.repo || !env.token) {
    throw new Error(configError());
  }

  const url =
    GITHUB_API +
    "/repos/" +
    env.owner +
    "/" +
    env.repo +
    "/contents/" +
    REPO_FILE +
    "?ref=" +
    encodeURIComponent(env.branch);

  const response = await fetch(url, {
    headers: {
      Authorization: "Bearer " + env.token,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "nilgiribytes-admin",
    },
    cache: "no-store",
  });

  if (response.status === 404) return null;

  if (!response.ok) {
    const text = await response.text();
    throw new Error("GitHub read failed (" + response.status + "): " + text);
  }

  const data = await response.json();
  const raw =
    data && typeof data.content === "string"
      ? Buffer.from(data.content, "base64").toString("utf8")
      : "";

  if (!raw.trim()) {
    return { sha: data ? data.sha || null : null, blog: null };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      REPO_FILE + " is not valid JSON. Repair it in GitHub before continuing."
    );
  }

  if (Array.isArray(parsed)) parsed = { posts: parsed };
  if (!parsed || typeof parsed !== "object") {
    throw new Error(REPO_FILE + " must contain a JSON object.");
  }
  if (!Array.isArray(parsed.posts)) {
    throw new Error(REPO_FILE + " must contain a posts array.");
  }

  return {
    sha: data ? data.sha || null : null,
    blog: { posts: parsed.posts },
  };
}

async function putGitHubFile(sha, blog, message) {
  const env = githubEnv();
  if (!env.owner || !env.repo || !env.token) {
    throw new Error(configError());
  }

  const url =
    GITHUB_API + "/repos/" + env.owner + "/" + env.repo + "/contents/" + REPO_FILE;

  const payload = {
    message,
    content: Buffer.from(JSON.stringify(blog, null, 2)).toString("base64"),
    branch: env.branch,
  };
  if (sha) payload.sha = sha;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: "Bearer " + env.token,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "nilgiribytes-admin",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (response.status === 409) {
    const error = new Error("Another update changed the blog. Please retry.");
    error.code = "CONFLICT";
    throw error;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error("GitHub write failed (" + response.status + "): " + text);
  }

  return response.json();
}

module.exports = async (req, res) => {
  const method = req.method;
  res.setHeader("Cache-Control", "no-store");

  if (method === "GET" || method === "HEAD") {
    let blog = null;
    if (githubConfigured()) {
      try {
        const file = await getGitHubFile();
        blog = file ? file.blog : null;
      } catch (err) {
        console.error("Blog read failed:", err.message);
      }
    }
    if (method === "HEAD") {
      res.status(200).end();
      return;
    }
    res.status(200).json(blog || localBlog());
    return;
  }

  if (method !== "PUT") {
    res.setHeader("Allow", "GET, HEAD, PUT");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!githubConfigured()) {
    res.status(503).json({ error: configError() });
    return;
  }

  const result = validateBlog(req.body);
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }

  try {
    const latest = await getGitHubFile();
    const sha = latest ? latest.sha : null;
    await putGitHubFile(
      sha,
      result.blog,
      "Update blog via /api/blog (admin)"
    );

    res.status(200).json({
      ok: true,
      publishedAt: new Date().toISOString(),
      posts: result.blog.posts.length,
    });
  } catch (err) {
    if (err.code === "CONFLICT") {
      res.status(409).json({ error: err.message, code: "CONFLICT" });
      return;
    }
    console.error("Blog write failed:", err);
    res.status(500).json({ error: err.message });
  }
};
