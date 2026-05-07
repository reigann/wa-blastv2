const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const { admin, getFirestore } = require('../services/firebaseAdmin');
const { startBlast, cancelBlast, getActiveBlast, scheduleSession } = require('../services/blastService');

const STORAGE_PROVIDER = (process.env.STORAGE_PROVIDER || 'firebase').toLowerCase();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/media/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});

const upload = multer({
  storage,
  limits: { fileSize: 16 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|mp4|3gp|pdf|docx|xlsx|mp3|ogg|wav)$/i;
    if (allowed.test(file.originalname)) cb(null, true);
    else cb(new Error('Invalid file format'));
  },
});

async function getContactsForBlast(contactIds, groupName) {
  if (STORAGE_PROVIDER !== 'firebase') {
    if (contactIds && contactIds.length > 0) {
      const placeholders = contactIds.map(() => '?').join(',');
      return db.all(`SELECT * FROM contacts WHERE id IN (${placeholders})`, contactIds);
    }
    return db.all('SELECT * FROM contacts WHERE group_name=?', [groupName]);
  }

  const firestore = getFirestore();
  if (contactIds && contactIds.length > 0) {
    const docs = await Promise.all(contactIds.map((id) => firestore.collection('contacts').doc(String(id)).get()));
    return docs.filter((d) => d.exists).map((d) => ({ id: d.id, ...d.data() }));
  }

  const snap = await firestore.collection('contacts').where('group_name', '==', groupName).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

router.get('/sessions', async (req, res) => {
  try {
    if (STORAGE_PROVIDER === 'firebase') {
      const firestore = getFirestore();
      const snap = await firestore.collection('blast_sessions').get();
      const sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      sessions.sort((a, b) => {
        const ta = a.created_at?.toMillis ? a.created_at.toMillis() : 0;
        const tb = b.created_at?.toMillis ? b.created_at.toMillis() : 0;
        return tb - ta;
      });
      return res.json(sessions);
    }

    const sessions = await db.all('SELECT * FROM blast_sessions ORDER BY created_at DESC');
    return res.json(sessions);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/sessions/:id/logs', async (req, res) => {
  try {
    if (STORAGE_PROVIDER === 'firebase') {
      const firestore = getFirestore();
      const snap = await firestore.collection('blast_logs').where('session_id', '==', String(req.params.id)).get();
      const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      logs.sort((a, b) => {
        const ta = a.sent_at?.toMillis ? a.sent_at.toMillis() : 0;
        const tb = b.sent_at?.toMillis ? b.sent_at.toMillis() : 0;
        return tb - ta;
      });
      return res.json(logs);
    }

    const logs = await db.all('SELECT * FROM blast_logs WHERE session_id=? ORDER BY sent_at DESC', [req.params.id]);
    return res.json(logs);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/start', upload.single('media'), async (req, res) => {
  const username = req.auth?.email || 'default';
  const { name, message, contact_ids, group_name, delay_min, delay_max, template_media_path, policy_id, schedule_at, link } = req.body;

  let scheduledAt = null;
  if (schedule_at) {
    const parsed = new Date(schedule_at);
    scheduledAt = Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  let mediaPath = req.file ? path.resolve(req.file.path) : null;
  if (!mediaPath && template_media_path) {
    const resolved = path.resolve(path.join(__dirname, '..', String(template_media_path).replace(/^\/+/, '')));
    if (fs.existsSync(resolved)) mediaPath = resolved;
  }

  if (!message) return res.status(400).json({ error: 'Message is required' });
  if (!contact_ids && !group_name) return res.status(400).json({ error: 'Provide contact_ids or group_name' });

  try {
    const ids = Array.isArray(contact_ids) ? contact_ids : (typeof contact_ids === 'string' ? [contact_ids] : []);
    const contacts = await getContactsForBlast(ids, group_name);

    if (!contacts.length) return res.status(400).json({ error: 'No contacts found' });
    if (contacts.length > 20) return res.status(400).json({ error: 'Maksimal 20 kontak per blast' });

    const status = scheduledAt ? 'scheduled' : 'pending';
    const sessionName = name || `Blast ${new Date().toLocaleString()}`;

    let sessionId;
    if (STORAGE_PROVIDER === 'firebase') {
      const firestore = getFirestore();
      const now = admin.firestore.Timestamp.now();
      const ref = await firestore.collection('blast_sessions').add({
        name: sessionName,
        message,
        total: contacts.length,
        sent: 0,
        failed: 0,
        status,
        scheduled_at: scheduledAt ? admin.firestore.Timestamp.fromDate(new Date(scheduledAt)) : null,
        created_at: now,
      });
      sessionId = ref.id;
    } else {
      const session = await db.run(
        `INSERT INTO blast_sessions (name, message, total, status, scheduled_at) VALUES (?, ?, ?, ?, ?)`,
        [sessionName, message, contacts.length, status, scheduledAt || null]
      );
      sessionId = session.lastID;
    }

    const payloadObj = { contact_ids: ids || null, group_name: group_name || null, delay_min, delay_max, mediaPath, username, policy_id, link };

    if (scheduledAt) {
      if (STORAGE_PROVIDER !== 'firebase') {
        await db.run('REPLACE INTO blast_queue (session_id, payload) VALUES (?, ?)', [sessionId, JSON.stringify(payloadObj)]);
      }
      scheduleSession(sessionId, payloadObj, scheduledAt);
      return res.json({ success: true, scheduled: true, sessionId, total: contacts.length });
    }

    if (getActiveBlast(username)) {
      return res.json({ success: true, queued: true, sessionId, total: contacts.length });
    }

    startBlast(sessionId, contacts, message, delay_min, delay_max, mediaPath, username, policy_id, link).catch(console.error);
    return res.json({ success: true, sessionId, total: contacts.length, hasMedia: !!mediaPath });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/cancel', (req, res) => {
  const username = req.auth?.email || 'default';
  const cancelled = cancelBlast(username);
  res.json({ success: cancelled, message: cancelled ? 'Blast cancelled' : 'No active blast' });
});

router.get('/active', (req, res) => {
  const username = req.auth?.email || 'default';
  res.json({ active: getActiveBlast(username) !== null });
});

router.delete('/sessions/:id', async (req, res) => {
  try {
    if (STORAGE_PROVIDER === 'firebase') {
      const firestore = getFirestore();
      await firestore.collection('blast_sessions').doc(String(req.params.id)).delete();
      return res.json({ success: true });
    }

    await db.run('DELETE FROM blast_logs WHERE session_id=?', [req.params.id]);
    await db.run('DELETE FROM blast_sessions WHERE id=?', [req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/interactions', async (req, res) => {
  if (STORAGE_PROVIDER === 'firebase') {
    return res.json({ count: 0, interactions: [] });
  }

  try {
    const { phone, session_id, limit } = req.query;
    let query = 'SELECT * FROM blast_interactions';
    const params = [];
    const where = [];

    if (phone) {
      where.push('phone LIKE ?');
      params.push(`%${phone}%`);
    }
    if (session_id) {
      where.push('session_id = ?');
      params.push(Number(session_id));
    }
    if (where.length) query += ' WHERE ' + where.join(' AND ');
    query += ' ORDER BY created_at DESC';
    if (limit) query += ' LIMIT ' + Math.min(1000, Number(limit));

    const rows = await db.all(query, params);
    return res.json({ count: rows.length, interactions: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
