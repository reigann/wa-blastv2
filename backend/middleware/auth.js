const { extractBearerToken, getSessionWithUser } = require('../services/googleAuthService');

async function requireAuth(req, res, next) {
  const token = extractBearerToken(req);
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized - Missing token' });
  }

  try {
    const session = await getSessionWithUser(token);

    if (!session) {
      return res.status(401).json({ error: 'Unauthorized - Invalid or expired token' });
    }

    if (!session.user.is_allowed) {
      return res.status(403).json({ error: 'Forbidden - User not allowed' });
    }

    req.auth = {
      token,
      userId: session.userId,
      user: session.user,
      email: session.user.email,
      name: session.user.name,
    };

    return next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = { requireAuth };

