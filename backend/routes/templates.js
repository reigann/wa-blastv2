const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { admin, getFirestore } = require('../services/firebaseAdmin');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'uploads', 'templates');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 16 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|pdf|doc|docx|xls|xlsx|ppt|pptx|txt)$/i;
    if (!allowed.test(file.originalname)) return cb(new Error('Invalid file format'));
    cb(null, true);
  },
});

function toPublicMediaPath(absolutePath) {
  return `/uploads/templates/${path.basename(absolutePath)}`;
}

function resolvePublicPath(mediaPath) {
  if (!mediaPath) return null;
  return path.join(__dirname, '..', mediaPath.replace(/^\//, ''));
}

function safeDeleteMedia(mediaPath) {
  try {
    const absolutePath = resolvePublicPath(mediaPath);
    if (absolutePath && fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
  } catch (_) {}
}

router.get('/', async (req, res) => {
  try {
    const db = getFirestore();
    const snap = await db.collection('templates').get();
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    rows.sort((a, b) => {
      const ta = a.created_at?.toMillis ? a.created_at.toMillis() : 0;
      const tb = b.created_at?.toMillis ? b.created_at.toMillis() : 0;
      return tb - ta;
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', upload.single('attachment'), async (req, res) => {
  const { name, content, category, link } = req.body;
  if (!name || !content) return res.status(400).json({ error: 'Name and content required' });

  try {
    const mediaPath = req.file ? toPublicMediaPath(req.file.path) : null;
    const mediaType = req.file ? req.file.mimetype : null;
    const mediaName = req.file ? req.file.originalname : null;

    const now = admin.firestore.Timestamp.now();
    const db = getFirestore();
    const ref = await db.collection('templates').add({
      name,
      content,
      category: category || 'General',
      link: link || null,
      media_path: mediaPath,
      media_type: mediaType,
      media_name: mediaName,
      created_at: now,
      updated_at: now,
    });

    res.json({ success: true, id: ref.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', upload.single('attachment'), async (req, res) => {
  const { name, content, category, link, remove_media } = req.body;

  try {
    const db = getFirestore();
    const ref = db.collection('templates').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Template not found' });

    const existing = doc.data();
    const shouldRemove = remove_media === 'true';
    let mediaPath = existing.media_path || null;
    let mediaType = existing.media_type || null;
    let mediaName = existing.media_name || null;

    if (req.file) {
      if (existing.media_path) safeDeleteMedia(existing.media_path);
      mediaPath = toPublicMediaPath(req.file.path);
      mediaType = req.file.mimetype;
      mediaName = req.file.originalname;
    } else if (shouldRemove) {
      if (existing.media_path) safeDeleteMedia(existing.media_path);
      mediaPath = null;
      mediaType = null;
      mediaName = null;
    }

    await ref.update({
      name: name || existing.name,
      content: content || existing.content,
      category: category || existing.category || 'General',
      link: link !== undefined ? link : (existing.link || null),
      media_path: mediaPath,
      media_type: mediaType,
      media_name: mediaName,
      updated_at: admin.firestore.Timestamp.now(),
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const db = getFirestore();
    const ref = db.collection('templates').doc(req.params.id);
    const doc = await ref.get();
    if (doc.exists && doc.data()?.media_path) safeDeleteMedia(doc.data().media_path);

    await ref.delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
