const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const db = require('../db/database');

const uploadDir = path.join(__dirname, '..', 'uploads', 'templates');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 16 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|pdf|doc|docx|xls|xlsx|ppt|pptx|txt)$/i;
    if (!allowed.test(file.originalname)) {
      cb(new Error('Invalid file format'));
      return;
    }
    cb(null, true);
  },
});

function toPublicMediaPath(absolutePath) {
  const fileName = path.basename(absolutePath);
  return `/uploads/templates/${fileName}`;
}

function resolvePublicPath(mediaPath) {
  if (!mediaPath) return null;
  const normalized = mediaPath.replace(/^\//, '');
  return path.join(__dirname, '..', normalized);
}

function safeDeleteMedia(mediaPath) {
  try {
    const absolutePath = resolvePublicPath(mediaPath);
    if (absolutePath && fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch (error) {
    // ignore file cleanup errors
  }
}

function getTemplateColumnNames() {
  return db.prepare('PRAGMA table_info(templates)').all().map((column) => column.name);
}

router.get('/', (req, res) => {
  const columns = getTemplateColumnNames();
  const selectColumns = ['id', 'name', 'content', 'created_at'];

  if (columns.includes('category')) selectColumns.push('category');
  if (columns.includes('media_path')) selectColumns.push('media_path');
  if (columns.includes('media_type')) selectColumns.push('media_type');
  if (columns.includes('media_name')) selectColumns.push('media_name');
  if (columns.includes('updated_at')) selectColumns.push('updated_at');

  const sql = `SELECT ${selectColumns.join(', ')} FROM templates ORDER BY created_at DESC`;
  res.json(db.prepare(sql).all());
});

router.post('/', upload.single('attachment'), (req, res) => {
  const { name, content, category } = req.body;
  if (!name || !content) {
    return res.status(400).json({ error: 'Name and content required' });
  }

  const mediaPath = req.file ? toPublicMediaPath(req.file.path) : null;
  const mediaType = req.file ? req.file.mimetype : null;
  const mediaName = req.file ? req.file.originalname : null;

  const sql = `
    INSERT INTO templates (name, content, category, media_path, media_type, media_name)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  const result = db
    .prepare(sql)
    .run(name, content, category || 'General', mediaPath, mediaType, mediaName);

  res.json({ success: true, id: result.lastInsertRowid });
});

router.put('/:id', upload.single('attachment'), (req, res) => {
  const { name, content, category, remove_media } = req.body;
  const columns = getTemplateColumnNames();
  const existing = db.prepare('SELECT * FROM templates WHERE id=?').get(req.params.id);

  if (!existing) {
    return res.status(404).json({ error: 'Template not found' });
  }

  const shouldRemove = remove_media === 'true';
  let mediaPath = existing.media_path;
  let mediaType = existing.media_type;
  let mediaName = existing.media_name;

  if (req.file) {
    if (existing.media_path) {
      safeDeleteMedia(existing.media_path);
    }
    mediaPath = toPublicMediaPath(req.file.path);
    mediaType = req.file.mimetype;
    mediaName = req.file.originalname;
  } else if (shouldRemove) {
    if (existing.media_path) {
      safeDeleteMedia(existing.media_path);
    }
    mediaPath = null;
    mediaType = null;
    mediaName = null;
  }

  if (columns.includes('updated_at')) {
    const sql = `
      UPDATE templates
      SET name=?, content=?, category=?, media_path=?, media_type=?, media_name=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `;
    db.prepare(sql).run(
      name || existing.name,
      content || existing.content,
      category || existing.category || 'General',
      mediaPath,
      mediaType,
      mediaName,
      req.params.id,
    );
  } else {
    const sql = `
      UPDATE templates
      SET name=?, content=?, category=?, media_path=?, media_type=?, media_name=?
      WHERE id=?
    `;
    db.prepare(sql).run(
      name || existing.name,
      content || existing.content,
      category || existing.category || 'General',
      mediaPath,
      mediaType,
      mediaName,
      req.params.id,
    );
  }

  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT media_path FROM templates WHERE id=?').get(req.params.id);
  if (existing?.media_path) {
    safeDeleteMedia(existing.media_path);
  }

  db.prepare('DELETE FROM templates WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
