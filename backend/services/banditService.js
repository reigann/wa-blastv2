const db = require('../db/database');

// Simple Contextual LinUCB-like implementation with Sherman-Morrison updates
// Stores policy state in DB as JSON to survive restarts.

const DEFAULT_ALPHA = parseFloat(process.env.BANDIT_ALPHA) || 1.0;
const DEFAULT_LAMBDA = parseFloat(process.env.BANDIT_LAMBDA) || 1.0;

function zeros(n) {
  return Array.from({ length: n }, () => 0.0);
}

function eye(n, val = 1.0) {
  const m = Array.from({ length: n }, () => zeros(n));
  for (let i = 0; i < n; i++) m[i][i] = val;
  return m;
}

function matVecMul(mat, vec) {
  const n = mat.length;
  const out = zeros(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < vec.length; j++) s += mat[i][j] * vec[j];
    out[i] = s;
  }
  return out;
}

function vecDot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function outer(a, b) {
  const n = a.length;
  const m = b.length;
  const out = Array.from({ length: n }, () => Array.from({ length: m }, () => 0.0));
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) out[i][j] = a[i] * b[j];
  return out;
}

function matSub(A, B) {
  const n = A.length;
  const m = A[0].length;
  const out = Array.from({ length: n }, () => Array.from({ length: m }, () => 0.0));
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) out[i][j] = A[i][j] - B[i][j];
  return out;
}

function scalarOuterDiv(v, denom) {
  const n = v.length;
  const out = Array.from({ length: n }, () => Array.from({ length: n }, () => 0.0));
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out[i][j] = (v[i] * v[j]) / denom;
  return out;
}

function vecAdd(a, b) {
  const out = zeros(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] + b[i];
  return out;
}

function scalarMulVec(scalar, v) {
  const out = zeros(v.length);
  for (let i = 0; i < v.length; i++) out[i] = scalar * v[i];
  return out;
}

async function createPolicy(name = 'policy', arms = 2, featureNames = [], alpha = DEFAULT_ALPHA, lambda = DEFAULT_LAMBDA) {
  const d = featureNames.length;
  // initialize arms state
  const arms_state = [];
  for (let a = 0; a < arms; a++) {
    // A_inv initialized as (1/lambda) * I
    const A_inv = eye(d, 1.0 / lambda);
    const b = zeros(d);
    arms_state.push({ A_inv, b });
  }

  const policy_state = { arms_state, alpha, lambda };

  const stmt = db.prepare(`INSERT INTO bandit_policies (name, arms, feature_names, policy_state) VALUES (?, ?, ?, ?)`);
  const info = stmt.run(name, arms, JSON.stringify(featureNames || []), JSON.stringify(policy_state));
  return { id: info.lastInsertRowid, name, arms, featureNames };
}

function getPolicyRow(policyId) {
  return db.prepare('SELECT * FROM bandit_policies WHERE id = ?').get(policyId);
}

function listPolicies() {
  return db.prepare('SELECT id, name, arms, feature_names, created_at, updated_at FROM bandit_policies ORDER BY created_at DESC').all();
}

function parsePolicy(row) {
  if (!row) return null;
  let feature_names = [];
  try { feature_names = row.feature_names ? JSON.parse(row.feature_names) : []; } catch (e) { feature_names = []; }
  let policy_state = { arms_state: [], alpha: DEFAULT_ALPHA, lambda: DEFAULT_LAMBDA };
  try { policy_state = row.policy_state ? JSON.parse(row.policy_state) : policy_state; } catch (e) { }
  return { id: row.id, name: row.name, arms: row.arms, feature_names, policy_state };
}

async function recommend(policyId, context = {}, sessionId = null, phone = null) {
  const row = getPolicyRow(policyId);
  if (!row) throw new Error('Policy not found');
  const policy = parsePolicy(row);

  const featureNames = policy.feature_names || [];
  const d = featureNames.length;
  const x = zeros(d);
  for (let i = 0; i < d; i++) {
    const key = featureNames[i];
    const v = context && context.hasOwnProperty(key) ? Number(context[key]) : 0.0;
    x[i] = isNaN(v) ? 0.0 : v;
  }

  // For each arm compute p = x^T theta + alpha * sqrt(x^T A_inv x)
  const { arms_state, alpha } = policy.policy_state;
  let best = { arm: 0, score: -Infinity };
  for (let a = 0; a < arms_state.length; a++) {
    const { A_inv, b } = arms_state[a];
    const theta = matVecMul(A_inv, b);
    const xAinv = matVecMul(A_inv, x);
    const uncertainty = Math.sqrt(Math.max(0, vecDot(x, xAinv)));
    const score = vecDot(x, theta) + (alpha || DEFAULT_ALPHA) * uncertainty;
    if (score > best.score) {
      best = { arm: a, score };
    }
  }

  // Insert event with null reward (to be updated later via feedback)
  const insert = db.prepare('INSERT INTO bandit_events (policy_id, phone, context, arm, reward, session_id) VALUES (?, ?, ?, ?, NULL, ?)');
  const info = insert.run(policyId, phone || null, JSON.stringify(context || {}), best.arm, sessionId || null);

  return { eventId: info.lastInsertRowid, arm: best.arm };
}

function persistPolicyState(policyId, policy_state) {
  const stmt = db.prepare('UPDATE bandit_policies SET policy_state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  stmt.run(JSON.stringify(policy_state), policyId);
}

async function feedback(eventId, reward = 0) {
  const ev = db.prepare('SELECT * FROM bandit_events WHERE id = ?').get(eventId);
  if (!ev) throw new Error('Event not found');
  if (ev.reward !== null && ev.reward !== undefined) {
    // already has feedback - do not overwrite
    return { updated: false, reason: 'already_set' };
  }

  // parse context
  let context = {};
  try { context = ev.context ? JSON.parse(ev.context) : {}; } catch (e) { context = {}; }

  const row = getPolicyRow(ev.policy_id);
  if (!row) throw new Error('Policy for event not found');
  const policy = parsePolicy(row);
  const featureNames = policy.feature_names || [];
  const d = featureNames.length;
  const x = zeros(d);
  for (let i = 0; i < d; i++) {
    const key = featureNames[i];
    const v = context && context.hasOwnProperty(key) ? Number(context[key]) : 0.0;
    x[i] = isNaN(v) ? 0.0 : v;
  }

  const arms_state = policy.policy_state.arms_state;
  const armIdx = Number(ev.arm);
  if (!arms_state[armIdx]) throw new Error('Arm state missing');

  // Sherman-Morrison update for A_inv: A_inv <- A_inv - (A_inv x x^T A_inv) / (1 + x^T A_inv x)
  const A_inv = arms_state[armIdx].A_inv;
  const b = arms_state[armIdx].b;

  const v = matVecMul(A_inv, x); // v = A_inv * x
  const denom = 1 + Math.max(0, vecDot(x, v));
  const numer = outer(v, v); // v v^T

  // Update A_inv in place
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      const delta = numer[i][j] / denom;
      A_inv[i][j] = A_inv[i][j] - delta;
    }
  }

  // b <- b + reward * x
  const deltaB = scalarMulVec(Number(reward), x);
  for (let i = 0; i < d; i++) b[i] = (b[i] || 0) + deltaB[i];

  // persist updated policy state
  policy.policy_state.arms_state[armIdx].A_inv = A_inv;
  policy.policy_state.arms_state[armIdx].b = b;
  persistPolicyState(policy.id, policy.policy_state);

  // update event reward
  db.prepare('UPDATE bandit_events SET reward = ? WHERE id = ?').run(reward, eventId);

  return { ok: true };
}

function listEvents(limit = 200, policyId = null) {
  const stmt = policyId
    ? db.prepare('SELECT * FROM bandit_events WHERE policy_id = ? ORDER BY created_at DESC LIMIT ?')
    : db.prepare('SELECT * FROM bandit_events ORDER BY created_at DESC LIMIT ?');
  return policyId ? stmt.all(policyId, limit) : stmt.all(limit);
}

module.exports = {
  createPolicy,
  recommend,
  feedback,
  listPolicies,
  listEvents,
  getPolicyRow,
};
