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
  const { name, phone, group_name, group, minat_prodi, asal_sekolah } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone is required' });

  try {
    const result = db.prepare(
      'INSERT OR IGNORE INTO contacts (name, phone, group_name, minat_prodi, asal_sekolah) VALUES (?, ?, ?, ?, ?)'
    ).run(
      name, 
      phone, 
      group_name || group || 'default',
      minat_prodi || 'Teknik Informatika',
      asal_sekolah || 'unknown'
    );
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/contacts/:id — update single contact
router.put('/:id', (req, res) => {
  const { name, phone, group_name, group, minat_prodi, asal_sekolah } = req.body;
  const existing = db.prepare('SELECT * FROM contacts WHERE id=?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Contact not found' });
  }

  try {
    db.prepare(`
      UPDATE contacts
      SET name=?, phone=?, group_name=?, minat_prodi=?, asal_sekolah=?
      WHERE id=?
    `).run(
      name || existing.name,
      phone || existing.phone,
      group_name || group || existing.group_name || 'default',
      minat_prodi || existing.minat_prodi || 'Teknik Informatika',
      asal_sekolah || existing.asal_sekolah || 'unknown',
      req.params.id,
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/contacts/upload — upload CSV or TSV (ultra-smart auto-detect)
router.post('/upload', upload.single('file'), (req, res) => {
  const results = [];
  const group_name = req.body.group_name || 'default';
  const filePath = req.file.path;

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: err.message });

    const firstLine = data.split('\n')[0];
    const delimiter = firstLine.includes('\t') ? '\t' : ',';
    
    const options = {
      delimiter: delimiter,
      headers: true,
      // IMPORTANT: Don't lowercase headers to preserve "nama", "phone", etc.
      mapHeaders: ({ header, index }) => header.trim()
    };

    fs.createReadStream(filePath)
      .pipe(csv(options))
      .on('data', (data) => results.push(data))
      .on('end', () => {
        let imported = 0;
        let skipped = 0;

        if (results.length === 0) {
          return res.status(400).json({ error: 'File CSV kosong' });
        }

        const firstRow = results[0];
        const headers = Object.keys(firstRow);
        
        // Debug log
        console.log('[UPLOAD] Headers detected:', headers);
        console.log('[UPLOAD] First row:', firstRow);

        // SMART COLUMN DETECTION
        let phoneCol = null;
        let nameCol = null;
        let groupCol = null;
        let prodiCol = null;
        let sekolahCol = null;

        // Strategy 1: Check header names (case-insensitive)
        for (const h of headers) {
          const lower = h.toLowerCase();
          if (!phoneCol && /^phone$|^nomor$|^no$|^hp$|^telepon$|^whatsapp$|^wa$|^nomor_wa/.test(lower)) phoneCol = h;
          if (!nameCol && /^nama$|^name$|^nama_kontak$|^nama_siswa$|^contact_name$|^fullname/.test(lower)) nameCol = h;
          if (!groupCol && /^group$|^group_name$|^kelompok$|^gelombang$|^kelas$|^grup$/.test(lower)) groupCol = h;
          if (!prodiCol && /^prodi$|^minat_prodi$|^program_studi$|^jurusan$|^program/.test(lower)) prodiCol = h;
          if (!sekolahCol && /^sekolah$|^asal_sekolah$|^sekolah_asal$|^instansi$|^asal$/.test(lower)) sekolahCol = h;
        }

        // Strategy 2: If still not found, look for substring match
        if (!phoneCol) {
          phoneCol = headers.find(h => h.toLowerCase().includes('phone') || h.toLowerCase().includes('nomor'));
        }
        if (!nameCol) {
          nameCol = headers.find(h => h.toLowerCase().includes('nama') || h.toLowerCase().includes('name'));
        }
        if (!groupCol) {
          groupCol = headers.find(h => h.toLowerCase().includes('group') || h.toLowerCase().includes('kelompok'));
        }
        if (!prodiCol) {
          prodiCol = headers.find(h => h.toLowerCase().includes('prodi') || h.toLowerCase().includes('program'));
        }
        if (!sekolahCol) {
          sekolahCol = headers.find(h => h.toLowerCase().includes('sekolah') || h.toLowerCase().includes('asal'));
        }

        // Fallback to position if not found
        if (!phoneCol) phoneCol = headers[1] || headers[0];
        if (!nameCol) nameCol = headers[0] || headers[1];
        if (!groupCol) groupCol = headers[2] || headers[3];
        if (!prodiCol) prodiCol = headers[2];
        if (!sekolahCol) sekolahCol = headers[3];

        console.log('[UPLOAD] Column mapping:', { phoneCol, nameCol, groupCol, prodiCol, sekolahCol });

        const insert = db.prepare(
          'INSERT OR IGNORE INTO contacts (name, phone, group_name, minat_prodi, asal_sekolah) VALUES (?, ?, ?, ?, ?)'
        );

        const insertMany = db.transaction((contacts) => {
          for (const c of contacts) {
            // Extract phone
            let phone = (c[phoneCol] || '').toString().trim();
            if (!phone) {
              skipped++;
              continue;
            }

            // Normalize phone: remove spaces, dashes, keep only digits and +
            phone = phone.replace(/[^\d+]/g, '');
            if (!phone.startsWith('+') && phone.length > 8) phone = '+' + phone;

            // Extract name - USE EXACT COLUMN NAME
            let name = (c[nameCol] || '').toString().trim();
            if (!name) {
              name = `Contact_${phone.slice(-4)}`;
            }

            // Extract optional fields
            const minat_prodi = (c[prodiCol] || 'Teknik Informatika').toString().trim();
            const asal_sekolah = (c[sekolahCol] || 'unknown').toString().trim();

            const r = insert.run(name, phone, group_name, minat_prodi, asal_sekolah);
            r.changes ? imported++ : skipped++;
          }
        });

        insertMany(results);
        fs.unlinkSync(filePath);
        res.json({ 
          success: true, 
          imported, 
          skipped, 
          total: results.length,
          detected: { 
            nameColumn: nameCol,
            phoneColumn: phoneCol, 
            prodiColumn: prodiCol,
            sekolahColumn: sekolahCol,
            allHeaders: headers
          }
        });
      })
      .on('error', (err) => {
        fs.unlinkSync(filePath);
        res.status(400).json({ error: 'CSV parsing failed: ' + err.message });
      });
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
