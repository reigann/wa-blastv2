const express = require('express');
const router = express.Router();
const bandit = require('../services/banditService');

// POST /api/bandit/create
router.post('/create', async (req, res) => {
  try {
    const { name, arms = 2, features = [], alpha, lambda } = req.body;
    if (!Array.isArray(features)) return res.status(400).json({ error: 'features must be an array' });
    const policy = await bandit.createPolicy(name || 'policy', Number(arms) || 2, features, alpha, lambda);
    res.json({ success: true, policy });
  } catch (err) {
    console.error('Bandit create error', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bandit/recommend
router.post('/recommend', async (req, res) => {
  try {
    const { policy_id, context = {}, session_id = null, phone = null } = req.body;
    if (!policy_id) return res.status(400).json({ error: 'policy_id required' });
    const out = await bandit.recommend(policy_id, context, session_id, phone);
    res.json({ success: true, ...out });
  } catch (err) {
    console.error('Bandit recommend error', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bandit/feedback
router.post('/feedback', async (req, res) => {
  try {
    const { event_id, reward = 0 } = req.body;
    if (!event_id) return res.status(400).json({ error: 'event_id required' });
    const out = await bandit.feedback(event_id, reward);
    res.json({ success: true, ...out });
  } catch (err) {
    console.error('Bandit feedback error', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bandit/policies
router.get('/policies', (req, res) => {
  try {
    const policies = bandit.listPolicies();
    res.json({ success: true, policies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bandit/events
router.get('/events', (req, res) => {
  try {
    const { policy_id, limit } = req.query;
    const events = bandit.listEvents(Number(limit) || 200, policy_id ? Number(policy_id) : null);
    res.json({ success: true, events });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
