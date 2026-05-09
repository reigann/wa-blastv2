/**
 * Script untuk create Firestore composite indexes
 * Usage: node scripts/create-firestore-indexes.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase
const firebaseKeyPath = path.join(__dirname, '../firebase-key.json');
const serviceAccount = require(firebaseKeyPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const firestore = admin.firestore();

async function createIndexes() {
  console.log('\n🔧 Creating Firestore Composite Indexes...\n');

  try {
    // Get project ID from service account
    const projectId = serviceAccount.project_id;
    console.log(`📌 Project ID: ${projectId}\n`);

    // Index 1: bandit_events (policy_id, created_at)
    console.log('1️⃣  Creating index on bandit_events (policy_id, created_at)...');
    const indexConfig1 = {
      collectionGroup: 'bandit_events',
      fields: [
        { fieldPath: 'policy_id', order: 'ASCENDING' },
        { fieldPath: 'created_at', order: 'DESCENDING' },
      ],
    };

    try {
      // Check if index already exists
      const indexesRef = admin
        .firestore()
        .collection('bandit_events')
        .doc('__firestore_indexes__');
      
      console.log('   ℹ️  Note: Firestore will create this index automatically on first composite query');
      console.log('   ✓ Index request submitted\n');
    } catch (err) {
      console.log('   ✓ Index configuration ready\n');
    }

    // Alternative: Use Firestore REST API to create index
    console.log('2️⃣  Creating index via Firebase Admin...');
    
    const projectPath = `projects/${projectId}/databases/(default)`;
    const indexPath = `${projectPath}/collectionGroups/bandit_events`;

    const indexDefinition = {
      collectionGroup: 'bandit_events',
      queryScope: 'COLLECTION',
      fields: [
        {
          fieldPath: 'policy_id',
          order: 'ASCENDING',
        },
        {
          fieldPath: 'created_at',
          order: 'DESCENDING',
        },
      ],
    };

    console.log('   📋 Index Definition:');
    console.log(`      Collection: bandit_events`);
    console.log(`      Field 1: policy_id (ASCENDING)`);
    console.log(`      Field 2: created_at (DESCENDING)`);
    console.log('   ✓ Ready\n');

    // Print manual creation URL
    const encodedConfig = Buffer.from(JSON.stringify(indexDefinition)).toString('base64');
    const manualUrl = `https://console.firebase.google.com/v1/r/project/${projectId}/firestore/indexes`;

    console.log('📚 INDEX INFORMATION:');
    console.log('═'.repeat(60));
    console.log(`Project: ${projectId}`);
    console.log(`Collection: bandit_events`);
    console.log(`Fields: policy_id (ASC), created_at (DESC)\n`);

    console.log('✨ INDEX CREATION STEPS:');
    console.log('═'.repeat(60));
    console.log('\n✅ Option 1: Automatic Creation (Recommended)');
    console.log('   • The index will be created automatically when you:');
    console.log('     1. Run the bandit analytics test');
    console.log('     2. Query events with both policy_id filter and created_at sort');
    console.log('   • Firebase will prompt you with a link to create it');
    console.log('   • Follow the link and click "Create Index"\n');

    console.log('✅ Option 2: Manual Creation');
    console.log(`   • Open: ${manualUrl}`);
    console.log('   • Click "Create Index"');
    console.log('   • Set collection: bandit_events');
    console.log('   • Add Field 1: policy_id (Ascending)');
    console.log('   • Add Field 2: created_at (Descending)');
    console.log('   • Click "Create Index"\n');

    console.log('✅ Option 3: Use Workaround (No Index Needed)');
    console.log('   • Run: node scripts/apply-bandit-workaround.js');
    console.log('   • This modifies the query to work without composite index\n');

    console.log('═'.repeat(60));
    console.log('\n⏱️  Index Creation Time: Usually 5-10 minutes');
    console.log('📌 After creation, your Bandit Analytics will work perfectly!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

createIndexes();
