const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'blaster.db'));

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT NOT NULL UNIQUE,
    group_name TEXT DEFAULT 'default',
    minat_prodi TEXT DEFAULT 'Teknik Informatika',
    asal_sekolah TEXT DEFAULT 'unknown',
    cluster_id INTEGER DEFAULT -1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS blast_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    message TEXT,
    total INTEGER DEFAULT 0,
    sent INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    scheduled_at DATETIME,
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS blast_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    phone TEXT,
    name TEXT,
    status TEXT,
    error_message TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES blast_sessions(id)
  );

  CREATE TABLE IF NOT EXISTS cluster_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    total_contacts INTEGER DEFAULT 0,
    num_clusters INTEGER DEFAULT 0,
    silhouette_score REAL DEFAULT 0,
    davies_bouldin_index REAL DEFAULT 0,
    features_used TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS features (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL,
    feature_name TEXT NOT NULL,
    feature_value REAL NOT NULL,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
    UNIQUE(contact_id, feature_name)
  );
`);

// Add missing columns to existing contacts table if they don't exist
try {
  db.exec(`
    ALTER TABLE contacts ADD COLUMN minat_prodi TEXT DEFAULT 'Teknik Informatika';
    ALTER TABLE contacts ADD COLUMN asal_sekolah TEXT DEFAULT 'unknown';
  `);
} catch (err) {
  // Columns likely already exist, ignore
}

module.exports = db;
