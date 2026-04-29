const crypto = require('crypto');

const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS || 24);
const sessions = new Map();

function parseUsersFromEnv() {
  const users = [];

  const raw = process.env.APP_USERS || process.env.AUTH_USERS || '';
  if (raw.trim()) {
    raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((pair) => {
        const [username, ...rest] = pair.split(':');
        const password = rest.join(':');
        if (username && password) {
          users.push({ username: username.trim(), password: password.trim() });
        }
      });
  }

  for (let i = 1; i <= 20; i += 1) {
    const username = process.env[`AUTH_USER_${i}`] || process.env[`APP_USER_${i}`];
    const password = process.env[`AUTH_PASS_${i}`] || process.env[`APP_PASS_${i}`];
    if (username && password) {
      users.push({ username: String(username).trim(), password: String(password).trim() });
    }
  }

  const unique = new Map();
  users.forEach((user) => {
    if (!unique.has(user.username)) {
      unique.set(user.username, user.password);
    }
  });

  return [...unique.entries()].map(([username, password]) => ({ username, password }));
}

let allowedUsers = parseUsersFromEnv();

function reloadUsers() {
  allowedUsers = parseUsersFromEnv();
  return allowedUsers;
}

function getAllowedUsers() {
  return allowedUsers;
}

function validateCredentials(username, password) {
  const user = allowedUsers.find((item) => item.username === username);
  if (!user) return false;
  return user.password === password;
}

function createSession(username) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_HOURS * 60 * 60 * 1000;

  sessions.set(token, {
    token,
    username,
    createdAt: now,
    expiresAt,
  });

  return { token, expiresAt };
}

function getSession(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }

  return session;
}

function invalidateSession(token) {
  if (!token) return;
  sessions.delete(token);
}

function extractBearerToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}

module.exports = {
  parseUsersFromEnv,
  reloadUsers,
  getAllowedUsers,
  validateCredentials,
  createSession,
  getSession,
  invalidateSession,
  extractBearerToken,
};
