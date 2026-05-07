require('dotenv').config();
const readline = require('readline');
const db = require('../db/mysql-adapter');
const { initializeMySQLDatabase } = require('../db/mysql-init');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function addEmailToAllowlist(email, addedBy = 'system') {
  try {
    await db.run('INSERT INTO email_allowlist (email, added_by) VALUES (?, ?)', [email, addedBy]);
    return true;
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return false;
    throw error;
  }
}

async function main() {
  try {
    console.log('\n=== WhatsApp Blaster - MySQL & Google OAuth Setup ===\n');

    console.log('1. Initializing MySQL database...');
    await db.initializePool();
    await initializeMySQLDatabase();
    console.log('Database initialized successfully\n');

    const email = await question('2. Enter admin email to add to allowlist: ');

    if (!email || !email.includes('@')) {
      console.error('Invalid email');
      process.exit(1);
    }

    console.log(`\nAdding ${email} to allowlist...`);
    const added = await addEmailToAllowlist(email, 'system');

    if (added) {
      console.log(`Email ${email} added to allowlist\n`);
    } else {
      console.log(`Email ${email} already in allowlist\n`);
    }

    console.log('=== Setup Complete ===\n');
    console.log('Next steps:');
    console.log('1. Ensure Google OAuth credentials are in .env:');
    console.log('   - GOOGLE_CLIENT_ID');
    console.log('   - GOOGLE_CLIENT_SECRET');
    console.log('   - GOOGLE_CALLBACK_URL');
    console.log('\n2. Start the backend:');
    console.log('   npm run dev\n');

    await db.closePool();
    rl.close();
    process.exit(0);
  } catch (error) {
    console.error('Setup failed:', error.message);
    await db.closePool();
    rl.close();
    process.exit(1);
  }
}

main();
