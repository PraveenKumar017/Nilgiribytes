const { getAuthUser } = require("./_auth");

const REPO_FILE_BASE = "assets/images/blog/";
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

function readBody(body) {
  if (!body) return null;
  if (typeof body === "string") {
    try { return JSON.parse(body); } catch (err) { return null; }
  }
  return body;
}

function sanitizeExt(contentType) {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return null;
}

function randomId() {
  return Math.random().toString(36).substr(2, 9);
}

module.exports = async (req, res) => {
  const method = req.method;
  res.setHeader("Cache-Control", "no-store");

  if (method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!githubConfigured()) { res.status(503).json({ error: configError() }); return; }

  const body = readBody(req.body) || {};
  const data = body.data;
  const contentType = body.contentType;
  const filename = body.filename || "image";

  if (typeof data !== "string" || !data) { res.status(400).json({ error: "Image data required." }); return; }
  const ext = sanitizeExt(contentType);
  if (!ext) { res.status(400).json({ error: "Only JPG, PNG or WebP allowed." }); return; }

  let buffer;
  try { buffer = Buffer.from(data, "base64"); } catch (err) { res.status(400).json({ error: "Invalid image data." }); return; }
  if (buffer.length < 10) { res.status(400).json({ error: "Invalid image." }); return; }
  if (buffer.length > 5 * 1024 * 1024) { res.status(400).json({ error: "Image too large." }); return; }

  const env = githubEnv();
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const name = filename.replace(/[^a-zA-Z0-9.-]/g, "-").replace(/-+/g, "-").toLowerCase();
  const base = name.replace(/\.[^.]+$/, "");
  const path = REPO_FILE_BASE + date + "-" + base + "-" + randomId() + "." + ext;

  const url = GITHUB_API + "/repos/" + env.owner + "/" + env.repo + "/contents/" + path;
  const payload = { message: "Upload blog image via /api/blog-image (admin)", content: buffer.toString("base64"), branch: env.branch };

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: { Authorization: "Bearer " + env.token, Accept: "application/vnd.github.v3+json", "User-Agent": "nilgiribytes-admin", "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error("GitHub upload failed (" + response.status + "): " + text);
    }
    res.status(200).json({ ok: true, path: path });
  } catch (err) {
    console.error("Blog image upload failed:", err);
    res.status(500).json({ error: err.message });
  }
};
