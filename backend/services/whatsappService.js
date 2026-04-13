const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

let client = null;
let clientStatus = 'disconnected'; // disconnected | qr | connecting | connected
let currentQR = null;
let io = null;

function initWhatsApp(socketIo) {
  io = socketIo;

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
    io.emit('wa:status', clientStatus);
  });

  client.on('loading_screen', (percent, message) => {
    clientStatus = 'connecting';
    io.emit('wa:status', clientStatus);
    io.emit('wa:loading', { percent, message });
  });

  client.on('authenticated', () => {
    console.log('AUTHENTICATED');
    clientStatus = 'connecting';
    currentQR = null;
    io.emit('wa:status', clientStatus);
  });

  client.on('ready', () => {
    console.log('CLIENT IS READY');
    clientStatus = 'connected';
    currentQR = null;
    io.emit('wa:status', clientStatus);
    io.emit('wa:ready', { message: 'WhatsApp connected successfully!' });
  });

  client.on('disconnected', (reason) => {
    console.log('CLIENT DISCONNECTED', reason);
    clientStatus = 'disconnected';
    io.emit('wa:status', clientStatus);
    io.emit('wa:disconnected', { reason });
    // Reinitialize after disconnect
    setTimeout(() => initWhatsApp(io), 5000);
  });

  client.initialize();
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
    io.emit('wa:status', clientStatus);
  }
}

module.exports = { initWhatsApp, getClient, getStatus, sendMessage, sendMessageWithMedia, logout };
