const { admin, getFirestore } = require('./firebaseAdmin');

const STORAGE_PROVIDER = (process.env.STORAGE_PROVIDER || 'firebase').toLowerCase();
const DEFAULT_ALPHA = parseFloat(process.env.BANDIT_ALPHA) || 1.0;
const DEFAULT_LAMBDA = parseFloat(process.env.BANDIT_LAMBDA) || 1.0;

function ensureFirebaseMode() {
  if (STORAGE_PROVIDER !== 'firebase') {
    throw new Error('Bandit service is configured for Firebase storage mode only.');
  }
}

function normalizePhone(phone) {
  const digits = String(phone || '')
    .replace(/@c\.us$/i, '')
    .replace(/@g\.us$/i, '')
    .replace(/@lid$/i, '')
    .replace(/@.*$/i, '')
    .replace(/[^\d]/g, '');

  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (!digits.startsWith('62')) return `62${digits}`;
  return digits;
}

function zeros(n) {
  return Array.from({ length: n }, () => 0.0);
}

function eye(n, value = 1.0) {
  const matrix = Array.from({ length: n }, () => zeros(n));
  for (let i = 0; i < n; i += 1) matrix[i][i] = value;
  return matrix;
}

function matVecMul(matrix, vec) {
  const out = zeros(matrix.length);
  for (let i = 0; i < matrix.length; i += 1) {
    let sum = 0;
    for (let j = 0; j < vec.length; j += 1) sum += matrix[i][j] * vec[j];
    out[i] = sum;
  }
  return out;
}

function vecDot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}

async function nextNumericId(counterKey) {
  const db = getFirestore();
  const ref = db.collection('_counters').doc(counterKey);
  const id = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? Number(snap.data().value || 0) : 0;
    const next = current + 1;
    tx.set(ref, { value: next, updated_at: admin.firestore.Timestamp.now() }, { merge: true });
    return next;
  });
  return id;
}

function parsePolicy(doc) {
  if (!doc || !doc.exists) return null;
  const data = doc.data() || {};
  return {
    id: Number(doc.id),
    name: data.name || 'policy',
    arms: Number(data.arms || 2),
    feature_names: Array.isArray(data.feature_names) ? data.feature_names : [],
    arm_definitions: Array.isArray(data.arm_definitions) ? data.arm_definitions : [],
    policy_state: data.policy_state || {
      arms_state: [],
      alpha: DEFAULT_ALPHA,
      lambda: DEFAULT_LAMBDA,
    },
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

async function createPolicy(name = 'policy', arms = 2, featureNames = [], alpha = DEFAULT_ALPHA, lambda = DEFAULT_LAMBDA) {
  ensureFirebaseMode();

  const safeArms = Math.max(2, Number(arms) || 2);
  const features = Array.isArray(featureNames) ? featureNames : [];
  const dim = features.length;

  const armsState = [];
  for (let i = 0; i < safeArms; i += 1) {
    armsState.push({
      A_inv: eye(dim, 1.0 / lambda),
      b: zeros(dim),
    });
  }

  const policyId = await nextNumericId('bandit_policies');
  const now = admin.firestore.Timestamp.now();
  const payload = {
    name,
    arms: safeArms,
    feature_names: features,
    arm_definitions: [],
    policy_state: {
      arms_state: armsState,
      alpha: Number(alpha) || DEFAULT_ALPHA,
      lambda: Number(lambda) || DEFAULT_LAMBDA,
    },
    created_at: now,
    updated_at: now,
  };

  await getFirestore().collection('bandit_policies').doc(String(policyId)).set(payload);
  return { id: policyId, name, arms: safeArms, featureNames: features };
}

async function getPolicyRow(policyId) {
  ensureFirebaseMode();
  const doc = await getFirestore().collection('bandit_policies').doc(String(policyId)).get();
  return parsePolicy(doc);
}

async function listPolicies() {
  ensureFirebaseMode();
  const snap = await getFirestore().collection('bandit_policies').orderBy('created_at', 'desc').get();
  return snap.docs.map((doc) => {
    const row = parsePolicy(doc);
    return {
      id: row.id,
      name: row.name,
      arms: row.arms,
      feature_names: row.feature_names,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  });
}

async function recommend(policyId, context = {}, sessionId = null, phone = null) {
  ensureFirebaseMode();

  const policy = await getPolicyRow(policyId);
  if (!policy) throw new Error('Policy not found');

  const features = policy.feature_names || [];
  const x = features.map((key) => {
    const value = Object.prototype.hasOwnProperty.call(context || {}, key) ? Number(context[key]) : 0;
    return Number.isFinite(value) ? value : 0;
  });

  const state = policy.policy_state || { arms_state: [] };
  const armsState = Array.isArray(state.arms_state) ? state.arms_state : [];
  const alpha = Number(state.alpha) || DEFAULT_ALPHA;

  let bestArm = 0;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < armsState.length; i += 1) {
    const arm = armsState[i];
    const AInv = arm.A_inv || eye(x.length, 1.0 / DEFAULT_LAMBDA);
    const b = arm.b || zeros(x.length);
    const theta = matVecMul(AInv, b);
    const xAInv = matVecMul(AInv, x);
    const uncertainty = Math.sqrt(Math.max(0, vecDot(x, xAInv)));
    const score = vecDot(x, theta) + alpha * uncertainty;

    if (score > bestScore) {
      bestScore = score;
      bestArm = i;
    }
  }

  const eventId = await nextNumericId('bandit_events');
  await getFirestore().collection('bandit_events').doc(String(eventId)).set({
    policy_id: Number(policyId),
    phone: normalizePhone(phone) || null,
    context: context || {},
    arm: bestArm,
    reward: null,
    session_id: sessionId || null,
    delivery_status: null,
    read_status: 0,
    reply_received: 0,
    auto_reward_applied: 0,
    created_at: admin.firestore.Timestamp.now(),
    updated_at: admin.firestore.Timestamp.now(),
  });

  return { eventId, arm: bestArm };
}

async function persistPolicyState(policyId, policyState) {
  await getFirestore().collection('bandit_policies').doc(String(policyId)).set(
    {
      policy_state: policyState,
      updated_at: admin.firestore.Timestamp.now(),
    },
    { merge: true }
  );
}

async function feedback(eventId, reward = 0) {
  ensureFirebaseMode();

  const db = getFirestore();
  const eventRef = db.collection('bandit_events').doc(String(eventId));
  const eventDoc = await eventRef.get();
  if (!eventDoc.exists) throw new Error('Event not found');

  const ev = eventDoc.data() || {};
  if (ev.reward !== null && ev.reward !== undefined) {
    return { updated: false, reason: 'already_set' };
  }

  const policy = await getPolicyRow(ev.policy_id);
  if (!policy) throw new Error('Policy for event not found');

  const featureNames = policy.feature_names || [];
  const context = ev.context || {};
  const x = featureNames.map((key) => {
    const value = Object.prototype.hasOwnProperty.call(context, key) ? Number(context[key]) : 0;
    return Number.isFinite(value) ? value : 0;
  });

  const armsState = policy.policy_state.arms_state || [];
  const armIdx = Number(ev.arm);
  if (!armsState[armIdx]) throw new Error('Arm state missing');

  const AInv = armsState[armIdx].A_inv || eye(x.length, 1.0 / DEFAULT_LAMBDA);
  const b = armsState[armIdx].b || zeros(x.length);

  const v = matVecMul(AInv, x);
  const denom = 1 + Math.max(0, vecDot(x, v));

  for (let i = 0; i < x.length; i += 1) {
    for (let j = 0; j < x.length; j += 1) {
      AInv[i][j] -= (v[i] * v[j]) / denom;
    }
  }

  const numericReward = Number(reward) || 0;
  for (let i = 0; i < x.length; i += 1) {
    b[i] = Number(b[i] || 0) + numericReward * x[i];
  }

  armsState[armIdx] = { A_inv: AInv, b };
  policy.policy_state.arms_state = armsState;

  await persistPolicyState(policy.id, policy.policy_state);
  await eventRef.set({ reward: numericReward, updated_at: admin.firestore.Timestamp.now() }, { merge: true });

  return { ok: true };
}

async function listEvents(limit = 200, policyId = null) {
  ensureFirebaseMode();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 200, 1000));
  const db = getFirestore();
  
  try {
    // Try the indexed query first
    let query = db.collection('bandit_events');
    if (policyId !== null && policyId !== undefined) {
      query = query.where('policy_id', '==', Number(policyId));
    }
    const snap = await query.orderBy('created_at', 'desc').limit(safeLimit).get();
    return snap.docs.map((doc) => ({ id: Number(doc.id), ...doc.data() }));
  } catch (err) {
    // Fallback: If index doesn't exist, query without filter and sort in memory
    if (err.code === 9 || err.message.includes('FAILED_PRECONDITION')) {
      console.warn('[Bandit] Composite index not ready. Using fallback strategy...');
      
      // Query all events for this policy (or all events if no filter)
      let query = db.collection('bandit_events');
      if (policyId !== null && policyId !== undefined) {
        query = query.where('policy_id', '==', Number(policyId));
      }
      
      // Get docs without orderBy (no index needed)
      const snap = await query.limit(safeLimit * 2).get();
      
      // Sort in memory
      const docs = snap.docs
        .map((doc) => ({ id: Number(doc.id), ...doc.data() }))
        .sort((a, b) => {
          const timeA = a.created_at?.toMillis ? a.created_at.toMillis() : 0;
          const timeB = b.created_at?.toMillis ? b.created_at.toMillis() : 0;
          return timeB - timeA; // Descending
        })
        .slice(0, safeLimit);
      
      return docs;
    }
    throw err;
  }
}

function getAutoReward(deliveryStatus, readStatus, replyReceived) {
  let reward = 0;

  if (deliveryStatus === 'failed') reward = -0.5;
  else if (deliveryStatus === 'sent') reward = 0.5;
  else if (deliveryStatus === 'delivered') reward = 0.8;

  if (Number(readStatus) === 1) reward += 0.3;
  if (Number(replyReceived) === 1) reward += 1.0;

  return reward;
}

async function updateEventDeliveryStatus(eventId, deliveryStatus, readStatus = 0, replyReceived = 0) {
  ensureFirebaseMode();

  const db = getFirestore();
  const ref = db.collection('bandit_events').doc(String(eventId));
  const doc = await ref.get();
  if (!doc.exists) throw new Error('Event not found');

  const current = doc.data() || {};
  const mergedReadStatus = Math.max(Number(current.read_status) || 0, Number(readStatus) || 0);
  const mergedReplyReceived = Math.max(Number(current.reply_received) || 0, Number(replyReceived) || 0);
  const autoReward = getAutoReward(deliveryStatus, readStatus, replyReceived);

  if (current.reward === null || current.reward === undefined) {
    const mergedReward = getAutoReward(deliveryStatus, mergedReadStatus, mergedReplyReceived);
    await feedback(eventId, mergedReward);
  }

  await ref.set(
    {
      delivery_status: deliveryStatus,
      read_status: mergedReadStatus,
      reply_received: mergedReplyReceived,
      auto_reward_applied: 1,
      updated_at: admin.firestore.Timestamp.now(),
    },
    { merge: true }
  );

  return { eventId: Number(eventId), autoReward, deliveryStatus };
}

async function getArmAnalytics(policyId) {
  ensureFirebaseMode();

  const policy = await getPolicyRow(policyId);
  if (!policy) throw new Error('Policy not found');

  const events = await listEvents(1000, Number(policyId));
  const armStats = {};

  console.log(`[Bandit Analytics] Policy: ${policy.name} (ID: ${policyId}), Arms: ${policy.arms}, Total Events: ${events.length}`);

  for (let arm = 0; arm < policy.arms; arm += 1) {
    const armEvents = events.filter((event) => Number(event.arm) === arm);
    const rewards = armEvents
      .map((event) => event.reward)
      .filter((value) => value !== null && value !== undefined)
      .map((value) => Number(value) || 0);

    const totalReward = rewards.reduce((sum, value) => sum + value, 0);
    const avgReward = rewards.length ? totalReward / rewards.length : 0;

    const successfulCount = armEvents.filter((event) => event.delivery_status === 'delivered' || event.delivery_status === 'sent').length;
    const failedCount = armEvents.filter((event) => event.delivery_status === 'failed').length;
    const readCount = armEvents.filter((event) => Number(event.read_status) === 1).length;
    const replyCount = armEvents.filter((event) => Number(event.reply_received) === 1).length;
    const pendingCount = armEvents.filter((event) => event.reward === null || event.reward === undefined).length;

    armStats[arm] = {
      arm_id: arm,
      total_recommendations: armEvents.length,
      total_reward: Number(totalReward.toFixed(2)),
      avg_reward: Number(avgReward.toFixed(3)),
      successful_count: successfulCount,
      failed_count: failedCount,
      read_count: readCount,
      reply_count: replyCount,
      pending_count: pendingCount,
    };

    console.log(`[Bandit Analytics] Arm ${arm}: ${armEvents.length} events, Avg Reward: ${avgReward.toFixed(3)}`);
  }

  console.log(`[Bandit Analytics] Result: ${JSON.stringify(armStats)}`);
  return armStats;
}

async function defineArms(policyId, armDefinitions) {
  ensureFirebaseMode();
  if (!Array.isArray(armDefinitions)) throw new Error('armDefinitions must be an array');

  await getFirestore().collection('bandit_policies').doc(String(policyId)).set(
    {
      arm_definitions: armDefinitions,
      updated_at: admin.firestore.Timestamp.now(),
    },
    { merge: true }
  );

  return { policyId: Number(policyId), armDefinitions };
}

async function getArmDefinitions(policyId) {
  ensureFirebaseMode();
  const policy = await getPolicyRow(policyId);
  if (!policy) throw new Error('Policy not found');
  return Array.isArray(policy.arm_definitions) ? policy.arm_definitions : [];
}

async function findRecentEventsByPhone(phone, options = {}) {
  ensureFirebaseMode();

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return [];

  const hours = Number(options.hours) > 0 ? Number(options.hours) : 48;
  const maxScan = Math.max(20, Math.min(Number(options.maxScan) || 200, 1000));
  const limit = Math.max(1, Math.min(Number(options.limit) || 20, maxScan));
  const onlyPendingReward = Boolean(options.onlyPendingReward);
  const cutoff = Date.now() - (hours * 60 * 60 * 1000);

  const snap = await getFirestore()
    .collection('bandit_events')
    .where('phone', '==', normalizedPhone)
    .limit(maxScan)
    .get();

  return snap.docs
    .map((doc) => ({ id: Number(doc.id), ...doc.data() }))
    .filter((event) => {
      const createdAtMillis = event.created_at?.toMillis ? event.created_at.toMillis() : 0;
      if (createdAtMillis < cutoff) return false;
      if (!onlyPendingReward) return true;
      return event.reward === null || event.reward === undefined;
    })
    .sort((a, b) => {
      const ta = a.created_at?.toMillis ? a.created_at.toMillis() : 0;
      const tb = b.created_at?.toMillis ? b.created_at.toMillis() : 0;
      return tb - ta;
    })
    .slice(0, limit);
}

async function attachWhatsAppMetadata(eventId, metadata = {}) {
  ensureFirebaseMode();
  const ref = getFirestore().collection('bandit_events').doc(String(eventId));
  const aliases = Array.isArray(metadata.wa_aliases) ? metadata.wa_aliases.filter(Boolean) : [];
  await ref.set(
    {
      wa_message_id: metadata.wa_message_id || null,
      wa_aliases: aliases,
      updated_at: admin.firestore.Timestamp.now(),
    },
    { merge: true }
  );
}

async function findRecentEventsByWaAlias(alias, options = {}) {
  ensureFirebaseMode();
  const normalizedAlias = String(alias || '').replace(/[^\d]/g, '');
  if (!normalizedAlias) return [];
  const hours = Number(options.hours) > 0 ? Number(options.hours) : 48;
  const limit = Math.max(1, Math.min(Number(options.limit) || 20, 200));
  const cutoff = Date.now() - (hours * 60 * 60 * 1000);

  const snap = await getFirestore()
    .collection('bandit_events')
    .where('wa_aliases', 'array-contains', normalizedAlias)
    .limit(limit)
    .get();

  return snap.docs
    .map((doc) => ({ id: Number(doc.id), ...doc.data() }))
    .filter((event) => {
      const createdAtMillis = event.created_at?.toMillis ? event.created_at.toMillis() : 0;
      return createdAtMillis >= cutoff;
    })
    .sort((a, b) => {
      const ta = a.created_at?.toMillis ? a.created_at.toMillis() : 0;
      const tb = b.created_at?.toMillis ? b.created_at.toMillis() : 0;
      return tb - ta;
    });
}

module.exports = {
  createPolicy,
  recommend,
  feedback,
  listPolicies,
  listEvents,
  getPolicyRow,
  getAutoReward,
  updateEventDeliveryStatus,
  getArmAnalytics,
  defineArms,
  getArmDefinitions,
  findRecentEventsByPhone,
  attachWhatsAppMetadata,
  findRecentEventsByWaAlias,
};
