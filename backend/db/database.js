const storageProvider = (process.env.STORAGE_PROVIDER || 'firebase').toLowerCase();

if (storageProvider === 'firebase') {
  const noopStatement = {
    run: () => ({ lastID: null, changes: 0 }),
    get: () => null,
    all: () => [],
  };

  module.exports = {
    async initializePool() {
      return null;
    },
    async query() {
      return [];
    },
    async get() {
      return null;
    },
    async all() {
      return [];
    },
    async run() {
      return { lastID: null, changes: 0 };
    },
    async execBatch() {
      return null;
    },
    async closePool() {
      return null;
    },
    prepare() {
      return noopStatement;
    },
    exec() {
      return null;
    },
  };
} else {
  const dbAdapter = require('./mysql-adapter');
  const { initializeMySQLDatabase } = require('./mysql-init');

  let dbInitialized = false;

  async function initDb() {
    if (!dbInitialized) {
      await dbAdapter.initializePool();
      await initializeMySQLDatabase();
      dbInitialized = true;
    }
  }

  initDb().catch((err) => console.error('Database initialization error:', err));
  module.exports = dbAdapter;
}
