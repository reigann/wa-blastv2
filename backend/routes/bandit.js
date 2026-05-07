const express = require('express');
const router = express.Router();
const bandit = require('../services/banditService');
const STORAGE_PROVIDER = (process.env.STORAGE_PROVIDER || 'firebase').toLowerCase();

router.use((req, res, next) => {
  if (STORAGE_PROVIDER !== 'firebase') {
    return res.status(503).json({
      error: 'Bandit route is configured for Firebase storage mode only.',
    });
  }
  return next();
});

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
router.get('/policies', async (req, res) => {
  try {
    const policies = await bandit.listPolicies();
    res.json({ success: true, policies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bandit/events
router.get('/events', async (req, res) => {
  try {
    const { policy_id, limit } = req.query;
    const events = await bandit.listEvents(Number(limit) || 200, policy_id ? Number(policy_id) : null);
    res.json({ success: true, events });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bandit/update-delivery-status
// Automatically calculate and apply reward based on delivery status
router.post('/update-delivery-status', async (req, res) => {
  try {
    const { event_id, delivery_status, read_status = 0, reply_received = 0 } = req.body;
    if (!event_id) return res.status(400).json({ error: 'event_id required' });
    if (!delivery_status) return res.status(400).json({ error: 'delivery_status required' });
    
    const result = await bandit.updateEventDeliveryStatus(event_id, delivery_status, read_status, reply_received);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Update delivery status error', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bandit/analytics/:policy_id
// Get arm performance analytics (comparison across arms)
router.get('/analytics/:policy_id', async (req, res) => {
  try {
    const { policy_id } = req.params;
    const analytics = await bandit.getArmAnalytics(Number(policy_id));
    res.json({ success: true, analytics });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bandit/define-arms
// Define what each arm represents (for clarity)
router.post('/define-arms', async (req, res) => {
  try {
    const { policy_id, arm_definitions } = req.body;
    if (!policy_id) return res.status(400).json({ error: 'policy_id required' });
    if (!Array.isArray(arm_definitions)) return res.status(400).json({ error: 'arm_definitions must be array' });
    
    const result = await bandit.defineArms(policy_id, arm_definitions);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Define arms error', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bandit/arm-definitions/:policy_id
// Get arm definitions (meaning of each arm)
router.get('/arm-definitions/:policy_id', async (req, res) => {
  try {
    const { policy_id } = req.params;
    const definitions = await bandit.getArmDefinitions(Number(policy_id));
    res.json({ success: true, definitions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bandit/events/:policy_id
// Get raw events for debugging
router.get('/events/:policy_id', async (req, res) => {
  try {
    const { policy_id } = req.params;
    const events = await bandit.listEvents(200, Number(policy_id));
    res.json({ success: true, total: events.length, events });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bandit/debug/:policy_id
// Get detailed debug info
router.get('/debug/:policy_id', async (req, res) => {
  try {
    const { policy_id } = req.params;

    const policy = await bandit.getPolicyRow(Number(policy_id));
    if (!policy) return res.status(404).json({ error: 'Policy not found' });

    const events = await bandit.listEvents(1000, Number(policy_id));

    const statusCounts = {
      total: events.length,
      pending: events.filter((e) => !e.delivery_status).length,
      sent: events.filter((e) => e.delivery_status === 'sent').length,
      delivered: events.filter((e) => e.delivery_status === 'delivered').length,
      failed: events.filter((e) => e.delivery_status === 'failed').length,
      with_reward: events.filter((e) => e.reward !== null && e.reward !== undefined).length,
      read: events.filter((e) => Number(e.read_status) === 1).length,
      replied: events.filter((e) => Number(e.reply_received) === 1).length,
    };

    res.json({
      success: true,
      policy: { id: policy.id, name: policy.name, arms: policy.arms },
      statusCounts,
      events: events.slice(0, 50),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bandit/test/simulate-read
// Test endpoint - manually mark event as read
router.post('/test/simulate-read', async (req, res) => {
  try {
    const { event_id } = req.body;
    if (!event_id) return res.status(400).json({ error: 'event_id required' });

    // Simulate read
    const result = await bandit.updateEventDeliveryStatus(event_id, 'delivered', 1, 0);

    res.json({
      success: true,
      message: 'Event marked as read',
      result,
    });
  } catch (err) {
    console.error('Test simulate-read error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bandit/test/simulate-reply
// Test endpoint - manually mark event as replied
router.post('/test/simulate-reply', async (req, res) => {
  try {
    const { event_id } = req.body;
    if (!event_id) return res.status(400).json({ error: 'event_id required' });

    // Simulate reply
    const result = await bandit.updateEventDeliveryStatus(event_id, 'delivered', 0, 1);

    res.json({
      success: true,
      message: 'Event marked as replied',
      result,
    });
  } catch (err) {
    console.error('Test simulate-reply error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
