const cron = require('node-cron');
const db = require('../db/database');
const banditService = require('./banditService');

function start() {
  const enabled = process.env.BANDIT_ENABLED === 'true';
  if (!enabled) {
    console.log('Bandit worker disabled (BANDIT_ENABLED!=true)');
    return;
  }

  const expiryHours = Number(process.env.BANDIT_EXPIRY_HOURS) || 24;
  console.log(`Bandit worker started - expiring events older than ${expiryHours} hours every hour`);

  // Run at minute 0 every hour
  cron.schedule('0 * * * *', async () => {
    try {
      const cutoff = new Date(Date.now() - expiryHours * 3600 * 1000).toISOString();
      const rows = db.prepare('SELECT * FROM bandit_events WHERE reward IS NULL AND created_at <= ?').all(cutoff);
      if (!rows || rows.length === 0) return;

      console.log(`Bandit worker: expiring ${rows.length} events older than ${expiryHours} hours`);
      for (const ev of rows) {
        try {
          await banditService.feedback(ev.id, 0);
        } catch (err) {
          console.error('Failed to expire bandit event', ev.id, err?.message || err);
        }
      }
    } catch (err) {
      console.error('Bandit worker error', err?.message || err);
    }
  });
}

module.exports = { start };
