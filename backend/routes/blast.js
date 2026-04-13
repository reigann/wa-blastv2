const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../db/database');
const { startBlast, cancelBlast, getActiveBlast } = require('../services/blastService');

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
  const { name, message, contact_ids, group_name, delay_min, delay_max } = req.body;
  const mediaPath = req.file ? path.resolve(req.file.path) : null;

  if (!message) return res.status(400).json({ error: 'Message is required' });
  if (!contact_ids && !group_name) return res.status(400).json({ error: 'Provide contact_ids or group_name' });

  if (getActiveBlast()) {
    return res.status(400).json({ error: 'A blast is already running' });
  }

  // Fetch contacts
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

  // Create blast session
  const session = db.prepare(`
    INSERT INTO blast_sessions (name, message, total, status)
    VALUES (?, ?, ?, 'pending')
  `).run(name || `Blast ${new Date().toLocaleString()}`, message, contacts.length);

  const sessionId = session.lastInsertRowid;

  // Start blast asynchronously (dengan media path jika ada)
  startBlast(sessionId, contacts, message, delay_min, delay_max, mediaPath).catch(console.error);

  res.json({ success: true, sessionId, total: contacts.length, hasMedia: !!mediaPath });
});

// POST /api/blast/cancel
router.post('/cancel', (req, res) => {
  const cancelled = cancelBlast();
  res.json({ success: cancelled, message: cancelled ? 'Blast cancelled' : 'No active blast' });
});

// GET /api/blast/active
router.get('/active', (req, res) => {
  res.json({ active: getActiveBlast() !== null });
});

// DELETE /api/blast/sessions/:id
router.delete('/sessions/:id', (req, res) => {
  db.prepare('DELETE FROM blast_logs WHERE session_id=?').run(req.params.id);
  db.prepare('DELETE FROM blast_sessions WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
