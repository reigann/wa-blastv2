const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const db = require('../db/database');
const banditService = require('./banditService');

let io = null;

const userStates = new Map();
const messageBanditMap = new Map(); // messageId -> { eventId, phone, createdAt }
const jidAliasToPhoneMap = new Map(); // normalized jid alias -> normalized phone
const jidAliasToEventMap = new Map(); // normalized jid alias -> { eventId, createdAt }

function cleanupTrackingMaps() {
  const now = Date.now();
  const ttlMs = 72 * 60 * 60 * 1000; // 72h

  for (const [key, value] of messageBanditMap.entries()) {
    if (!value?.createdAt || (now - value.createdAt) > ttlMs) messageBanditMap.delete(key);
  }
  for (const [key, value] of jidAliasToPhoneMap.entries()) {
    if (!value?.createdAt || (now - value.createdAt) > ttlMs) jidAliasToPhoneMap.delete(key);
  }
  for (const [key, value] of jidAliasToEventMap.entries()) {
    if (!value?.createdAt || (now - value.createdAt) > ttlMs) jidAliasToEventMap.delete(key);
  }
}

function normalizePhoneDigits(phone) {
  const digits = String(phone || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (!digits.startsWith('62')) return `62${digits}`;
  return digits;
}

function normalizeRawDigits(value) {
  return String(value || '').replace(/[^\d]/g, '');
}

function normalizeJidAlias(value) {
  return String(value || '')
    .replace(/@c\.us$/i, '')
    .replace(/@g\.us$/i, '')
    .replace(/@lid$/i, '')
    .replace(/@.*$/i, '')
    .replace(/[^\d]/g, '');
}

function registerJidAlias(alias, phone) {
  const aliasKey = normalizeJidAlias(alias);
  const phoneDigits = normalizePhoneDigits(phone);
  if (!aliasKey || !phoneDigits) return;
  jidAliasToPhoneMap.set(aliasKey, { phone: phoneDigits, createdAt: Date.now() });
}

function registerJidEventAlias(alias, eventId) {
  const aliasKey = normalizeJidAlias(alias);
  if (!aliasKey || !eventId) return;
  jidAliasToEventMap.set(aliasKey, { eventId: Number(eventId), createdAt: Date.now() });
}

function mapIncomingToKnownPhone(value) {
  const aliasKey = normalizeJidAlias(value);
  if (!aliasKey) return '';
  const hit = jidAliasToPhoneMap.get(aliasKey);
  if (hit?.phone) return hit.phone;

  // If incoming is a lid alias and not mapped yet, don't treat it as a phone number.
  if (String(value || '').includes('@lid')) return '';
  return normalizePhoneDigits(value);
}

function getMostRecentTrackedPhone() {
  let latest = null;
  for (const item of messageBanditMap.values()) {
    if (!item?.phone || !item?.createdAt) continue;
    if (!latest || item.createdAt > latest.createdAt) latest = item;
  }
  return latest?.phone || '';
}

function findEventIdByJidAlias(value) {
  const aliasKey = normalizeJidAlias(value);
  if (!aliasKey) return null;
  const hit = jidAliasToEventMap.get(aliasKey);
  return hit?.eventId || null;
}

function registerSentBanditEvent(messageObj, eventId, phone) {
  cleanupTrackingMaps();
  const phoneDigits = normalizePhoneDigits(phone);
  if (!messageObj || !eventId || !phoneDigits) return;

  const messageId = messageObj?.id?._serialized || messageObj?.id?.id || null;
  if (messageId) {
    messageBanditMap.set(String(messageId), { eventId: Number(eventId), phone: phoneDigits, createdAt: Date.now() });
  }

  registerJidAlias(messageObj?.to, phoneDigits);
  registerJidAlias(messageObj?.from, phoneDigits);
  registerJidAlias(messageObj?.id?.remote, phoneDigits);
  registerJidAlias(messageObj?.author, phoneDigits);
  registerJidEventAlias(messageObj?.to, eventId);
  registerJidEventAlias(messageObj?.id?.remote, eventId);
}

function roomForUser(username) {
  return `user:${username}`;
}

function sanitizeClientId(username) {
  return String(username || 'default')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .slice(0, 40);
}

function getState(username, createIfMissing = true) {
  const key = String(username || 'default');
  let state = userStates.get(key);

  if (!state && createIfMissing) {
    state = {
      username: key,
      status: 'disconnected',
      qr: null,
      client: null,
      isInitializing: false,
      reconnectTimer: null,
    };
    userStates.set(key, state);
  }

  return state || null;
}

function emitStatus(username) {
  if (!io) return;
  const state = getState(username, false);
  const status = state?.status || 'disconnected';
  io.to(roomForUser(username)).emit('wa:status', status);
  if (state?.qr) {
    io.to(roomForUser(username)).emit('wa:qr', state.qr);
  }
}

function extractPhoneFromClient(client) {
  try {
    if (!client) return null;
    const me = client.info && client.info.me ? client.info.me : null;
    if (!me) return null;

    if (typeof me === 'string') return me.replace('@c.us', '');
    if (me._serialized) return String(me._serialized).replace('@c.us', '');
    if (me.id && me.id.user) return String(me.id.user).replace('@c.us', '');
    if (me.user) return String(me.user).replace('@c.us', '');

    return null;
  } catch (err) {
    console.warn('[WA] extractPhoneFromClient error:', err?.message);
    return null;
  }
}

function scheduleReconnect(username, delay = 5000) {
  const state = getState(username);
  if (state.reconnectTimer) return;

  console.warn(`[WA] Scheduling reconnect for ${username} in ${delay}ms`);
  state.reconnectTimer = setTimeout(async () => {
    state.reconnectTimer = null;
    await ensureWhatsAppClient(username);
  }, delay);
}

async function cleanupClient(username) {
  const state = getState(username);
  if (!state.client) return;

  try {
    await state.client.destroy();
  } catch (err) {
    // FIX 2: log instead of silently ignore
    console.warn('[WA] cleanupClient destroy error:', err?.message);
  }

  state.client = null;
}

// FIX 1: message handler extracted outside of 'ready' to prevent duplicate listeners on reconnect
function registerMessageHandlers(client, username) {
  client.on('message', async (msg) => {
    try {
      if (!msg) return;
      if (msg.fromMe) return;

      let sender = msg.from || null;
      if (sender && sender.endsWith('@g.us') && msg.author) {
        sender = msg.author;
      }
      if (!sender) return;
      if (sender === 'status@broadcast') return;
      let matchedSenderPhone = mapIncomingToKnownPhone(sender);
      if (!matchedSenderPhone || String(matchedSenderPhone).length < 8) {
        matchedSenderPhone = getMostRecentTrackedPhone();
      }

      const text = (msg.body || '').trim();

      try {
        db.prepare(`INSERT INTO blast_interactions (session_id, phone, action_type, payload) VALUES (?, ?, ?, ?)`)
          .run(null, sender, 'reply', JSON.stringify({ text }));
      } catch (e) {
        console.warn('[WA] blast_interactions insert error:', e?.message);
      }

      try {
        const keywords = {
          'Teknik Informatika': ['informatika', 'ti', 'teknik informatika', 'programming', 'coding'],
          'Manajemen': ['manajemen', 'bisnis', 'management'],
          'Akuntansi': ['akuntansi', 'accounting'],
          'Teknik Elektro': ['elektro', 'elektronika', 'teknik elektro'],
          'Sistem Informasi': ['sistem informasi', 'si'],
        };

        const lower = text.toLowerCase();
        const scores = {};
        Object.entries(keywords).forEach(([dept, keys]) => {
          scores[dept] = keys.reduce((acc, k) => acc + (lower.includes(k) ? 1 : 0), 0);
        });

        const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
        if (best && best[1] > 0) {
          const inferred = best[0];
          const phonePlain = sender.replace('@c.us', '');
          db.prepare(`UPDATE contacts SET minat_prodi=? WHERE phone LIKE ?`).run(inferred, `%${phonePlain}%`);
        }
      } catch (e) {
        console.warn('[WA] minat_prodi inference error:', e?.message);
      }

      const eventIdByAlias = findEventIdByJidAlias(sender);
      if (eventIdByAlias) {
        try {
          await banditService.updateEventDeliveryStatus(eventIdByAlias, 'delivered', 1, 1);
          console.log(`[Bandit] Reply mapped by alias to event ${eventIdByAlias}`);
          return;
        } catch (err) {
          console.warn(`[Bandit] Alias->event update failed (${eventIdByAlias}), fallback to phone lookup:`, err?.message);
        }
      }

      const aliasEvents = await banditService.findRecentEventsByWaAlias(sender, { hours: 48, limit: 5 });
      if (aliasEvents.length > 0) {
        const ev = aliasEvents[0];
        try {
          await banditService.updateEventDeliveryStatus(ev.id, 'delivered', 1, 1);
          console.log(`[Bandit] Reply mapped by Firestore alias to event ${ev.id}`);
          return;
        } catch (err) {
          console.warn(`[Bandit] Firestore alias update failed (${ev.id}), fallback to phone lookup:`, err?.message);
        }
      }

      // Find recent pending bandit events in Firebase for this sender
      const rows = await banditService.findRecentEventsByPhone(matchedSenderPhone, {
        hours: 48,
        onlyPendingReward: false,
        limit: 20,
      });

      if (!rows || rows.length === 0) {
        console.log(`[Bandit] No pending events found for reply from: ${sender} (mapped: ${matchedSenderPhone || '-'})`);
        return;
      }

      console.log(`[Bandit] Found ${rows.length} pending events for reply from: ${sender} (mapped: ${matchedSenderPhone || '-'})`);

      const windowHours = Number(process.env.BANDIT_FEEDBACK_WINDOW_HOURS) || 24;
      const now = Date.now();

      for (const ev of rows) {
        const created = new Date(ev.created_at);
        const hours = (now - created.getTime()) / (1000 * 60 * 60);
        if (hours <= windowHours) {
          try {
            console.log(`[Bandit] Processing reply for event ${ev.id}`);
            const currentDelivery =
              ev.delivery_status === 'failed'
                ? 'failed'
                : ev.delivery_status === 'delivered' || ev.delivery_status === 'sent'
                  ? ev.delivery_status
                  : 'delivered';
            const readStatus = Number(ev.read_status) === 1 ? 1 : 0;
            const res = await banditService.updateEventDeliveryStatus(ev.id, currentDelivery, readStatus, 1);
            console.log(`[Bandit] Event ${ev.id} auto-rewarded for reply`);
            if (io) io.to(roomForUser(username)).emit('bandit:auto_feedback', { eventId: ev.id, phone: sender, reward: 1, result: res });
          } catch (err) {
            console.error('[Bandit] feedback error:', err?.message || err);
          }
        }
      }
    } catch (err) {
      console.error('[WA] Auto-feedback listener error:', err?.message || err);
    }
  });

  client.on('message_ack', async (msg, ack) => {
    try {
      if (!msg || !msg.to) return;

      cleanupTrackingMaps();
      const messageId = msg?.id?._serialized || msg?.id?.id || null;
      const mappedFromMessage = messageId ? messageBanditMap.get(String(messageId)) : null;

      const toRaw = msg.to;
      const to = mapIncomingToKnownPhone(toRaw);
      console.log(`[Bandit] Message ACK - phone: ${toRaw}, mapped: ${to}, ack level: ${ack}`);

      if (mappedFromMessage?.phone) {
        registerJidAlias(toRaw, mappedFromMessage.phone);
        if (msg?.id?.remote) registerJidAlias(msg.id.remote, mappedFromMessage.phone);
      }

      let events = [];
      if (mappedFromMessage?.eventId) {
        events = [{ id: mappedFromMessage.eventId, read_status: ack >= 3 ? 1 : 0, reply_received: 0 }];
      } else {
        events = await banditService.findRecentEventsByPhone(to, {
          hours: 48,
          onlyPendingReward: false,
          limit: 5,
        });
      }

      if (events.length === 0) {
        console.log(`[Bandit] No recent events found for phone: ${to}`);
        return;
      }

      console.log(`[Bandit] Found ${events.length} events for phone: ${to}`);

      for (const ev of events) {
        console.log(`[Bandit] Updating event ${ev.id} - ack: ${ack}`);
        registerJidEventAlias(toRaw, ev.id);
        if (msg?.id?.remote) registerJidEventAlias(msg.id.remote, ev.id);
        try {
          const aliases = [normalizeRawDigits(toRaw), normalizeRawDigits(msg?.id?.remote)].filter(Boolean);
          await banditService.attachWhatsAppMetadata(ev.id, {
            wa_message_id: messageId ? String(messageId) : null,
            wa_aliases: aliases,
          });
        } catch (metaErr) {
          console.warn('[Bandit] Failed to attach WhatsApp metadata:', metaErr?.message);
        }

        if (ack >= 2) {
          console.log(`[Bandit] Event ${ev.id} marked as delivered`);
          const replyStatus = Number(ev.reply_received) === 1 ? 1 : 0;
          await banditService.updateEventDeliveryStatus(ev.id, 'delivered', Number(ev.read_status) === 1 ? 1 : 0, replyStatus);
        }
        if (ack >= 3) {
          console.log(`[Bandit] Event ${ev.id} marked as read`);
          const replyStatus = Number(ev.reply_received) === 1 ? 1 : 0;
          await banditService.updateEventDeliveryStatus(ev.id, 'delivered', 1, replyStatus);
          console.log(`[Bandit] Event ${ev.id} auto-rewarded for read`);
        }
      }
    } catch (err) {
      console.error('[Bandit] Message ack listener error:', err?.message || err);
    }
  });
}

async function ensureWhatsAppClient(username) {
  const state = getState(username);

  if (state.client && (state.status === 'connected' || state.status === 'connecting' || state.status === 'qr')) {
    return state.client;
  }

  if (state.isInitializing) {
    return state.client;
  }

  state.isInitializing = true;
  await cleanupClient(username);
  state.status = 'connecting';
  state.qr = null;
  emitStatus(username);

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: `wa-${sanitizeClientId(username)}` }),
    puppeteer: {
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    },
  });

  state.client = client;

  client.on('qr', async (qr) => {
    state.status = 'qr';
    state.qr = await qrcode.toDataURL(qr);
    emitStatus(username);
  });

  client.on('loading_screen', () => {
    console.log(`[WA] Loading screen for ${username}`);
    state.status = 'connecting';
    emitStatus(username);
  });

  client.on('authenticated', () => {
    console.log(`[WA] Authenticated for ${username}`);
    state.status = 'connecting';
    state.qr = null;
    emitStatus(username);
  });

  client.on('ready', () => {
    console.log(`[WA] Client ready for ${username}`);
    state.status = 'connected';
    state.qr = null;
    emitStatus(username);
    const phone = extractPhoneFromClient(client);
    if (io) {
      io.to(roomForUser(username)).emit('wa:ready', { message: 'WhatsApp connected successfully!', phone });
    }
  });

  // FIX 1: register message handlers once here, NOT inside 'ready'
  registerMessageHandlers(client, username);

  client.on('error', (err) => {
    // FIX 2: log the actual error instead of silently ignoring
    console.error(`[WA] Client error for ${username}:`, err?.message || err);
    state.status = 'disconnected';
    state.qr = null;
    emitStatus(username);
    scheduleReconnect(username, 3000);
  });

  client.on('auth_failure', (msg) => {
    // FIX 2: log auth failure reason
    console.error(`[WA] Auth failure for ${username}:`, msg);
    state.status = 'disconnected';
    state.qr = null;
    emitStatus(username);
    scheduleReconnect(username, 5000);
  });

  client.on('disconnected', (reason) => {
    // FIX 2: log disconnect reason
    console.warn(`[WA] Client disconnected for ${username}. Reason:`, reason);
    state.status = 'disconnected';
    state.qr = null;
    emitStatus(username);
    if (io) {
      io.to(roomForUser(username)).emit('wa:disconnected', { reason });
    }
    scheduleReconnect(username, 5000);
  });

  try {
    await client.initialize();
  } catch (err) {
    const message = (err && err.message) ? String(err.message) : String(err);
    const lower = message.toLowerCase();
    // FIX 2: log initialize errors
    console.error(`[WA] client.initialize error for ${username}:`, message);
    if (
      lower.includes('execution context was destroyed') ||
      lower.includes('target closed') ||
      lower.includes('session closed') ||
      lower.includes('navigation failed') ||
      lower.includes('detached frame') ||
      lower.includes('attempted to use detached frame')
    ) {
      state.status = 'connecting';
      emitStatus(username);
    } else {
      state.status = 'disconnected';
      state.qr = null;
      emitStatus(username);
      scheduleReconnect(username, 5000);
    }
  } finally {
    state.isInitializing = false;
  }

  return state.client;
}

function setSocketServer(socketIo) {
  io = socketIo;
}

function getStatus(username) {
  const state = getState(username, false);
  if (!state) return { status: 'disconnected', qr: null };

  const basic = { status: state.status, qr: state.qr };
  try {
    if (state.client && state.status === 'connected') {
      const phone = extractPhoneFromClient(state.client);
      if (phone) basic.phone = phone;
    }
  } catch (err) {
    console.warn('[WA] getStatus phone extraction error:', err?.message);
  }
  return basic;
}

function getClient(username) {
  return getState(username, false)?.client || null;
}

function normalizePhone(phone) {
  let formatted = String(phone || '').replace(/\D/g, '');
  if (formatted.startsWith('0')) {
    formatted = `62${formatted.slice(1)}`;
  } else if (!formatted.startsWith('62')) {
    formatted = `62${formatted}`;
  }
  return `${formatted}@c.us`;
}

async function ensureConnectedClient(username) {
  await ensureWhatsAppClient(username);
  const state = getState(username);
  if (!state.client || state.status !== 'connected') {
    throw new Error('WhatsApp client is not connected. Please scan QR first.');
  }
  return state.client;
}

async function sendMessage(phone, message, username) {
  const client = await ensureConnectedClient(username);
  const chatId = normalizePhone(phone);

  try {
    const checkPromise = client.isRegisteredUser(chatId);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Registration check timeout')), 15000));
    const isRegistered = await Promise.race([checkPromise, timeoutPromise]);
    if (!isRegistered) {
      throw new Error(`Number ${phone} is not registered on WhatsApp`);
    }
  } catch (err) {
    // FIX 2: log registration check failure instead of silently continuing
    console.warn(`[WA] isRegisteredUser check failed for ${phone}:`, err?.message);
  }

  try {
    const sentMessage = await client.sendMessage(chatId, message);
    console.log(`[WA] Message sent to ${phone}`);
    return sentMessage;
  } catch (err) {
    console.error(`[WA] sendMessage failed for ${phone}:`, err?.message);
    throw err;
  }
}

async function sendMessageWithMedia(phone, message, mediaPath, username) {
  const client = await ensureConnectedClient(username);
  const chatId = normalizePhone(phone);

  try {
    const checkPromise = client.isRegisteredUser(chatId);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Registration check timeout')), 15000));
    const isRegistered = await Promise.race([checkPromise, timeoutPromise]);
    if (!isRegistered) {
      throw new Error(`Number ${phone} is not registered on WhatsApp`);
    }
  } catch (err) {
    // FIX 2: log registration check failure
    console.warn(`[WA] isRegisteredUser check failed for ${phone}:`, err?.message);
  }

  try {
    const media = mediaPath.startsWith('http')
      ? await MessageMedia.fromUrl(mediaPath, { unsafeMime: true })
      : MessageMedia.fromFilePath(mediaPath);

    const sentMessage = await client.sendMessage(chatId, media, { caption: message || '' });
    console.log(`[WA] Media message sent to ${phone}`);
    return sentMessage;
  } catch (err) {
    console.error(`[WA] sendMessageWithMedia failed for ${phone}:`, err?.message);
    throw err;
  }
}

async function logout(username) {
  const state = getState(username, false);
  if (!state) return;

  try {
    if (state.client) {
      await state.client.logout();
      await state.client.destroy();
    }
  } catch (err) {
    // FIX 2: log logout errors
    console.warn(`[WA] logout error for ${username}:`, err?.message);
  }

  state.client = null;
  state.qr = null;
  state.status = 'disconnected';
  console.log(`[WA] Logged out: ${username}`);
  emitStatus(username);
}

async function destroyAllClients() {
  for (const [username, state] of userStates.entries()) {
    try {
      if (state.reconnectTimer) {
        clearTimeout(state.reconnectTimer);
        state.reconnectTimer = null;
      }
      if (state.client) {
        await state.client.destroy();
      }
    } catch (err) {
      // FIX 2: log destroy errors
      console.warn(`[WA] destroyAllClients error for ${username}:`, err?.message);
    }
    state.client = null;
    state.qr = null;
    state.status = 'disconnected';
    emitStatus(username);
  }
}

module.exports = {
  initWhatsApp: setSocketServer,
  setSocketServer,
  ensureWhatsAppClient,
  getClient,
  getStatus,
  sendMessage,
  sendMessageWithMedia,
  logout,
  normalizePhone,
  roomForUser,
  destroyAllClients,
  registerSentBanditEvent,
};
