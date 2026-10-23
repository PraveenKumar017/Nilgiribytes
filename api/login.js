const crypto = require("crypto");
const { setSessionCookie } = require("./_auth");

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    res.status(500).json({ error: "Admin credentials not configured" });
    return;
  }

  let body = req.body;
  if (!body || typeof body !== "object") {
    try {
      body = JSON.parse(body || "{}");
    } catch (err) {
      body = {};
    }
  }

  const givenUser = String(body.username || "").trim();
  const givenPass = String(body.password || "").trim();

  if (!safeEqual(givenUser, username) || !safeEqual(givenPass, password)) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  try {
    setSessionCookie(res, givenUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
    return;
  }

  res.status(200).json({ ok: true });
};
