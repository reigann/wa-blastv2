const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const db = require('../db/database');

const upload = multer({ dest: 'uploads/' });

// GET /api/contacts
router.get('/', (req, res) => {
  const { group } = req.query;
  let contacts;
  if (group) {
    contacts = db.prepare('SELECT * FROM contacts WHERE group_name=? ORDER BY created_at DESC').all(group);
  } else {
    contacts = db.prepare('SELECT * FROM contacts ORDER BY created_at DESC').all();
  }
  res.json(contacts);
});

// GET /api/contacts/groups
router.get('/groups', (req, res) => {
  const groups = db.prepare('SELECT DISTINCT group_name, COUNT(*) as count FROM contacts GROUP BY group_name').all();
  res.json(groups);
});

// POST /api/contacts — add single contact
router.post('/', (req, res) => {
  const { name, phone, group_name } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone is required' });

  try {
    const result = db.prepare(
      'INSERT OR IGNORE INTO contacts (name, phone, group_name) VALUES (?, ?, ?)'
    ).run(name, phone, group_name || 'default');
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/contacts/upload — upload CSV
router.post('/upload', upload.single('file'), (req, res) => {
  const results = [];
  const group_name = req.body.group_name || 'default';

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      let imported = 0;
      let skipped = 0;
      const insert = db.prepare(
        'INSERT OR IGNORE INTO contacts (name, phone, group_name) VALUES (?, ?, ?)'
      );
      const insertMany = db.transaction((contacts) => {
        for (const c of contacts) {
          // Support columns: name, phone / Name, Phone / NAMA, NOMOR
          const name = c.name || c.Name || c.NAMA || '';
          const phone = c.phone || c.Phone || c.NOMOR || c.nomor || '';
          if (phone) {
            const r = insert.run(name, phone.toString().trim(), group_name);
            r.changes ? imported++ : skipped++;
          }
        }
      });
      insertMany(results);
      fs.unlinkSync(req.file.path); // cleanup
      res.json({ success: true, imported, skipped, total: results.length });
    });
});

// DELETE /api/contacts/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM contacts WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// DELETE /api/contacts — delete all or by group
router.delete('/', (req, res) => {
  const { group } = req.query;
  if (group) {
    db.prepare('DELETE FROM contacts WHERE group_name=?').run(group);
  } else {
    db.prepare('DELETE FROM contacts').run();
  }
  res.json({ success: true });
});

module.exports = router;
