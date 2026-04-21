const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

let client = null;
let clientStatus = 'disconnected'; // disconnected | qr | connecting | connected
let currentQR = null;
let io = null;
let reconnectTimer = null;
let isInitializing = false;

function emitStatus() {
  if (io) {
    io.emit('wa:status', clientStatus);
  }
}

function scheduleReconnect(delay = 5000) {
  if (!io) return;
  if (reconnectTimer) return;

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    await initWhatsApp(io);
  }, delay);
}

async function cleanupClient() {
  if (!client) return;

  try {
    await client.destroy();
  } catch (err) {
    console.error('Failed to destroy WhatsApp client:', err.message);
  }

  client = null;
}

async function initWhatsApp(socketIo) {
  io = socketIo;

  if (isInitializing) {
    return;
  }

  isInitializing = true;

  await cleanupClient();
  clientStatus = 'connecting';
  emitStatus();

  client = new Client({
    authStrategy: new LocalAuth({ clientId: 'wa-blaster' }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    }
  });

  client.on('qr', async (qr) => {
    console.log('QR RECEIVED');
    clientStatus = 'qr';
    currentQR = await qrcode.toDataURL(qr);
    io.emit('wa:qr', currentQR);
    emitStatus();
  });

  client.on('loading_screen', (percent, message) => {
    clientStatus = 'connecting';
    emitStatus();
    io.emit('wa:loading', { percent, message });
  });

  client.on('authenticated', () => {
    console.log('AUTHENTICATED');
    clientStatus = 'connecting';
    currentQR = null;
    emitStatus();
  });

  client.on('ready', () => {
    console.log('CLIENT IS READY');
    clientStatus = 'connected';
    currentQR = null;
    emitStatus();
    io.emit('wa:ready', { message: 'WhatsApp connected successfully!' });
  });

  // Prevent EventEmitter "Unhandled 'error' event" crashes from whatsapp-web.js/puppeteer internals.
  client.on('error', (err) => {
    console.error('WhatsApp client error:', err?.message || err);
    clientStatus = 'disconnected';
    emitStatus();
    scheduleReconnect(3000);
  });

  client.on('auth_failure', (message) => {
    console.error('AUTH FAILURE:', message);
    clientStatus = 'disconnected';
    currentQR = null;
    emitStatus();
    scheduleReconnect(5000);
  });

  client.on('disconnected', (reason) => {
    console.log('CLIENT DISCONNECTED', reason);
    clientStatus = 'disconnected';
    emitStatus();
    io.emit('wa:disconnected', { reason });
    scheduleReconnect(5000);
  });

  try {
    // Suppress Puppeteer execution context errors during initialization
    const originalConsoleError = console.error;
    let suppressNextError = false;
    
    console.error = function(...args) {
      const message = args[0]?.toString?.() || String(args[0]);
      if (message.includes('Execution context was destroyed') || 
          message.includes('Target closed') ||
          message.includes('Session closed')) {
        suppressNextError = true;
        return; // Don't log these known navigation errors
      }
      originalConsoleError.apply(console, args);
    };

    await client.initialize();
    
    // Restore console.error
    console.error = originalConsoleError;
  } catch (err) {
    const message = err?.message || String(err);
    
    // Suppress known non-fatal puppeteer errors
    if (message.includes('Execution context was destroyed') || 
        message.includes('Target closed') ||
        message.includes('Session closed') ||
        message.includes('Navigation failed')) {
      console.warn('[PUPPETEER] Non-fatal navigation error (ignored):', message);
      clientStatus = 'connecting'; // Stay in connecting state, will retry
      // Don't schedule immediate reconnect for these transient errors
      return;
    }
    
    console.error('Failed to initialize WhatsApp client:', message);
    clientStatus = 'disconnected';
    emitStatus();
    scheduleReconnect(5000);
  } finally {
    isInitializing = false;
  }
}

function getClient() {
  return client;
}

function getStatus() {
  return { status: clientStatus, qr: currentQR };
}

async function sendMessage(phone, message) {
  if (!client || clientStatus !== 'connected') {
    throw new Error('WhatsApp client is not connected');
  }

  // Format nomor Indonesia: 08xxx → 628xxx@c.us
  let formatted = phone.replace(/\D/g, '');
  if (formatted.startsWith('0')) {
    formatted = '62' + formatted.slice(1);
  } else if (!formatted.startsWith('62')) {
    formatted = '62' + formatted;
  }
  const chatId = `${formatted}@c.us`;

  // Check if number exists on WhatsApp
  const isRegistered = await client.isRegisteredUser(chatId);
  if (!isRegistered) {
    throw new Error(`Number ${phone} is not registered on WhatsApp`);
  }

  await client.sendMessage(chatId, message);
  return true;
}

async function sendMessageWithMedia(phone, message, mediaPath) {
  if (!client || clientStatus !== 'connected') {
    throw new Error('WhatsApp client is not connected');
  }

  // Format nomor Indonesia: 08xxx → 628xxx@c.us
  let formatted = phone.replace(/\D/g, '');
  if (formatted.startsWith('0')) {
    formatted = '62' + formatted.slice(1);
  } else if (!formatted.startsWith('62')) {
    formatted = '62' + formatted;
  }
  const chatId = `${formatted}@c.us`;

  // Check if number exists on WhatsApp
  const isRegistered = await client.isRegisteredUser(chatId);
  if (!isRegistered) {
    throw new Error(`Number ${phone} is not registered on WhatsApp`);
  }

  // Load media dari file atau URL
  let media;
  if (mediaPath.startsWith('http')) {
    media = await MessageMedia.fromUrl(mediaPath, { unsafeMime: true });
  } else {
    media = MessageMedia.fromFilePath(mediaPath);
  }

  // Kirim media dengan caption (teks pesan)
  await client.sendMessage(chatId, media, { caption: message || '' });
  return true;
}

async function logout() {
  if (client) {
    await client.logout();
    clientStatus = 'disconnected';
    emitStatus();
  }
}

module.exports = { initWhatsApp, getClient, getStatus, sendMessage, sendMessageWithMedia, logout };
