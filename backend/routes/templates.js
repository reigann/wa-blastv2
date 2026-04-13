const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM templates ORDER BY created_at DESC').all());
});

router.post('/', (req, res) => {
  const { name, content } = req.body;
  if (!name || !content) return res.status(400).json({ error: 'Name and content required' });
  const r = db.prepare('INSERT INTO templates (name, content) VALUES (?, ?)').run(name, content);
  res.json({ success: true, id: r.lastInsertRowid });
});

router.put('/:id', (req, res) => {
  const { name, content } = req.body;
  db.prepare('UPDATE templates SET name=?, content=? WHERE id=?').run(name, content, req.params.id);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM templates WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
