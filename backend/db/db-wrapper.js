// Backward compatibility wrapper for easier query migration
// This allows gradual migration from sync to async patterns

const db = require('./mysql-adapter');

// Synchronous stubs that throw helpful errors (for awareness)
// These should be replaced with async versions
class DBWrapper {
  // Methods that should be replaced - for tracking
  prepare(sql) {
    throw new Error(
      `db.prepare() is no longer supported. Use async versions:\n` +
      `- db.run(sql, params) for INSERT/UPDATE/DELETE\n` +
      `- db.get(sql, params) for SELECT single row\n` +
      `- db.all(sql, params) for SELECT multiple rows`
    );
  }

  exec(sql) {
    throw new Error('db.exec() is no longer supported. Use async db.execBatch([...])');
  }

  // Forward actual calls to the adapter
  async run(sql, params) {
    return db.run(sql, params);
  }

  async get(sql, params) {
    return db.get(sql, params);
  }

  async all(sql, params) {
    return db.all(sql, params);
  }

  async query(sql, params) {
    return db.query(sql, params);
  }

  async execBatch(statements) {
    return db.execBatch(statements);
  }

  async closePool() {
    return db.closePool();
  }
}

module.exports = new DBWrapper();
