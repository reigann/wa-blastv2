const express = require('express');
const router = express.Router();
const { ensureWhatsAppClient, getStatus, logout: waLogout } = require('../services/whatsappService');
const { requireAuth } = require('../middleware/auth');
const {
  createSession,
  extractBearerToken,
  getAllowedUsers,
  getSession,
  invalidateSession,
  validateCredentials,
} = require('../services/appAuth');

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (!getAllowedUsers().length) {
    return res.status(500).json({
      error: 'No auth users configured in env. Set APP_USERS or AUTH_USER_1..AUTH_PASS_8',
    });
  }

  if (!validateCredentials(String(username), String(password))) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const session = createSession(String(username));
  ensureWhatsAppClient(String(username)).catch(() => {});
  return res.json({
    success: true,
    token: session.token,
    expiresAt: session.expiresAt,
    user: { username: String(username) },
  });
});

router.get('/me', requireAuth, (req, res) => {
  ensureWhatsAppClient(req.auth.username).catch(() => {});
  return res.json({
    authenticated: true,
    user: { username: req.auth.username },
    wa: getStatus(req.auth.username),
  });
});

// GET /api/auth/status
router.get('/status', requireAuth, (req, res) => {
  ensureWhatsAppClient(req.auth.username).catch(() => {});
  res.json(getStatus(req.auth.username));
});

// POST /api/auth/logout (disconnect WhatsApp session)
router.post('/logout', requireAuth, async (req, res) => {
  try {
    await waLogout(req.auth.username);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout-app (invalidate app login token)
router.post('/logout-app', requireAuth, (req, res) => {
  invalidateSession(req.auth.token);
  res.json({ success: true });
});

// Optional safe fallback for clients that only have token string
router.post('/logout-app-token', (req, res) => {
  const token = extractBearerToken(req) || req.body?.token;
  const session = getSession(token);
  if (session) {
    invalidateSession(token);
  }
  res.json({ success: true });
});

module.exports = router;
