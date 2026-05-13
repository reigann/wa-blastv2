#!/usr/bin/env node
/**
 * Creates the required Firestore composite index for blast_logs queries
 * Required for: clustering route getSentMapByPhones() query
 * Index fields: phone, status, sent_at
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase
const serviceAccountPath = path.join(__dirname, '../firebase-key.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const firestore = admin.firestore();

async function createIndex() {
  try {
    console.log('🔨 Creating Firestore composite index for blast_logs...');
    console.log('   Collection: blast_logs');
    console.log('   Fields: phone (Asc), status (Asc), sent_at (Desc)');

    // Note: The Admin SDK doesn't directly support creating indexes via code.
    // Instead, we'll provide instructions and a curl command.
    
    console.log('\n📌 To create the index, use one of these methods:\n');
    
    console.log('METHOD 1: Via Firebase Console (RECOMMENDED)');
    console.log('─────────────────────────────────────────────');
    console.log('1. Go to: https://console.firebase.google.com/project/whatsappblaster-c2d77/firestore/indexes');
    console.log('2. Click "Create Index"');
    console.log('3. Set Collection ID: blast_logs');
    console.log('4. Add fields in this order:');
    console.log('   - phone (Ascending)');
    console.log('   - status (Ascending)');
    console.log('   - sent_at (Descending)');
    console.log('5. Click "Create"');
    console.log('6. Wait 5-10 minutes for index to build\n');

    console.log('METHOD 2: Via gcloud CLI');
    console.log('────────────────────────');
    console.log('Run this command:');
    console.log(`gcloud firestore indexes create \\
  --collection-id="blast_logs" \\
  --database="(default)" \\
  --project="whatsappblaster-c2d77" \\
  --fields="phone(Ascending),status(Ascending),sent_at(Descending)"\n`);

    console.log('METHOD 3: Via REST API (if gcloud unavailable)');
    console.log('──────────────────────────────────────────────');
    console.log('Use the link from the error message to create it directly\n');

    console.log('✅ Once the index is created, the clustering endpoints will work properly.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createIndex();
