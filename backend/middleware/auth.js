const { extractBearerToken, getSession } = require('../services/appAuth');

function requireAuth(req, res, next) {
  const token = extractBearerToken(req);
  const session = getSession(token);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.auth = {
    token,
    username: session.username,
    session,
  };

  return next();
}

module.exports = { requireAuth };
