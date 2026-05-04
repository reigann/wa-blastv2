const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const { startBlast, cancelBlast, getActiveBlast, scheduleSession } = require('../services/blastService');

// Setup multer untuk upload media
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/media/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 16 * 1024 * 1024 }, // max 16MB
  fileFilter: (req, file, cb) => {
    // Allow common media formats
    const allowed = /\.(jpg|jpeg|png|gif|webp|mp4|3gp|pdf|docx|xlsx|mp3|ogg|wav)$/i;
    if (allowed.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format'));
    }
  }
});

// GET /api/blast/sessions
router.get('/sessions', (req, res) => {
  const sessions = db.prepare('SELECT * FROM blast_sessions ORDER BY created_at DESC').all();
  res.json(sessions);
});

// GET /api/blast/sessions/:id/logs
router.get('/sessions/:id/logs', (req, res) => {
  const logs = db.prepare('SELECT * FROM blast_logs WHERE session_id=? ORDER BY sent_at DESC').all(req.params.id);
  res.json(logs);
});

// POST /api/blast/start
router.post('/start', upload.single('media'), async (req, res) => {
  const username = req.auth?.username || 'default';
  const { name, message, contact_ids, group_name, delay_min, delay_max, template_media_path, bandit_policy_id, schedule_at } = req.body;
  // Normalize schedule_at to an ISO UTC string when provided (frontend sends local datetime-local)
  let scheduledAt = null;
  if (schedule_at) {
    const parsed = new Date(schedule_at);
    scheduledAt = isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  let mediaPath = req.file ? path.resolve(req.file.path) : null;

  if (!mediaPath && template_media_path) {
    const normalizedPath = String(template_media_path).replace(/^\/+/, '');
    const resolvedTemplateMedia = path.resolve(path.join(__dirname, '..', normalizedPath));
    if (fs.existsSync(resolvedTemplateMedia)) {
      mediaPath = resolvedTemplateMedia;
    }
  }

  if (!message) return res.status(400).json({ error: 'Message is required' });
  if (!contact_ids && !group_name) return res.status(400).json({ error: 'Provide contact_ids or group_name' });

  // Fetch contacts to know total
  let contacts;
  if (contact_ids && contact_ids.length > 0) {
    const placeholders = contact_ids.map(() => '?').join(',');
    contacts = db.prepare(`SELECT * FROM contacts WHERE id IN (${placeholders})`).all(...contact_ids);
  } else {
    contacts = db.prepare('SELECT * FROM contacts WHERE group_name=?').all(group_name);
  }

  if (contacts.length === 0) {
    return res.status(400).json({ error: 'No contacts found' });
  }

  // Enforce maximum contacts per single blast to keep accounts safe
  if (contacts.length > 20) {
    return res.status(400).json({ error: 'Maksimal 20 kontak per blast' });
  }

  // Create blast session with scheduled_at if provided (stored as ISO UTC)
  const status = scheduledAt ? 'scheduled' : 'pending';
  const session = db.prepare(`
    INSERT INTO blast_sessions (name, message, total, status, scheduled_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(name || `Blast ${new Date().toLocaleString()}`, message, contacts.length, status, scheduledAt || null);

  const sessionId = session.lastInsertRowid;

  const payloadObj = { contact_ids: contact_ids || null, group_name: group_name || null, delay_min, delay_max, mediaPath, username, bandit_policy_id };

  // If scheduled in the future, persist payload and schedule it, then return
  if (scheduledAt) {
    try {
      // persist payload so scheduled session survives restarts
      db.prepare(`INSERT OR REPLACE INTO blast_queue (session_id, payload) VALUES (?, ?)`).run(sessionId, JSON.stringify(payloadObj));
      scheduleSession(sessionId, payloadObj, scheduledAt);
      return res.json({ success: true, scheduled: true, sessionId, total: contacts.length });
    } catch (err) {
      console.error('Failed to schedule session:', err?.message || err);
      return res.status(500).json({ error: 'Failed to schedule session' });
    }
  }

  // If there's an active blast, queue the session
  if (getActiveBlast(username)) {
    const payload = JSON.stringify(payloadObj);
    db.prepare(`INSERT OR REPLACE INTO blast_queue (session_id, payload) VALUES (?, ?)`).run(sessionId, payload);
    db.prepare(`UPDATE blast_sessions SET status='queued' WHERE id=?`).run(sessionId);
    return res.json({ success: true, queued: true, sessionId, total: contacts.length });
  }

  // Start blast asynchronously (immediate)
  startBlast(sessionId, contacts, message, delay_min, delay_max, mediaPath, username, bandit_policy_id).catch(console.error);

  res.json({ success: true, sessionId, total: contacts.length, hasMedia: !!mediaPath });
});

// POST /api/blast/cancel
router.post('/cancel', (req, res) => {
  const username = req.auth?.username || 'default';
  const cancelled = cancelBlast(username);
  res.json({ success: cancelled, message: cancelled ? 'Blast cancelled' : 'No active blast' });
});

// GET /api/blast/active
router.get('/active', (req, res) => {
  const username = req.auth?.username || 'default';
  res.json({ active: getActiveBlast(username) !== null });
});

// DELETE /api/blast/sessions/:id
router.delete('/sessions/:id', (req, res) => {
  db.prepare('DELETE FROM blast_logs WHERE session_id=?').run(req.params.id);
  db.prepare('DELETE FROM blast_sessions WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// GET /api/blast/interactions
router.get('/interactions', (req, res) => {
  try {
    const { phone, session_id, limit } = req.query;
    let query = 'SELECT * FROM blast_interactions';
    const params = [];
    const where = [];
    if (phone) { where.push('phone LIKE ?'); params.push(`%${phone}%`); }
    if (session_id) { where.push('session_id = ?'); params.push(Number(session_id)); }
    if (where.length) query += ' WHERE ' + where.join(' AND ');
    query += ' ORDER BY created_at DESC';
    if (limit) query += ' LIMIT ' + Math.min(1000, Number(limit));

    const rows = db.prepare(query).all(...params);
    res.json({ count: rows.length, interactions: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
