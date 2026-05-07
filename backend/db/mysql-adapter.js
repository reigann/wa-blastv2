const mysql = require('mysql2/promise');

let pool;

async function initializePool() {
  if (pool) {
    return pool;
  }

  pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'whatsapp_blaster',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });

  console.log('MySQL Pool initialized');
  return pool;
}

async function getConnection() {
  if (!pool) {
    await initializePool();
  }
  return pool.getConnection();
}

async function query(sql, params = []) {
  const connection = await getConnection();
  try {
    const [results] = await connection.execute(sql, params);
    return results;
  } finally {
    connection.release();
  }
}

async function get(sql, params = []) {
  const results = await query(sql, params);
  return results.length > 0 ? results[0] : null;
}

async function all(sql, params = []) {
  return query(sql, params);
}

async function run(sql, params = []) {
  const connection = await getConnection();
  try {
    const [result] = await connection.execute(sql, params);
    return {
      lastID: result.insertId,
      changes: result.affectedRows,
    };
  } finally {
    connection.release();
  }
}

async function execBatch(statements) {
  const connection = await getConnection();
  try {
    for (const statement of statements) {
      await connection.execute(statement);
    }
  } finally {
    connection.release();
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('MySQL Pool closed');
  }
}

module.exports = {
  initializePool,
  getConnection,
  query,
  get,
  all,
  run,
  execBatch,
  closePool,
};
