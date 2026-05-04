const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const db = require('../db/database');
const banditService = require('./banditService');

let io = null;

const userStates = new Map();

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
  // Emit basic status string for backward compatibility
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

    // me may be an object or string; attempt common shapes
    if (typeof me === 'string') {
      return me.replace('@c.us', '');
    }

    if (me._serialized) {
      return String(me._serialized).replace('@c.us', '');
    }

    if (me.id && me.id.user) {
      return String(me.id.user).replace('@c.us', '');
    }

    if (me.user) {
      return String(me.user).replace('@c.us', '');
    }

    return null;
  } catch (err) {
    return null;
  }
}

function scheduleReconnect(username, delay = 5000) {
  const state = getState(username);
  if (state.reconnectTimer) return;

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
    // ignore destroy errors
  }

  state.client = null;
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
    state.status = 'connecting';
    emitStatus(username);
  });

  client.on('authenticated', () => {
    state.status = 'connecting';
    state.qr = null;
    emitStatus(username);
  });

  client.on('ready', () => {
    state.status = 'connected';
    state.qr = null;
    emitStatus(username);
    const phone = extractPhoneFromClient(client);
    if (io) {
      io.to(roomForUser(username)).emit('wa:ready', { message: 'WhatsApp connected successfully!', phone });
    }
    // Auto-feedback + interaction logging: listen to incoming messages and submit reward to bandit
    client.on('message', async (msg) => {
      try {
        if (!msg) return;
        // ignore messages sent by this client
        if (msg.fromMe) return;

        // Determine sender (handle group messages)
        let sender = msg.from || null;
        if (sender && sender.endsWith('@g.us') && msg.author) {
          sender = msg.author;
        }
        if (!sender) return;

        const text = (msg.body || '').trim();

        // Log interaction into blast_interactions for later analysis
        try {
          db.prepare(`INSERT INTO blast_interactions (session_id, phone, action_type, payload) VALUES (?, ?, ?, ?)`)
            .run(null, sender, 'reply', JSON.stringify({ text }));
        } catch (e) {
          // ignore insert errors
        }

        // Simple keyword-based inference to update contacts.minat_prodi
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

          // pick highest score >0
          const best = Object.entries(scores).sort((a,b)=>b[1]-a[1])[0];
          if (best && best[1] > 0) {
            const inferred = best[0];
            // update contacts table if phone exists
            const phonePlain = sender.replace('@c.us','');
            db.prepare(`UPDATE contacts SET minat_prodi=? WHERE phone LIKE ?`).run(inferred, `%${phonePlain}%`);
          }
        } catch (e) {
          // ignore inference errors
        }

        // Find pending bandit events for this phone
        const rows = db.prepare('SELECT * FROM bandit_events WHERE phone = ? AND reward IS NULL ORDER BY created_at DESC').all(sender);
        if (!rows || rows.length === 0) return;

        const windowHours = Number(process.env.BANDIT_FEEDBACK_WINDOW_HOURS) || 24;
        const now = Date.now();

        for (const ev of rows) {
          const created = new Date(ev.created_at);
          const hours = (now - created.getTime()) / (1000 * 60 * 60);
          if (hours <= windowHours) {
            try {
              const res = await banditService.feedback(ev.id, 1);
              if (io) io.to(roomForUser(username)).emit('bandit:auto_feedback', { eventId: ev.id, phone: sender, reward: 1, result: res });
            } catch (err) {
              console.error('bandit feedback error:', err?.message || err);
            }
          }
        }

      } catch (err) {
        console.error('Auto-feedback listener error:', err?.message || err);
      }
    });
  });

  client.on('error', (err) => {
    state.status = 'disconnected';
    state.qr = null;
    emitStatus(username);
    scheduleReconnect(username, 3000);
  });

  client.on('auth_failure', () => {
    state.status = 'disconnected';
    state.qr = null;
    emitStatus(username);
    scheduleReconnect(username, 5000);
  });

  client.on('disconnected', (reason) => {
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
  if (!state) {
    return { status: 'disconnected', qr: null };
  }
  const basic = { status: state.status, qr: state.qr };
  // include phone number when connected (best-effort)
  try {
    if (state.client && state.status === 'connected') {
      const phone = extractPhoneFromClient(state.client);
      if (phone) basic.phone = phone;
    }
  } catch (err) {
    // ignore
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
    // continue and let sendMessage decide
  }

  await client.sendMessage(chatId, message);
  return true;
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
    // continue and let sendMessage decide
  }

  const media = mediaPath.startsWith('http')
    ? await MessageMedia.fromUrl(mediaPath, { unsafeMime: true })
    : MessageMedia.fromFilePath(mediaPath);

  await client.sendMessage(chatId, media, { caption: message || '' });
  return true;
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
    // ignore
  }

  state.client = null;
  state.qr = null;
  state.status = 'disconnected';
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
      // ignore cleanup errors
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
};
