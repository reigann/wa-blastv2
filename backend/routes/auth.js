const express = require('express');
const router = express.Router();
const passport = require('passport');
const { ensureWhatsAppClient, getStatus, logout: waLogout } = require('../services/whatsappService');
const { requireAuth } = require('../middleware/auth');
const {
  signInWithFirebaseIdToken,
  invalidateSession,
  extractBearerToken,
  getSessionWithUser,
  getAllAllowedEmails,
  addEmailToAllowlist,
  removeEmailFromAllowlist,
} = require('../services/googleAuthService');

function isGoogleStrategyReady() {
  return !!passport._strategy('google');
}

function ensureGoogleStrategy(req, res, next) {
  if (!isGoogleStrategyReady()) {
    return res.status(503).json({
      error: 'Google OAuth redirect is not configured on backend',
      details: 'Use Firebase login flow from frontend or set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET for passport strategy.',
    });
  }
  return next();
}

router.post('/firebase', async (req, res) => {
  try {
    const { idToken } = req.body || {};
    const authData = await signInWithFirebaseIdToken(idToken);
    return res.json({
      success: true,
      token: authData.sessionData.token,
      user: authData.user,
      expiresAt: authData.sessionData.expiresAt,
    });
  } catch (error) {
    console.error('Firebase auth error:', error);
    return res.status(401).json({ error: error.message || 'Firebase authentication failed' });
  }
});

router.get('/google', ensureGoogleStrategy, passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', ensureGoogleStrategy, (req, res, next) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  passport.authenticate('google', { session: false }, (err, authData) => {
    if (err) return res.redirect(`${frontendUrl}/?error=${encodeURIComponent(err.message)}`);
    if (!authData) return res.redirect(`${frontendUrl}/?error=authentication_failed`);
    return res.redirect(`${frontendUrl}/?token=${authData.sessionData.token}&user=${encodeURIComponent(JSON.stringify(authData.user))}`);
  })(req, res, next);
});

router.get('/me', requireAuth, (req, res) => {
  try {
    ensureWhatsAppClient(req.auth.email).catch(() => {});
    return res.json({ authenticated: true, user: req.auth.user, wa: getStatus(req.auth.email) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/status', requireAuth, (req, res) => {
  try {
    ensureWhatsAppClient(req.auth.email).catch(() => {});
    res.json(getStatus(req.auth.email));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/logout', requireAuth, async (req, res) => {
  try {
    await waLogout(req.auth.email);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/logout-app', requireAuth, async (req, res) => {
  try {
    await invalidateSession(req.auth.token);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/logout-app-token', async (req, res) => {
  try {
    const token = extractBearerToken(req) || req.body?.token;
    const session = await getSessionWithUser(token);
    if (session) await invalidateSession(token);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/allowlist', requireAuth, async (req, res) => {
  try {
    const allowedEmails = await getAllAllowedEmails();
    res.json(allowedEmails);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/allowlist/add', requireAuth, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Invalid email' });

    const result = await addEmailToAllowlist(email, req.auth.email);
    if (!result) return res.status(409).json({ error: 'Email already in allowlist' });

    res.json({ success: true, email });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/allowlist/remove', requireAuth, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    await removeEmailFromAllowlist(email);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
