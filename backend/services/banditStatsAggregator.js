/**
 * CMAB Statistics Aggregator
 * Aggregates feedback data from bandit events and provides statistics
 * for dashboard visualization and analysis
 */

const { admin, getFirestore } = require('./firebaseAdmin');

const STORAGE_PROVIDER = (process.env.STORAGE_PROVIDER || 'firebase').toLowerCase();

function ensureFirebaseMode() {
  if (STORAGE_PROVIDER !== 'firebase') {
    throw new Error('Stats aggregator requires Firebase storage mode');
  }
}

function isMissingIndexError(err) {
  if (!err) return false;
  const msg = String(err.message || '');
  return err.code === 9 || msg.includes('FAILED_PRECONDITION') || msg.includes('requires an index');
}

function getEventMillis(ev) {
  return ev?.created_at?.toMillis ? ev.created_at.toMillis() : 0;
}

function parseDateBoundary(dateStr, endOfDay = false) {
  if (!dateStr) return null;
  const suffix = endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
  const dt = new Date(String(dateStr).includes('T') ? dateStr : `${dateStr}${suffix}`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.getTime();
}

function filterByDateRange(events, options = {}) {
  const startMs = parseDateBoundary(options.startDate, false);
  const endMs = parseDateBoundary(options.endDate, true);
  if (!startMs && !endMs) return events;
  return events.filter((ev) => {
    const createdMs = getEventMillis(ev);
    if (startMs && createdMs < startMs) return false;
    if (endMs && createdMs > endMs) return false;
    return true;
  });
}

async function fetchPolicyEventsWithOrder(db, policyId, direction = 'desc', limit = null) {
  const safePolicyId = Number(policyId);

  try {
    let query = db
      .collection('bandit_events')
      .where('policy_id', '==', safePolicyId)
      .orderBy('created_at', direction);

    if (Number.isFinite(limit) && limit > 0) {
      query = query.limit(limit);
    }

    const snap = await query.get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    if (!isMissingIndexError(err)) throw err;

    let fallbackQuery = db.collection('bandit_events').where('policy_id', '==', safePolicyId);
    if (Number.isFinite(limit) && limit > 0) {
      fallbackQuery = fallbackQuery.limit(limit);
    }

    const snap = await fallbackQuery.get();
    const events = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    events.sort((a, b) => (direction === 'asc' ? getEventMillis(a) - getEventMillis(b) : getEventMillis(b) - getEventMillis(a)));
    return events;
  }
}

/**
 * Aggregate statistics for a single arm
 */
function aggregateArmStats(events) {
  const result = {
    total_events: events.length,
    sent_count: events.length,
    delivered_count: 0,
    read_count: 0,
    replied_count: 0,
    failed_count: 0,
    pending_count: 0,
    total_reward: 0,
    completed_count: 0,
  };

  events.forEach((ev) => {
    const delivery = ev.delivery_status || 'pending';
    const readStatus = Number(ev.read_status) || 0;
    const replyReceived = Number(ev.reply_received) || 0;
    const reward = ev.reward !== null && ev.reward !== undefined ? Number(ev.reward) : null;

    // Count by status
    if (delivery === 'delivered' || delivery === 'sent') result.delivered_count++;
    if (delivery === 'failed') result.failed_count++;
    if (readStatus === 1) result.read_count++;
    if (replyReceived === 1) result.replied_count++;
    if (reward !== null) {
      result.completed_count++;
      result.total_reward += reward;
    } else {
      result.pending_count++;
    }
  });

  // Calculate percentages
  const safe = Math.max(1, result.sent_count);
  const safeDelivered = Math.max(1, result.delivered_count);

  return {
    ...result,
    delivery_rate: (result.delivered_count / safe * 100).toFixed(1),
    failure_rate: (result.failed_count / safe * 100).toFixed(1),
    read_rate: (result.read_count / safeDelivered * 100).toFixed(1),
    reply_rate: (result.replied_count / safeDelivered * 100).toFixed(1),
    avg_reward: result.completed_count > 0 ? (result.total_reward / result.completed_count).toFixed(3) : '0.000',
  };
}

/**
 * Get analytics for all arms of a policy
 * @param {number} policyId - Policy ID
 * @returns {Promise<Object>} Analytics object with per-arm statistics
 */
async function getPolicyAnalytics(policyId, options = {}) {
  ensureFirebaseMode();

  const db = getFirestore();

  // Get policy to know number of arms
  const policyDoc = await db.collection('bandit_policies').doc(String(policyId)).get();
  if (!policyDoc.exists) throw new Error('Policy not found');

  const policy = policyDoc.data();
  const armsCount = policy.arms || 2;

  // Get all events for this policy
  const allEvents = filterByDateRange(
    await fetchPolicyEventsWithOrder(db, policyId, 'desc', 5000),
    options
  );

  // Group events by arm
  const eventsByArm = {};
  for (let arm = 0; arm < armsCount; arm++) {
    eventsByArm[arm] = allEvents.filter((ev) => Number(ev.arm) === arm);
  }

  // Calculate stats per arm
  const armStats = {};
  for (let arm = 0; arm < armsCount; arm++) {
    armStats[arm] = {
      arm: arm,
      ...aggregateArmStats(eventsByArm[arm] || []),
    };
  }

  // Overall statistics
  const totalEvents = allEvents.length;
  const totalDelivered = allEvents.filter(
    (ev) => ev.delivery_status === 'delivered' || ev.delivery_status === 'sent'
  ).length;
  const totalRead = allEvents.filter((ev) => Number(ev.read_status) === 1).length;
  const totalReplied = allEvents.filter((ev) => Number(ev.reply_received) === 1).length;
  const totalFailed = allEvents.filter((ev) => ev.delivery_status === 'failed').length;
  const totalRewards = allEvents
    .filter((ev) => ev.reward !== null && ev.reward !== undefined)
    .reduce((sum, ev) => sum + Number(ev.reward), 0);
  const completedEvents = allEvents.filter((ev) => ev.reward !== null && ev.reward !== undefined).length;

  const safeTotal = Math.max(1, totalEvents);
  const safeDelivered = Math.max(1, totalDelivered);

  return {
    policy_id: Number(policyId),
    generated_at: new Date().toISOString(),
    total_events: totalEvents,
    completed_events: completedEvents,
    pending_events: totalEvents - completedEvents,
    overall: {
      delivery_rate: (totalDelivered / safeTotal * 100).toFixed(1),
      failure_rate: (totalFailed / safeTotal * 100).toFixed(1),
      read_rate: (totalRead / safeDelivered * 100).toFixed(1),
      reply_rate: (totalReplied / safeDelivered * 100).toFixed(1),
      avg_reward: completedEvents > 0 ? (totalRewards / completedEvents).toFixed(3) : '0.000',
      total_reward: totalRewards.toFixed(3),
    },
    arms: armStats,
  };
}

/**
 * Get campaign/session statistics
 * @param {string} sessionId - Blast session ID
 * @returns {Promise<Object>} Campaign statistics
 */
async function getSessionStatistics(sessionId) {
  ensureFirebaseMode();

  const db = getFirestore();

  // Get all events for this session
  const eventsSnap = await db
    .collection('bandit_events')
    .where('session_id', '==', String(sessionId))
    .get();

  const events = eventsSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  if (events.length === 0) {
    return {
      session_id: sessionId,
      total_events: 0,
      stats: {
        sent: 0,
        delivered: 0,
        read: 0,
        replied: 0,
        failed: 0,
      },
      by_arm: {},
      recent_replies: [],
    };
  }

  // Aggregate overall stats
  const stats = {
    sent: events.length,
    delivered: 0,
    read: 0,
    replied: 0,
    failed: 0,
  };

  // Group by arm
  const byArm = {};

  events.forEach((ev) => {
    const arm = Number(ev.arm);
    if (!byArm[arm]) {
      byArm[arm] = {
        arm,
        sent: 0,
        delivered: 0,
        read: 0,
        replied: 0,
      };
    }

    byArm[arm].sent++;

    const delivery = ev.delivery_status || 'pending';
    if (delivery === 'delivered' || delivery === 'sent') {
      stats.delivered++;
      byArm[arm].delivered++;
    }

    if (delivery === 'failed') {
      stats.failed++;
    }

    if (Number(ev.read_status) === 1) {
      stats.read++;
      byArm[arm].read++;
    }

    if (Number(ev.reply_received) === 1) {
      stats.replied++;
      byArm[arm].replied++;
    }
  });

  // Calculate percentages
  const safeTotal = Math.max(1, stats.sent);
  const safeDelivered = Math.max(1, stats.delivered);

  return {
    session_id: sessionId,
    total_events: events.length,
    stats: {
      sent: stats.sent,
      delivered: stats.delivered,
      delivery_rate: (stats.delivered / safeTotal * 100).toFixed(1),
      read: stats.read,
      read_rate: (stats.read / safeDelivered * 100).toFixed(1),
      replied: stats.replied,
      reply_rate: (stats.replied / safeDelivered * 100).toFixed(1),
      failed: stats.failed,
      failure_rate: (stats.failed / safeTotal * 100).toFixed(1),
    },
    by_arm: byArm,
  };
}

/**
 * Get recent events with details
 * @param {number} policyId - Policy ID
 * @param {number} limit - Number of events to return
 * @returns {Promise<Array>} Array of events with calculated stats
 */
async function getRecentEvents(policyId, limit = 100, options = {}) {
  ensureFirebaseMode();

  const db = getFirestore();

  const events = filterByDateRange(
    await fetchPolicyEventsWithOrder(db, policyId, 'desc', Math.min(limit, 1000)),
    options
  );

  return events.map((ev) => ({
    ...ev,
    created_at_iso: ev.created_at?.toDate?.().toISOString() || new Date().toISOString(),
    updated_at_iso: ev.updated_at?.toDate?.().toISOString() || new Date().toISOString(),
  }));
}

/**
 * Get detailed event breakdown by status
 * @param {number} policyId - Policy ID
 * @returns {Promise<Object>} Breakdown of events by status
 */
async function getEventBreakdown(policyId, options = {}) {
  ensureFirebaseMode();

  const db = getFirestore();

  const eventsSnap = await db
    .collection('bandit_events')
    .where('policy_id', '==', Number(policyId))
    .get();

  const events = filterByDateRange(eventsSnap.docs.map((doc) => doc.data()), options);

  const breakdown = {
    by_delivery_status: {
      pending: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
    },
    by_read_status: {
      unread: 0,
      read: 0,
    },
    by_reply_status: {
      no_reply: 0,
      replied: 0,
    },
    by_reward_status: {
      pending_reward: 0,
      rewarded: 0,
    },
  };

  events.forEach((ev) => {
    // Delivery status
    const delivery = ev.delivery_status || 'pending';
    breakdown.by_delivery_status[delivery] = (breakdown.by_delivery_status[delivery] || 0) + 1;

    // Read status
    if (Number(ev.read_status) === 1) {
      breakdown.by_read_status.read++;
    } else {
      breakdown.by_read_status.unread++;
    }

    // Reply status
    if (Number(ev.reply_received) === 1) {
      breakdown.by_reply_status.replied++;
    } else {
      breakdown.by_reply_status.no_reply++;
    }

    // Reward status
    if (ev.reward !== null && ev.reward !== undefined) {
      breakdown.by_reward_status.rewarded++;
    } else {
      breakdown.by_reward_status.pending_reward++;
    }
  });

  return {
    policy_id: Number(policyId),
    total_events: events.length,
    breakdown,
  };
}

/**
 * Compare performance across multiple policies
 * @param {Array<number>} policyIds - Array of policy IDs
 * @returns {Promise<Array>} Comparison of policies
 */
async function comparePolicies(policyIds) {
  ensureFirebaseMode();

  const results = [];

  for (const policyId of policyIds) {
    try {
      const analytics = await getPolicyAnalytics(policyId);
      results.push({
        policy_id: policyId,
        analytics,
      });
    } catch (err) {
      results.push({
        policy_id: policyId,
        error: err.message,
      });
    }
  }

  return results;
}

/**
 * Get learning progress (track improvement over time)
 * @param {number} policyId - Policy ID
 * @returns {Promise<Object>} Learning progress metrics
 */
async function getLearningProgress(policyId, options = {}) {
  ensureFirebaseMode();

  const db = getFirestore();

  const events = filterByDateRange(
    await fetchPolicyEventsWithOrder(db, policyId, 'asc'),
    options
  );

  if (events.length < 10) {
    return {
      policy_id: Number(policyId),
      warning: 'Not enough events for learning analysis',
      total_events: events.length,
    };
  }

  // Split into chunks for timeline analysis
  const chunkSize = Math.max(10, Math.floor(events.length / 5));
  const chunks = [];

  for (let i = 0; i < events.length; i += chunkSize) {
    chunks.push(events.slice(i, i + chunkSize));
  }

  // Analyze each chunk
  const timeline = chunks.map((chunk, idx) => {
    const stats = aggregateArmStats(chunk);
    return {
      phase: idx + 1,
      events_in_phase: chunk.length,
      ...stats,
    };
  });

  // Calculate improvement trend
  const firstPhase = timeline[0];
  const lastPhase = timeline[timeline.length - 1];

  const avgRewardImprovement =
    ((Number(lastPhase.avg_reward) - Number(firstPhase.avg_reward)) / Number(firstPhase.avg_reward) * 100).toFixed(1);

  return {
    policy_id: Number(policyId),
    total_events: events.length,
    phases: timeline.length,
    timeline,
    improvement: {
      avg_reward_change: `${avgRewardImprovement}%`,
      first_phase_avg_reward: firstPhase.avg_reward,
      last_phase_avg_reward: lastPhase.avg_reward,
    },
  };
}

async function getTemplateRecommendation(templateIds = [], policyId = null, options = {}) {
  ensureFirebaseMode();
  const db = getFirestore();

  const safeTemplateIds = Array.isArray(templateIds)
    ? templateIds.map((id) => String(id)).filter(Boolean)
    : [];

  if (safeTemplateIds.length === 0) {
    return {
      recommended_template_id: null,
      reason: 'no_templates',
      candidates: [],
    };
  }

  const totalsByTemplate = {};
  let globalSent = 0;

  for (const templateId of safeTemplateIds) {
    let sessionQuery = db.collection('blast_sessions').where('template_id', '==', String(templateId));
    if (policyId !== null && policyId !== undefined) {
      sessionQuery = sessionQuery.where('bandit_policy_id', '==', Number(policyId));
    }
    const sessionSnap = await sessionQuery.get();
    const sessions = sessionSnap.docs
      .map((doc) => ({ id: String(doc.id), ...doc.data() }))
      .filter((s) => filterByDateRange([{ created_at: s.created_at }], options).length > 0);
    const sessionIds = sessions.map((s) => String(s.id));

    const stat = {
      template_id: String(templateId),
      sessions: sessionIds.length,
      sent: 0,
      delivered: 0,
      read: 0,
      replied: 0,
      failed: 0,
      score: 0,
    };

    for (let i = 0; i < sessionIds.length; i += 30) {
      const chunk = sessionIds.slice(i, i + 30);
      if (chunk.length === 0) continue;
      const eventsSnap = await db.collection('bandit_events').where('session_id', 'in', chunk).get();
      eventsSnap.docs.forEach((eventDoc) => {
        const ev = eventDoc.data() || {};
        if (filterByDateRange([ev], options).length === 0) return;
        const delivery = ev.delivery_status || 'pending';
        stat.sent += 1;
        if (delivery === 'delivered' || delivery === 'sent') stat.delivered += 1;
        if (delivery === 'failed') stat.failed += 1;
        if (Number(ev.read_status) === 1) stat.read += 1;
        if (Number(ev.reply_received) === 1) stat.replied += 1;
      });
    }

    globalSent += stat.sent;
    totalsByTemplate[templateId] = stat;
  }

  const candidates = Object.values(totalsByTemplate).map((stat) => {
    const sentSafe = Math.max(1, stat.sent);
    const readRate = stat.read / sentSafe;
    const replyRate = stat.replied / sentSafe;
    const failRate = stat.failed / sentSafe;
    const baseScore = (readRate * 0.7) + (replyRate * 1.5) - (failRate * 0.3);
    const exploration = Math.sqrt((2 * Math.log(Math.max(globalSent, 1) + 1)) / sentSafe);
    const score = baseScore + exploration;

    return {
      ...stat,
      read_rate: Number((readRate * 100).toFixed(1)),
      reply_rate: Number((replyRate * 100).toFixed(1)),
      fail_rate: Number((failRate * 100).toFixed(1)),
      score: Number(score.toFixed(4)),
      cold_start: stat.sent === 0,
    };
  });

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0] || null;

  return {
    recommended_template_id: top ? String(top.template_id) : null,
    reason: top?.cold_start ? 'cold_start' : 'best_score',
    candidates,
  };
}

module.exports = {
  getPolicyAnalytics,
  getSessionStatistics,
  getRecentEvents,
  getEventBreakdown,
  comparePolicies,
  getLearningProgress,
  getTemplateRecommendation,
  aggregateArmStats,
};
