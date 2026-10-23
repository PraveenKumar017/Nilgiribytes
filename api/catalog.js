const { getAuthUser } = require("./_auth");
const LOCAL_CATALOG = require("../data/catalog.json");

const REPO_FILE = "data/catalog.json";
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

function localCatalog() {
  return {
    products: LOCAL_CATALOG.products || [],
    combos: LOCAL_CATALOG.combos || [],
  };
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

function validateCatalog(body) {
  const catalog = readBody(body);
  if (!catalog || typeof catalog !== "object") {
    return { error: "A JSON catalog body is required." };
  }
  if (!Array.isArray(catalog.products) || !Array.isArray(catalog.combos)) {
    return { error: "Catalog must contain products and combos arrays." };
  }

  const ids = new Set();
  for (const item of catalog.products.concat(catalog.combos)) {
    if (!item || typeof item !== "object") {
      return { error: "Every catalog item must be an object." };
    }
    if (typeof item.id !== "string" || !item.id.trim()) {
      return { error: "Every catalog item needs a non-empty string id." };
    }
    if (typeof item.name !== "string" || !item.name.trim()) {
      return { error: "Every catalog item needs a non-empty name." };
    }
    const id = item.id.trim();
    if (ids.has(id)) {
      return { error: 'Duplicate item id "' + id + '".' };
    }
    ids.add(id);
  }

  return {
    catalog: {
      products: catalog.products,
      combos: catalog.combos,
    },
  };
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
    return { sha: data ? data.sha || null : null, catalog: null };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      REPO_FILE + " is not valid JSON. Repair it in GitHub before continuing."
    );
  }

  if (Array.isArray(parsed)) parsed = { products: parsed, combos: [] };
  if (!parsed || typeof parsed !== "object") {
    throw new Error(REPO_FILE + " must contain a JSON object.");
  }
  if (!Array.isArray(parsed.products) || !Array.isArray(parsed.combos)) {
    throw new Error(REPO_FILE + " must contain products and combos arrays.");
  }

  return {
    sha: data ? data.sha || null : null,
    catalog: {
      products: parsed.products,
      combos: parsed.combos,
    },
  };
}

async function putGitHubFile(sha, catalog, message) {
  const env = githubEnv();
  if (!env.owner || !env.repo || !env.token) {
    throw new Error(configError());
  }

  const url =
    GITHUB_API + "/repos/" + env.owner + "/" + env.repo + "/contents/" + REPO_FILE;

  const payload = {
    message,
    content: Buffer.from(JSON.stringify(catalog, null, 2)).toString("base64"),
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
    const error = new Error(
      "Another update changed the catalog. Please retry."
    );
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
    let catalog = null;
    if (githubConfigured()) {
      try {
        const file = await getGitHubFile();
        catalog = file ? file.catalog : null;
      } catch (err) {
        console.error("Catalog read failed:", err.message);
      }
    }
    if (method === "HEAD") {
      res.status(200).end();
      return;
    }
    res.status(200).json(catalog || localCatalog());
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

  const result = validateCatalog(req.body);
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }

  try {
    const latest = await getGitHubFile();
    const sha = latest ? latest.sha : null;
    await putGitHubFile(
      sha,
      result.catalog,
      "Update catalog via /api/catalog (admin)"
    );

    res.status(200).json({
      ok: true,
      publishedAt: new Date().toISOString(),
      products: result.catalog.products.length,
      combos: result.catalog.combos.length,
    });
  } catch (err) {
    if (err.code === "CONFLICT") {
      res.status(409).json({ error: err.message, code: "CONFLICT" });
      return;
    }
    console.error("Catalog write failed:", err);
    res.status(500).json({ error: err.message });
  }
};
