const db = require('./mysql-adapter');

async function initializeMySQLDatabase() {
  try {
    console.log('Initializing MySQL database...');

    // Create tables
    await db.execBatch([
      // Users table for Google SSO
      `CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255),
        google_id VARCHAR(255),
        picture_url TEXT,
        is_allowed INT DEFAULT 1,
        last_login DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,

      // Allowlist table for authorized emails
      `CREATE TABLE IF NOT EXISTS email_allowlist (
        id INT PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(255) NOT NULL UNIQUE,
        added_by VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Sessions table
      `CREATE TABLE IF NOT EXISTS sessions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        token VARCHAR(500) UNIQUE,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,

      // Contacts table
      `CREATE TABLE IF NOT EXISTS contacts (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255),
        phone VARCHAR(20) NOT NULL UNIQUE,
        group_name VARCHAR(255) DEFAULT 'default',
        minat_prodi VARCHAR(255) DEFAULT 'Teknik Informatika',
        asal_sekolah VARCHAR(255) DEFAULT 'unknown',
        cluster_id INT DEFAULT -1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,

      // Templates table
      `CREATE TABLE IF NOT EXISTS templates (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        content LONGTEXT NOT NULL,
        category VARCHAR(255) DEFAULT 'General',
        media_path VARCHAR(500),
        media_type VARCHAR(50),
        media_name VARCHAR(255),
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Blast sessions table
      `CREATE TABLE IF NOT EXISTS blast_sessions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255),
        message LONGTEXT,
        total INT DEFAULT 0,
        sent INT DEFAULT 0,
        failed INT DEFAULT 0,
        status VARCHAR(50) DEFAULT 'pending',
        scheduled_at DATETIME,
        started_at DATETIME,
        completed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Blast logs table
      `CREATE TABLE IF NOT EXISTS blast_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        session_id INT,
        phone VARCHAR(20),
        name VARCHAR(255),
        status VARCHAR(50),
        error_message TEXT,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES blast_sessions(id) ON DELETE CASCADE,
        INDEX idx_session (session_id)
      )`,

      // Cluster metadata table
      `CREATE TABLE IF NOT EXISTS cluster_metadata (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        total_contacts INT DEFAULT 0,
        num_clusters INT DEFAULT 0,
        silhouette_score REAL DEFAULT 0,
        davies_bouldin_index REAL DEFAULT 0,
        features_used LONGTEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,

      // Features table
      `CREATE TABLE IF NOT EXISTS features (
        id INT PRIMARY KEY AUTO_INCREMENT,
        contact_id INT NOT NULL,
        feature_name VARCHAR(255) NOT NULL,
        feature_value REAL NOT NULL,
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
        UNIQUE KEY unique_contact_feature (contact_id, feature_name),
        INDEX idx_contact (contact_id)
      )`,

      // Bandit policies table
      `CREATE TABLE IF NOT EXISTS bandit_policies (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255),
        arms INT DEFAULT 0,
        feature_names LONGTEXT,
        policy_state LONGTEXT,
        arm_definitions LONGTEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,

      // Bandit arm analytics table
      `CREATE TABLE IF NOT EXISTS bandit_arm_analytics (
        id INT PRIMARY KEY AUTO_INCREMENT,
        policy_id INT,
        arm_id INT,
        total_recommendations INT DEFAULT 0,
        total_reward REAL DEFAULT 0,
        avg_reward REAL DEFAULT 0,
        successful_count INT DEFAULT 0,
        failed_count INT DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (policy_id) REFERENCES bandit_policies(id) ON DELETE CASCADE,
        INDEX idx_policy (policy_id)
      )`,

      // Bandit events table
      `CREATE TABLE IF NOT EXISTS bandit_events (
        id INT PRIMARY KEY AUTO_INCREMENT,
        policy_id INT,
        phone VARCHAR(20),
        context LONGTEXT,
        arm INT,
        reward REAL,
        session_id INT,
        delivery_status VARCHAR(50) DEFAULT 'pending',
        read_status INT DEFAULT 0,
        reply_received INT DEFAULT 0,
        auto_reward_applied INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (policy_id) REFERENCES bandit_policies(id) ON DELETE CASCADE,
        INDEX idx_policy (policy_id),
        INDEX idx_phone (phone)
      )`,

      // Blast queue table
      `CREATE TABLE IF NOT EXISTS blast_queue (
        session_id INT PRIMARY KEY,
        payload LONGTEXT,
        queued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES blast_sessions(id) ON DELETE CASCADE
      )`,

      // Blast interactions table
      `CREATE TABLE IF NOT EXISTS blast_interactions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        session_id INT,
        phone VARCHAR(20),
        action_type VARCHAR(50),
        payload LONGTEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES blast_sessions(id) ON DELETE CASCADE,
        INDEX idx_session (session_id)
      )`,
    ]);

    console.log('MySQL database tables initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing MySQL database:', error);
    throw error;
  }
}

module.exports = { initializeMySQLDatabase };
