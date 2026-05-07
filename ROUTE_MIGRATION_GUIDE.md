# SQLite to MySQL Route Migration Guide

This guide shows how to migrate route files from SQLite sync API to MySQL async/await API.

## Key Changes

### Before (SQLite - Synchronous)
```javascript
const db = require('../db/database');

router.get('/items', (req, res) => {
  // Synchronous calls
  const items = db.prepare('SELECT * FROM items').all();
  res.json(items);
});

router.post('/items', (req, res) => {
  const result = db.prepare('INSERT INTO items (name) VALUES (?)').run(req.body.name);
  res.json({ id: result.lastInsertRowid });
});
```

### After (MySQL - Asynchronous)
```javascript
const db = require('../db/database');

router.get('/items', async (req, res) => {
  try {
    // Asynchronous calls
    const items = await db.all('SELECT * FROM items');
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/items', async (req, res) => {
  try {
    const result = await db.run('INSERT INTO items (name) VALUES (?)', [req.body.name]);
    res.json({ id: result.lastID });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Migration Patterns

### Pattern 1: Simple SELECT
```javascript
// SQLite
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

// MySQL
const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
```

### Pattern 2: SELECT Multiple Rows
```javascript
// SQLite
const items = db.prepare('SELECT * FROM items').all();

// MySQL
const items = await db.all('SELECT * FROM items');
```

### Pattern 3: INSERT
```javascript
// SQLite
const result = db.prepare('INSERT INTO items (name, value) VALUES (?, ?)').run(name, value);
const id = result.lastInsertRowid;

// MySQL
const result = await db.run('INSERT INTO items (name, value) VALUES (?, ?)', [name, value]);
const id = result.lastID;
```

### Pattern 4: UPDATE
```javascript
// SQLite
db.prepare('UPDATE items SET name = ? WHERE id = ?').run(newName, id);

// MySQL
await db.run('UPDATE items SET name = ? WHERE id = ?', [newName, id]);
```

### Pattern 5: DELETE
```javascript
// SQLite
db.prepare('DELETE FROM items WHERE id = ?').run(id);

// MySQL
await db.run('DELETE FROM items WHERE id = ?', [id]);
```

### Pattern 6: Transaction/Batch
```javascript
// SQLite
const insert = db.prepare('INSERT INTO contacts (name, phone) VALUES (?, ?)');
const batch = db.transaction((rows) => {
  for (const row of rows) {
    insert.run(row.name, row.phone);
  }
});
batch(contactsArray);

// MySQL (async)
async function batchInsertContacts(contactsArray) {
  for (const contact of contactsArray) {
    await db.run(
      'INSERT INTO contacts (name, phone) VALUES (?, ?)',
      [contact.name, contact.phone]
    );
  }
}
await batchInsertContacts(contactsArray);

// Or with explicit transaction:
const connection = await db.getConnection();
try {
  await connection.beginTransaction();
  for (const contact of contactsArray) {
    await connection.execute(
      'INSERT INTO contacts (name, phone) VALUES (?, ?)',
      [contact.name, contact.phone]
    );
  }
  await connection.commit();
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
}
```

## API Method Reference

### db.get(sql, params)
Returns a single row or null
```javascript
const user = await db.get('SELECT * FROM users WHERE id = ?', [1]);
// Returns: { id: 1, name: 'John', ... } or null
```

### db.all(sql, params)
Returns array of rows
```javascript
const users = await db.all('SELECT * FROM users WHERE status = ?', ['active']);
// Returns: [{ id: 1, ... }, { id: 2, ... }]
```

### db.run(sql, params)
Execute INSERT/UPDATE/DELETE
```javascript
const result = await db.run('INSERT INTO users (name) VALUES (?)', ['John']);
// Returns: { lastID: 123, changes: 1 }
```

### db.query(sql, params)
Raw query execution
```javascript
const [results] = await db.query('SELECT * FROM users');
// Returns raw mysql2 result
```

### db.execBatch(statements)
Execute multiple SQL statements
```javascript
await db.execBatch([
  'CREATE TABLE IF NOT EXISTS users (...)',
  'CREATE TABLE IF NOT EXISTS posts (...)'
]);
```

## Routes to Update (Priority Order)

1. **routes/contacts.js** - Heavy queries, impacts blast operations
2. **routes/templates.js** - Simpler, fewer queries
3. **routes/blast.js** - Complex, many operations
4. **routes/clustering.js** - May use Python, check wrapper
5. **routes/bandit.js** - Complex state, needs careful migration
6. **services/*.js** - All services using db

## Example: Migrating contacts.js

### Changes Summary
- Convert all route handlers to `async`
- Wrap in `try/catch`
- Replace `db.prepare().get()` with `await db.get()`
- Replace `db.prepare().run()` with `await db.run()`
- Replace `db.prepare().all()` with `await db.all()`
- Update result property: `lastInsertRowid` → `lastID`

### Code Template
```javascript
const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const db = require('../db/database');

const upload = multer({ dest: 'uploads/' });

// GET /api/contacts
router.get('/', async (req, res) => {
  try {
    const { group } = req.query;
    let contacts;
    
    if (group) {
      contacts = await db.all(
        'SELECT * FROM contacts WHERE group_name = ? ORDER BY created_at DESC',
        [group]
      );
    } else {
      contacts = await db.all(
        'SELECT * FROM contacts ORDER BY created_at DESC'
      );
    }
    
    res.json(contacts);
  } catch (error) {
    console.error('Error in GET /contacts:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/contacts
router.post('/', async (req, res) => {
  try {
    const { name, phone, group_name, group, minat_prodi, asal_sekolah } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'Phone is required' });
    }

    const result = await db.run(
      'INSERT INTO contacts (name, phone, group_name, minat_prodi, asal_sekolah) VALUES (?, ?, ?, ?, ?)',
      [
        name,
        phone,
        group_name || group || 'default',
        minat_prodi || 'Teknik Informatika',
        asal_sekolah || 'unknown'
      ]
    );
    
    res.json({ success: true, id: result.lastID });
  } catch (error) {
    console.error('Error in POST /contacts:', error);
    res.status(500).json({ error: error.message });
  }
});
```

## Testing After Migration

```bash
# Test GET
curl http://localhost:3001/api/contacts \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test POST
curl -X POST http://localhost:3001/api/contacts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"John","phone":"+1234567890"}'

# Test with group
curl "http://localhost:3001/api/contacts?group=sales" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Common Errors & Solutions

### Error: "db.prepare is not a function"
**Cause**: Still using SQLite API  
**Solution**: Replace with async methods (db.get, db.all, db.run)

### Error: "await only in async functions"
**Cause**: Forgetting `async` keyword on route handler  
**Solution**: Add `async` before `(req, res) =>`

### Error: "Cannot read property 'lastID' of undefined"
**Cause**: db.run() result structure changed  
**Solution**: SQLite uses `lastInsertRowid`, MySQL uses `lastID`

### Timeout errors
**Cause**: Promise not being awaited  
**Solution**: Ensure all db calls are awaited

## File-by-File Migration Checklist

- [ ] **backend/routes/contacts.js**
  - [ ] GET /
  - [ ] GET /groups
  - [ ] POST /
  - [ ] PUT /:id
  - [ ] POST /upload
  - [ ] POST /import
  - [ ] DELETE /:id
  - [ ] DELETE /

- [ ] **backend/routes/templates.js**
  - [ ] GET /
  - [ ] POST /
  - [ ] PUT /:id
  - [ ] DELETE /:id

- [ ] **backend/routes/blast.js**
  - [ ] GET /sessions
  - [ ] GET /sessions/:id/logs
  - [ ] POST /start
  - [ ] POST /cancel
  - [ ] DELETE /sessions/:id

- [ ] **backend/services/banditService.js**
  - [ ] createPolicy
  - [ ] getPolicy
  - [ ] listPolicies
  - [ ] recordEvent
  - [ ] feedback

- [ ] **backend/services/blastService.js**
  - [ ] All database operations

## Performance Considerations

1. **Connection Pooling**: MySQL adapter uses connection pooling (10 connections)
2. **Timeouts**: Default 30 seconds for API calls
3. **Batch Operations**: For bulk inserts, consider looping with individual queries vs. batch
4. **Indexes**: Database already has indexes on critical columns

## Rollback Plan

If migration causes issues:

1. Keep SQLite database backup: `cp backend/db/blaster.db backend/db/blaster.db.backup`
2. Export MySQL data: `mysqldump -u root -p whatsapp_blaster > backup.sql`
3. Can always switch back by reverting code changes (old db.js)

## Migration Timeline

Estimated effort per file:
- contacts.js: 30 minutes
- templates.js: 15 minutes  
- blast.js: 45 minutes
- bandit.js: 45 minutes
- Other services: 2-3 hours

**Total: 3-4 hours of development time**

## Getting Help

If routes fail after migration:
1. Check error message in console
2. Verify database connection (mysql running?)
3. Check MySQL has required tables (init-mysql.js script)
4. Ensure Bearer token is valid (test with /api/auth/me)
5. Review this guide for the specific pattern you're using
