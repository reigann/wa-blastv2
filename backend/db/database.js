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
    category TEXT DEFAULT 'General',
    media_path TEXT,
    media_type TEXT,
    media_name TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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

  -- Bandit policy table: stores serialized policy state (A_inv, b per arm)
  CREATE TABLE IF NOT EXISTS bandit_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    arms INTEGER DEFAULT 0,
    feature_names TEXT,
    policy_state TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Bandit events: logs each recommend action and later feedback (reward)
  CREATE TABLE IF NOT EXISTS bandit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    policy_id INTEGER,
    phone TEXT,
    context TEXT,
    arm INTEGER,
    reward REAL,
    session_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (policy_id) REFERENCES bandit_policies(id)
  );

  -- Queue table for scheduled/queued blast sessions. Stores serialized payload so queued jobs
  -- can be executed later in-order when the active blast finishes.
  CREATE TABLE IF NOT EXISTS blast_queue (
    session_id INTEGER PRIMARY KEY,
    payload TEXT,
    queued_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Interactions table: records replies/clicks/other engagement from recipients
  CREATE TABLE IF NOT EXISTS blast_interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    phone TEXT,
    action_type TEXT,
    payload TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

function addColumnIfMissing(tableName, columnName, columnSql) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const hasColumn = columns.some((column) => column.name === columnName);
  if (!hasColumn) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql};`);
  }
}

// Add missing columns to contacts table if they don't exist
addColumnIfMissing('contacts', 'minat_prodi', "minat_prodi TEXT DEFAULT 'Teknik Informatika'");
addColumnIfMissing('contacts', 'asal_sekolah', "asal_sekolah TEXT DEFAULT 'unknown'");
addColumnIfMissing('contacts', 'cluster_id', 'cluster_id INTEGER DEFAULT -1');

// Add missing columns to templates table if they don't exist
addColumnIfMissing('templates', 'category', "category TEXT DEFAULT 'General'");
addColumnIfMissing('templates', 'media_path', 'media_path TEXT');
addColumnIfMissing('templates', 'media_type', 'media_type TEXT');
addColumnIfMissing('templates', 'media_name', 'media_name TEXT');
addColumnIfMissing('templates', 'updated_at', 'updated_at DATETIME');
addColumnIfMissing('templates', 'link', 'link TEXT');

// Ensure bandit_events has phone column for backward compatibility
addColumnIfMissing('bandit_events', 'phone', 'phone TEXT');

module.exports = db;
