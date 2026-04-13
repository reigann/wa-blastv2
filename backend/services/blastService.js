const db = require('../db/database');
const fs = require('fs');
const { sendMessage, sendMessageWithMedia } = require('./whatsappService');

let activeBlast = null;
let io = null;

function setIO(socketIo) {
  io = socketIo;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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

    try {
      // Kalau ada media, kirim dengan media + caption. Kalau tidak, kirim teks biasa
      if (mediaPath) {
        await sendMessageWithMedia(contact.phone, personalizedMessage, mediaPath);
      } else {
        await sendMessage(contact.phone, personalizedMessage);
      }
      sent++;

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
      failed++;

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
        error: err.message
      });
    }

    // Update session counters
    db.prepare(`
      UPDATE blast_sessions SET sent=?, failed=? WHERE id=?
    `).run(sent, failed, sessionId);

    // Delay between messages (skip delay after last message)
    if (i < contacts.length - 1) {
      const delay = randomDelay(delayMin || 3000, delayMax || 7000);
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
