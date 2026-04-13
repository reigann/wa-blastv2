const express = require('express');
const router = express.Router();
const { getStatus, logout } = require('../services/whatsappService');

// GET /api/auth/status
router.get('/status', (req, res) => {
  res.json(getStatus());
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  try {
    await logout();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
