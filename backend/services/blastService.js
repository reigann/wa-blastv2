const db = require('../db/database');
const fs = require('fs');
const { roomForUser, sendMessage, sendMessageWithMedia, normalizePhone, registerSentBanditEvent } = require('./whatsappService');
const banditService = require('./banditService');
const { admin, getFirestore } = require('./firebaseAdmin');
const STORAGE_PROVIDER = (process.env.STORAGE_PROVIDER || 'firebase').toLowerCase();

const activeBlasts = new Map();
let io = null;
const scheduledTimers = new Map();

// Configuration
const SEND_MESSAGE_TIMEOUT = 30000; // 30 seconds timeout per message
const MAX_RETRIES = 3; // Retry up to 3 times for context errors
const RETRY_DELAY = 2000; // Wait 2 seconds before retry
const CONTEXT_ERROR_DELAY = 3000; // Wait longer for context errors

function setIO(socketIo) {
  io = socketIo;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Wrap send function with timeout to prevent hanging
async function sendWithTimeout(sendFn, timeoutMs = SEND_MESSAGE_TIMEOUT) {
  return Promise.race([
    sendFn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Send timeout after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function emitToUser(username, event, payload) {
  if (!io) return;
  io.to(roomForUser(username)).emit(event, payload);
}

async function updateSession(sessionId, patch) {
  if (STORAGE_PROVIDER === 'firebase') {
    await getFirestore().collection('blast_sessions').doc(String(sessionId)).set(patch, { merge: true });
    return;
  }
  if (patch.status && patch.started_at) {
    await db.run(`UPDATE blast_sessions SET status=?, started_at=? WHERE id=?`, [patch.status, patch.started_at, sessionId]);
    return;
  }
  if (patch.status && patch.completed_at) {
    await db.run(`UPDATE blast_sessions SET status=?, completed_at=? WHERE id=?`, [patch.status, patch.completed_at, sessionId]);
    return;
  }
  if (typeof patch.sent !== 'undefined' || typeof patch.failed !== 'undefined') {
    await db.run(`UPDATE blast_sessions SET sent=?, failed=? WHERE id=?`, [patch.sent || 0, patch.failed || 0, sessionId]);
  }
}

async function insertBlastLog(log) {
  if (STORAGE_PROVIDER === 'firebase') {
    await getFirestore().collection('blast_logs').add({
      ...log,
      session_id: String(log.session_id),
      sent_at: admin.firestore.Timestamp.fromDate(new Date(log.sent_at || Date.now())),
    });
    return;
  }
  if (log.status === 'sent') {
    await db.run(
      `INSERT INTO blast_logs (session_id, phone, name, status, sent_at) VALUES (?, ?, ?, 'sent', ?)`,
      [log.session_id, log.phone, log.name, log.sent_at]
    );
    return;
  }
  await db.run(
    `INSERT INTO blast_logs (session_id, phone, name, status, error_message, sent_at) VALUES (?, ?, ?, 'failed', ?, ?)`,
    [log.session_id, log.phone, log.name, log.error_message || '', log.sent_at]
  );
}

// Replace template variables in both formats:
// - {{name}} and {name}
// - {{phone}} and {phone}
function processTemplate(message, contact) {
  const safeContact = contact || {};
  const now = new Date();

  const values = {
    name: safeContact.name || '',
    phone: safeContact.phone || '',
    date: now.toLocaleDateString('id-ID'),
    time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    group: safeContact.group_name || '',
    company: safeContact.asal_sekolah || '',
    minat_prodi: safeContact.minat_prodi || '',
    cluster: safeContact.cluster_id >= 0 ? String(safeContact.cluster_id) : '',
  };

  let output = String(message || '');
  Object.entries(values).forEach(([key, value]) => {
    const token = escapeRegex(key);
    const pattern = new RegExp(`\\{\\{\\s*${token}\\s*\\}\\}|\\{\\s*${token}\\s*\\}`, 'gi');
    output = output.replace(pattern, value);
  });

  return output;
}

async function startBlast(sessionId, contacts, message, delayMin, delayMax, mediaPath = null, username = 'default', policyId = null, link = null) {
  if (activeBlasts.get(username)) {
    throw new Error('A blast is already in progress');
  }

  activeBlasts.set(username, { sessionId, cancelled: false, username });

  // Validate and set default delays
  const minDelay = Math.max(parseInt(delayMin) || 3000, 1000); // Min 1 second
  const maxDelay = Math.max(parseInt(delayMax) || 7000, minDelay); // Max at least same as min

  // Update session status with current local time
  const now = new Date().toISOString();
  await updateSession(sessionId, { status: 'running', started_at: now });

  emitToUser(username, 'blast:started', { sessionId, total: contacts.length });

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < contacts.length; i++) {
    // Check if blast was cancelled
    const activeState = activeBlasts.get(username);
    if (!activeState || activeState.cancelled) {
      await updateSession(sessionId, { status: 'cancelled', completed_at: new Date().toISOString() });
      emitToUser(username, 'blast:cancelled', { sessionId });
      activeBlasts.delete(username);
      return;
    }

    const contact = contacts[i];
    let personalizedMessage = processTemplate(message, contact);
    
    // Append link as footer if provided
    if (link && link.trim()) {
      personalizedMessage += `\n\n${link}`;
    }
    
    let retries = 0;
    let messageSent = false;
    let lastError = null;

    // Prepare optional bandit recommendation (non-blocking if disabled)
    let banditEventId = null;
    if (process.env.BANDIT_ENABLED === 'true' && policyId) {
      try {
        // build simple context from contact
        const createdDate = new Date(contact.created_at);
        const recencyDays = Math.max(Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)), 0);
        const sentCountRow = db.prepare(`SELECT COUNT(*) AS total_sent FROM blast_logs WHERE phone = ? AND status = 'sent'`).get(contact.phone);
        const message_count = Number(sentCountRow?.total_sent || 0);
        const context = {
          recency_days: recencyDays,
          message_count,
          cluster_id: contact.cluster_id >= 0 ? contact.cluster_id : -1,
          hour: new Date().getHours(),
          day: new Date().getDay()
        };

        const normPhone = normalizePhone(contact.phone);
        const rec = await banditService.recommend(policyId, context, sessionId, normPhone);
        banditEventId = rec.eventId;
        emitToUser(username, 'bandit:recommend', { sessionId, phone: normPhone, arm: rec.arm, eventId: banditEventId });
      } catch (err) {
        console.error('Bandit recommend failed:', err?.message || err);
      }
    }

    // Retry logic for timeout/unstable connection
    while (retries <= MAX_RETRIES && !messageSent) {
      try {
        let waMessage = null;
        // Send message with timeout protection
        if (mediaPath) {
          waMessage = await sendWithTimeout(() => sendMessageWithMedia(contact.phone, personalizedMessage, mediaPath, username));
        } else {
          waMessage = await sendWithTimeout(() => sendMessage(contact.phone, personalizedMessage, username));
        }
        
        sent++;
        messageSent = true;

        const logTime = new Date().toISOString();
        await insertBlastLog({
          session_id: sessionId,
          phone: contact.phone,
          name: contact.name,
          status: 'sent',
          sent_at: logTime,
        });

        // Auto-apply reward for bandit: message was successfully sent
        if (banditEventId) {
          try {
            registerSentBanditEvent(waMessage, banditEventId, contact.phone);
            const waAliases = [
              String(waMessage?.to || '').replace(/[^\d]/g, ''),
              String(waMessage?.id?.remote || '').replace(/[^\d]/g, ''),
            ].filter(Boolean);
            await banditService.attachWhatsAppMetadata(banditEventId, {
              wa_message_id: waMessage?.id?._serialized || waMessage?.id?.id || null,
              wa_aliases: waAliases,
            });
          } catch (mapErr) {
            console.warn('Failed to register sent message mapping:', mapErr?.message);
          }
          try {
            // Try to auto-reward with 'sent' status (0.5 base reward + bonuses if applicable)
            await banditService.updateEventDeliveryStatus(banditEventId, 'sent', 0, 0);
          } catch (err) {
            console.warn('Failed to auto-reward bandit event:', err?.message);
          }
          emitToUser(username, 'bandit:event', { eventId: banditEventId, phone: contact.phone });
        }

        emitToUser(username, 'blast:progress', {
          sessionId,
          current: i + 1,
          total: contacts.length,
          sent,
          failed,
          phone: contact.phone,
          name: contact.name,
          status: 'sent'
        });

      } catch (err) {
        lastError = err;
        retries++;

        const isContextError = err.message.includes('Execution context was destroyed') || 
                             err.message.includes('Target closed') ||
                             err.message.includes('Session closed') ||
                             err.message.includes('Navigation failed');
        
        const isTimeoutError = err.message.includes('timeout');
        const isRegistrationError = err.message.includes('not registered on WhatsApp');

        // Retry logic for specific errors
        if (retries <= MAX_RETRIES && (isContextError || isTimeoutError)) {
          console.log(`Retry ${retries}/${MAX_RETRIES} for ${contact.phone}: ${err.message}`);
          
          emitToUser(username, 'blast:retry', {
            sessionId,
            phone: contact.phone,
            retry: retries,
            maxRetries: MAX_RETRIES,
            errorType: isContextError ? 'connection_lost' : 'timeout'
          });

          // Wait longer for context errors (browser recovery time)
          const delayTime = isContextError ? CONTEXT_ERROR_DELAY : RETRY_DELAY;
          await sleep(delayTime);
          continue;
        }

        // Max retries exceeded or non-recoverable error
        failed++;
        messageSent = true; // Exit retry loop

        const failedLogTime = new Date().toISOString();
        await insertBlastLog({
          session_id: sessionId,
          phone: contact.phone,
          name: contact.name,
          status: 'failed',
          error_message: err.message,
          sent_at: failedLogTime,
        });

        // Auto-apply penalty reward for bandit: message failed
        if (banditEventId) {
          try {
            await banditService.updateEventDeliveryStatus(banditEventId, 'failed', 0, 0);
          } catch (errBandit) {
            console.warn('Failed to record bandit penalty:', errBandit?.message);
          }
        }

        emitToUser(username, 'blast:progress', {
          sessionId,
          current: i + 1,
          total: contacts.length,
          sent,
          failed,
          phone: contact.phone,
          name: contact.name,
          status: 'failed',
          error: err.message,
          errorType: isContextError ? 'connection_lost' : (isTimeoutError ? 'timeout' : 'send_error'),
          retry: retries > 1 ? retries - 1 : 0
        });
      }
    }

    // Update session counters after each message
    await updateSession(sessionId, { sent, failed });

    // Delay between messages (skip delay after last message)
    if (i < contacts.length - 1) {
      const delay = randomDelay(minDelay, maxDelay);
      emitToUser(username, 'blast:waiting', { delay, next: i + 2 });
      await sleep(delay);
    }
  }

  // Mark session as completed
  const completedTime = new Date().toISOString();
  await updateSession(sessionId, { status: 'completed', completed_at: completedTime, sent, failed });

  // After completing, check queue for next session and start it if present
  try {
    const nextRow = db.prepare(`SELECT q.session_id, q.payload FROM blast_queue q LEFT JOIN blast_sessions s ON s.id=q.session_id WHERE s.scheduled_at IS NULL OR s.scheduled_at <= CURRENT_TIMESTAMP ORDER BY q.queued_at LIMIT 1`).get();
    if (nextRow) {
      // Remove from queue
      db.prepare(`DELETE FROM blast_queue WHERE session_id=?`).run(nextRow.session_id);

      // Parse payload and reconstruct parameters
      let payload = {};
      try { payload = JSON.parse(nextRow.payload || '{}'); } catch (e) { console.error('Failed to parse queued payload', e); }

      // Fetch contacts for next session
      let nextContacts = [];
      if (payload.contact_ids && payload.contact_ids.length > 0) {
        const placeholders = payload.contact_ids.map(() => '?').join(',');
        nextContacts = db.prepare(`SELECT * FROM contacts WHERE id IN (${placeholders})`).all(...payload.contact_ids);
      } else if (payload.group_name) {
        nextContacts = db.prepare('SELECT * FROM contacts WHERE group_name=?').all(payload.group_name);
      }

      // Update session status to running and start
      const startedTime = new Date().toISOString();
      db.prepare(`UPDATE blast_sessions SET status='running', started_at=? WHERE id=?`).run(startedTime, nextRow.session_id);
      // Start next blast asynchronously
      startBlast(nextRow.session_id, nextContacts, db.prepare('SELECT message FROM blast_sessions WHERE id=?').get(nextRow.session_id).message, payload.delay_min, payload.delay_max, payload.mediaPath || null, payload.username || 'default', payload.policy_id, payload.link || null).catch(console.error);
    }
  } catch (err) {
    console.error('Failed to process blast queue:', err);
  }

  // Cleanup: hapus file media jika ada
  if (mediaPath && fs.existsSync(mediaPath)) {
    try {
      fs.unlinkSync(mediaPath);
      console.log(`Media file deleted: ${mediaPath}`);
    } catch (err) {
      console.error(`Failed to delete media file: ${err.message}`);
    }
  }

  emitToUser(username, 'blast:completed', { sessionId, sent, failed, total: contacts.length });
  activeBlasts.delete(username);
}

function cancelBlast(username = 'default') {
  const activeBlast = activeBlasts.get(username);
  if (activeBlast) {
    const sessionId = activeBlast.sessionId;
    activeBlast.cancelled = true;
    
    // Langsung update database status ke cancelled
    const cancelledTime = new Date().toISOString();
    updateSession(sessionId, { status: 'cancelled', completed_at: cancelledTime }).catch(() => {});
    
    // Emit event ke frontend
    if (io) {
      emitToUser(username, 'blast:cancelled', { sessionId });
    }
    
    // Reset activeBlast immediately
    activeBlasts.delete(username);
    return true;
  }
  return false;
}

function getActiveBlast(username = 'default') {
  return activeBlasts.get(username) || null;
}

function scheduleSession(sessionId, payload, scheduledAt) {
  // Clear existing timer if present
  if (scheduledTimers.has(sessionId)) {
    clearTimeout(scheduledTimers.get(sessionId));
    scheduledTimers.delete(sessionId);
  }

  const when = new Date(scheduledAt).getTime();
  let delay = when - Date.now();
  if (isNaN(when) || delay < 0) delay = 0;

  const t = setTimeout(async () => {
    scheduledTimers.delete(sessionId);
    try {
      // If another blast is active for the user, enqueue instead
      const db = require('../db/database');
      // read persisted payload if present
      let payloadObj = payload || {};
      try {
        const qrow = await db.get('SELECT payload FROM blast_queue WHERE session_id=?', [sessionId]);
        if (qrow && qrow.payload) {
          payloadObj = JSON.parse(qrow.payload);
        }
      } catch (e) {
        // ignore parse errors
      }

      const username = payloadObj.username || 'default';
      if (getActiveBlast(username)) {
        // mark as queued and leave payload in blast_queue for later processing
        try {
          await db.run(`UPDATE blast_sessions SET status='queued' WHERE id=?`, [sessionId]);
        } catch (err) {
          console.error('Failed to mark scheduled session queued:', err?.message || err);
        }
        return;
      }

      // No active blast: remove payload from queue (if any) and start
      try {
        await db.run('DELETE FROM blast_queue WHERE session_id=?', [sessionId]);
      } catch (e) {
        // ignore
      }

      // reconstruct contacts
      let contacts = [];
      if (payloadObj.contact_ids && payloadObj.contact_ids.length > 0) {
        const placeholders = payloadObj.contact_ids.map(() => '?').join(',');
        contacts = await db.all(`SELECT * FROM contacts WHERE id IN (${placeholders})`, payloadObj.contact_ids);
      } else if (payloadObj.group_name) {
        contacts = await db.all('SELECT * FROM contacts WHERE group_name=?', [payloadObj.group_name]);
      }

      const sessionRow = await db.get('SELECT message FROM blast_sessions WHERE id=?', [sessionId]);
      const message = sessionRow ? sessionRow.message : '';

      // mark session running
      const scheduledStartTime = new Date().toISOString();
      await db.run(`UPDATE blast_sessions SET status='running', started_at=? WHERE id=?`, [scheduledStartTime, sessionId]);

      // start blast async
      startBlast(sessionId, contacts, message, payloadObj.delay_min, payloadObj.delay_max, payloadObj.mediaPath || null, payloadObj.username || 'default', payloadObj.policy_id, payloadObj.link || null).catch(console.error);
    } catch (err) {
      console.error('Error executing scheduled session:', err?.message || err);
    }
  }, delay);

  scheduledTimers.set(sessionId, t);
}

async function initScheduledSessions() {
  try {
    const rows = await db.all(
      `SELECT id, scheduled_at FROM blast_sessions WHERE status='scheduled' AND scheduled_at IS NOT NULL`
    );
    for (const r of rows) {
      try {
        scheduleSession(r.id, JSON.parse('{}'), r.scheduled_at);
      } catch (err) {
        // fallback: if scheduled_at is invalid, try to start immediately
        console.error('Failed to schedule session on startup', r.id, err?.message || err);
      }
    }
  } catch (err) {
    console.error('Failed to initialize scheduled sessions:', err?.message || err);
  }
}

module.exports = { startBlast, cancelBlast, getActiveBlast, setIO, scheduleSession, initScheduledSessions };
