const { getAuthUser } = require("./_auth");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ authenticated: false });
    return;
  }
  res.status(200).json({ authenticated: true, username: user });
};
