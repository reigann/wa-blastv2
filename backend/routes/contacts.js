const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const { admin, getFirestore } = require('../services/firebaseAdmin');

const upload = multer({ dest: 'uploads/' });

function chunkArray(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function normalizePhone(raw) {
  let phone = String(raw || '').trim().replace(/[^\d+]/g, '');
  if (phone && !phone.startsWith('+') && phone.length > 8) phone = '+' + phone;
  return phone;
}

async function findByPhone(phone) {
  const db = getFirestore();
  const snap = await db.collection('contacts').where('phone', '==', phone).limit(1).get();
  return snap.empty ? null : snap.docs[0];
}

router.get('/', async (req, res) => {
  try {
    const db = getFirestore();
    const { group } = req.query;
    let q = db.collection('contacts');
    if (group) q = q.where('group_name', '==', group);

    const snap = await q.get();
    const contacts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    contacts.sort((a, b) => {
      const ta = a.created_at?.toMillis ? a.created_at.toMillis() : 0;
      const tb = b.created_at?.toMillis ? b.created_at.toMillis() : 0;
      return tb - ta;
    });

    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/groups', async (req, res) => {
  try {
    const db = getFirestore();
    const snap = await db.collection('contacts').get();
    const counter = new Map();

    for (const d of snap.docs) {
      const g = d.data().group_name || 'default';
      counter.set(g, (counter.get(g) || 0) + 1);
    }

    res.json(Array.from(counter.entries()).map(([group_name, count]) => ({ group_name, count })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { name, phone, group_name, group, minat_prodi, asal_sekolah } = req.body;
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return res.status(400).json({ error: 'Phone is required' });

  try {
    const existing = await findByPhone(normalizedPhone);
    if (existing) return res.json({ success: true, id: existing.id, skipped: true });

    const db = getFirestore();
    const now = admin.firestore.Timestamp.now();
    const ref = await db.collection('contacts').add({
      name: name || `Contact_${normalizedPhone.slice(-4)}`,
      phone: normalizedPhone,
      group_name: group_name || group || 'default',
      minat_prodi: minat_prodi || 'Teknik Informatika',
      asal_sekolah: asal_sekolah || 'unknown',
      cluster_id: -1,
      created_at: now,
      updated_at: now,
    });

    res.json({ success: true, id: ref.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const db = getFirestore();
    const ref = db.collection('contacts').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Contact not found' });

    const existing = doc.data();
    const { name, phone, group_name, group, minat_prodi, asal_sekolah } = req.body;
    const normalizedPhone = phone ? normalizePhone(phone) : existing.phone;

    await ref.update({
      name: name || existing.name,
      phone: normalizedPhone,
      group_name: group_name || group || existing.group_name || 'default',
      minat_prodi: minat_prodi || existing.minat_prodi || 'Teknik Informatika',
      asal_sekolah: asal_sekolah || existing.asal_sekolah || 'unknown',
      updated_at: admin.firestore.Timestamp.now(),
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/upload', upload.single('file'), (req, res) => {
  const results = [];
  const group_name = req.body.group_name || 'default';
  const filePath = req.file.path;

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: err.message });

    const delimiter = data.split('\n')[0].includes('\t') ? '\t' : ',';
    const options = { delimiter, headers: false };

    fs.createReadStream(filePath)
      .pipe(csv(options))
      .on('data', (row) => results.push(row))
      .on('end', async () => {
        let imported = 0;
        let skipped = 0;

        if (!results.length) return res.status(400).json({ error: 'File CSV kosong' });

        // Extract headers from first row
        const headerRow = results[0];
        const headers = Object.values(headerRow).map(h => h.trim());
        const dataRows = results.slice(1);

        const phoneCol = headers.findIndex((h) => /phone|nomor/i.test(h));
        const nameCol = headers.findIndex((h) => /nama|name/i.test(h));
        const prodiCol = headers.findIndex((h) => /prodi|program/i.test(h));
        const sekolahCol = headers.findIndex((h) => /sekolah|asal/i.test(h));

        try {
          const db = getFirestore();
          for (const c of dataRows) {
            const phone = normalizePhone(c[phoneCol]);
            if (!phone) {
              skipped++;
              continue;
            }

            const existing = await findByPhone(phone);
            if (existing) {
              skipped++;
              continue;
            }

            const now = admin.firestore.Timestamp.now();
            await db.collection('contacts').add({
              name: (c[nameCol] || `Contact_${phone.slice(-4)}`).toString().trim(),
              phone,
              group_name,
              minat_prodi: (c[prodiCol] || 'Teknik Informatika').toString().trim(),
              asal_sekolah: (c[sekolahCol] || 'unknown').toString().trim(),
              cluster_id: -1,
              created_at: now,
              updated_at: now,
            });
            imported++;
          }

          fs.unlinkSync(filePath);
          res.json({ success: true, imported, skipped, total: dataRows.length });
        } catch (e) {
          fs.unlinkSync(filePath);
          res.status(500).json({ error: e.message });
        }
      })
      .on('error', (parseErr) => {
        fs.unlinkSync(filePath);
        res.status(400).json({ error: 'CSV parsing failed: ' + parseErr.message });
      });
  });
});

router.post('/upload/preview', upload.single('file'), (req, res) => {
  const results = [];
  const group_name = req.body.group_name || 'default';
  const filePath = req.file.path;

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: err.message });

    const delimiter = data.split('\n')[0].includes('\t') ? '\t' : ',';
    const options = { delimiter, headers: false };

    fs.createReadStream(filePath)
      .pipe(csv(options))
      .on('data', (row) => results.push(row))
      .on('end', () => {
        if (!results.length) {
          fs.unlinkSync(filePath);
          return res.status(400).json({ error: 'File CSV kosong' });
        }

        // Extract headers from first row
        const headerRow = results[0];
        const headers = Object.values(headerRow).map(h => h.trim());
        const dataRows = results.slice(1);

        const phoneCol = headers.findIndex((h) => /phone|nomor/i.test(h));
        const nameCol = headers.findIndex((h) => /nama|name/i.test(h));
        const prodiCol = headers.findIndex((h) => /prodi|program/i.test(h));
        const sekolahCol = headers.findIndex((h) => /sekolah|asal/i.test(h));

        const rows = dataRows.map((c, idx) => {
          const phone = normalizePhone(c[phoneCol]);
          return {
            __idx: idx,
            name: (c[nameCol] || `Contact_${String(phone).slice(-4)}`).toString().trim(),
            phone,
            minat_prodi: (c[prodiCol] || 'Teknik Informatika').toString().trim(),
            asal_sekolah: (c[sekolahCol] || 'unknown').toString().trim(),
            original: c,
          };
        });

        fs.unlinkSync(filePath);
        res.json({ success: true, total: rows.length, rows: rows.slice(0, 500), group_name });
      })
      .on('error', (parseErr) => {
        fs.unlinkSync(filePath);
        res.status(400).json({ error: 'CSV parsing failed: ' + parseErr.message });
      });
  });
});

router.post('/import', express.json(), async (req, res) => {
  const { rows, group_name } = req.body;
  if (!rows || !Array.isArray(rows) || !rows.length) return res.status(400).json({ error: 'No rows provided for import' });

  try {
    const db = getFirestore();

    // 1. Normalize all phones
    const entries = rows.map((c) => ({
      name: (c.name || '').toString().trim(),
      phone: normalizePhone(c.phone),
      minat_prodi: (c.minat_prodi || 'Teknik Informatika').toString().trim(),
      asal_sekolah: (c.asal_sekolah || 'unknown').toString().trim(),
    })).filter((e) => e.phone);

    // 2. Batch-check existing phones (Firestore 'in' max 10 per query)
    const existingPhones = new Set();
    const phoneChunks = chunkArray(entries.map((e) => e.phone), 10);
    for (const chunk of phoneChunks) {
      const snap = await db.collection('contacts').where('phone', 'in', chunk).select('phone').get();
      snap.docs.forEach((d) => existingPhones.add(d.data().phone));
    }

    const toAdd = entries.filter((e) => !existingPhones.has(e.phone));
    const imported = toAdd.length;
    const skipped = entries.length - imported;

    // 3. Batch write all new contacts
    const now = admin.firestore.Timestamp.now();
    const writeChunks = chunkArray(toAdd, 500);
    for (const chunk of writeChunks) {
      const batch = db.batch();
      chunk.forEach((e) => {
        const ref = db.collection('contacts').doc();
        batch.set(ref, {
          name: e.name || `Contact_${e.phone.slice(-4)}`,
          phone: e.phone,
          group_name: group_name || 'default',
          minat_prodi: e.minat_prodi,
          asal_sekolah: e.asal_sekolah,
          cluster_id: -1,
          created_at: now,
          updated_at: now,
        });
      });
      await batch.commit();
    }

    res.json({ success: true, imported, skipped, total: entries.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const db = getFirestore();
    await db.collection('contacts').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/delete-bulk', express.json(), async (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids array required' });
  try {
    const db = getFirestore();
    const chunks = chunkArray(ids, 500);
    for (const chunk of chunks) {
      const batch = db.batch();
      chunk.forEach((id) => batch.delete(db.collection('contacts').doc(String(id))));
      await batch.commit();
    }
    res.json({ success: true, deleted: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/', async (req, res) => {
  try {
    const db = getFirestore();
    const { group } = req.query;
    let q = db.collection('contacts');
    if (group) q = q.where('group_name', '==', group);

    const snap = await q.get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
