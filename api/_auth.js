const crypto = require("crypto");

const SESSION_COOKIE = "nilgiri_admin_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("AUTH_SECRET environment variable is not set");
  return secret;
}

function b64urlEncode(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(str) {
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function hmac(data) {
  return crypto.createHmac("sha256", getAuthSecret()).update(data).digest();
}

function createToken(username) {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = b64urlEncode(
    Buffer.from(JSON.stringify({ u: username, exp }))
  );
  const sig = b64urlEncode(hmac(payload));
  return payload + "." + sig;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const payload = parts[0];
  const sig = parts[1];
  try {
    const expected = b64urlEncode(hmac(payload));
    const provided = Buffer.from(sig, "utf8");
    const wanted = Buffer.from(expected, "utf8");
    if (
      provided.length !== wanted.length ||
      !crypto.timingSafeEqual(provided, wanted)
    ) {
      return null;
    }
    const data = JSON.parse(b64urlDecode(payload).toString("utf8"));
    if (!data || !data.exp || Date.now() > data.exp) return null;
    return data;
  } catch (err) {
    return null;
  }
}

function getTokenFromRequest(req) {
  const header = req.headers.cookie || "";
  const match = header.match(
    new RegExp("(?:^|;\\s*)" + SESSION_COOKIE + "=([^;]+)")
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function getAuthUser(req) {
  const payload = verifyToken(getTokenFromRequest(req));
  return payload ? payload.u : null;
}

function setSessionCookie(res, username) {
  const token = createToken(username);
  const cookie =
    SESSION_COOKIE +
    "=" +
    encodeURIComponent(token) +
    "; HttpOnly; SameSite=Lax; Path=/; Max-Age=" +
    Math.floor(SESSION_TTL_MS / 1000);
  res.setHeader("Set-Cookie", cookie);
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    SESSION_COOKIE + "=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
  );
}

module.exports = {
  SESSION_COOKIE,
  getAuthUser,
  setSessionCookie,
  clearSessionCookie,
  createToken,
  verifyToken,
};
