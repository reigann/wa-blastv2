const db = require('../db/database');
const fs = require('fs');
const { sendMessage, sendMessageWithMedia } = require('./whatsappService');

let activeBlast = null;
let io = null;

// Configuration
const SEND_MESSAGE_TIMEOUT = 30000; // 30 seconds timeout per message
const MAX_RETRIES = 2; // Retry up to 2 times if timeout
const RETRY_DELAY = 2000; // Wait 2 seconds before retry

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

// Replace template variables like {{name}}, {{phone}}
function processTemplate(message, contact) {
  return message
    .replace(/\{\{name\}\}/gi, contact.name || '')
    .replace(/\{\{phone\}\}/gi, contact.phone || '');
}

async function startBlast(sessionId, contacts, message, delayMin, delayMax, mediaPath = null) {
  if (activeBlast) {
    throw new Error('A blast is already in progress');
  }

  activeBlast = { sessionId, cancelled: false };

  // Validate and set default delays
  const minDelay = Math.max(parseInt(delayMin) || 3000, 1000); // Min 1 second
  const maxDelay = Math.max(parseInt(delayMax) || 7000, minDelay); // Max at least same as min

  // Update session status
  db.prepare(`
    UPDATE blast_sessions SET status='running', started_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(sessionId);

  io.emit('blast:started', { sessionId, total: contacts.length });

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < contacts.length; i++) {
    // Check if blast was cancelled
    if (activeBlast.cancelled) {
      db.prepare(`UPDATE blast_sessions SET status='cancelled' WHERE id=?`).run(sessionId);
      io.emit('blast:cancelled', { sessionId });
      activeBlast = null;
      return;
    }

    const contact = contacts[i];
    const personalizedMessage = processTemplate(message, contact);
    let retries = 0;
    let messageSent = false;
    let lastError = null;

    // Retry logic for timeout/unstable connection
    while (retries <= MAX_RETRIES && !messageSent) {
      try {
        // Send message with timeout protection
        if (mediaPath) {
          await sendWithTimeout(() => sendMessageWithMedia(contact.phone, personalizedMessage, mediaPath));
        } else {
          await sendWithTimeout(() => sendMessage(contact.phone, personalizedMessage));
        }
        
        sent++;
        messageSent = true;

        db.prepare(`
          INSERT INTO blast_logs (session_id, phone, name, status) VALUES (?, ?, ?, 'sent')
        `).run(sessionId, contact.phone, contact.name);

        io.emit('blast:progress', {
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

        // If retries left and it's a timeout, retry
        if (retries <= MAX_RETRIES && err.message.includes('timeout')) {
          console.log(`Retry ${retries}/${MAX_RETRIES} for ${contact.phone}: ${err.message}`);
          io.emit('blast:retry', {
            sessionId,
            phone: contact.phone,
            retry: retries,
            maxRetries: MAX_RETRIES
          });
          await sleep(RETRY_DELAY);
          continue;
        }

        // Max retries exceeded or non-timeout error
        failed++;
        messageSent = true; // Exit retry loop

        db.prepare(`
          INSERT INTO blast_logs (session_id, phone, name, status, error_message) VALUES (?, ?, ?, 'failed', ?)
        `).run(sessionId, contact.phone, contact.name, err.message);

        io.emit('blast:progress', {
          sessionId,
          current: i + 1,
          total: contacts.length,
          sent,
          failed,
          phone: contact.phone,
          name: contact.name,
          status: 'failed',
          error: err.message,
          retry: retries > 1 ? retries - 1 : 0
        });
      }
    }

    // Update session counters after each message
    db.prepare(`
      UPDATE blast_sessions SET sent=?, failed=? WHERE id=?
    `).run(sent, failed, sessionId);

    // Delay between messages (skip delay after last message)
    if (i < contacts.length - 1) {
      const delay = randomDelay(minDelay, maxDelay);
      io.emit('blast:waiting', { delay, next: i + 2 });
      await sleep(delay);
    }
  }

  // Mark session as completed
  db.prepare(`
    UPDATE blast_sessions SET status='completed', completed_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(sessionId);

  // Cleanup: hapus file media jika ada
  if (mediaPath && fs.existsSync(mediaPath)) {
    try {
      fs.unlinkSync(mediaPath);
      console.log(`Media file deleted: ${mediaPath}`);
    } catch (err) {
      console.error(`Failed to delete media file: ${err.message}`);
    }
  }

  io.emit('blast:completed', { sessionId, sent, failed, total: contacts.length });
  activeBlast = null;
}

function cancelBlast() {
  if (activeBlast) {
    const sessionId = activeBlast.sessionId;
    activeBlast.cancelled = true;
    
    // Langsung update database status ke cancelled
    db.prepare(`
      UPDATE blast_sessions SET status='cancelled', completed_at=CURRENT_TIMESTAMP WHERE id=?
    `).run(sessionId);
    
    // Emit event ke frontend
    if (io) {
      io.emit('blast:cancelled', { sessionId });
    }
    
    // Reset activeBlast immediately
    activeBlast = null;
    return true;
  }
  return false;
}

function getActiveBlast() {
  return activeBlast;
}

module.exports = { startBlast, cancelBlast, getActiveBlast, setIO };
