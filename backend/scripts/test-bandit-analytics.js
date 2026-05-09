/**
 * Test script untuk verifikasi Bandit Analytics
 * Usage: node scripts/test-bandit-analytics.js
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

const db = admin.firestore();

async function testBanditAnalytics() {
  console.log('\n🧪 Starting Bandit Analytics Test...\n');

  try {
    // 1. Get all policies
    console.log('1️⃣  Fetching all bandit policies...');
    const policiesSnap = await db.collection('bandit_policies').get();
    console.log(`   ✓ Found ${policiesSnap.size} policies\n`);

    if (policiesSnap.size === 0) {
      console.log('⚠️  No policies found. Please create a policy first.');
      console.log('   Example: POST /api/bandit/create');
      process.exit(1);
    }

    // 2. For each policy, check analytics
    for (const policyDoc of policiesSnap.docs) {
      const policyId = Number(policyDoc.id);
      const policy = policyDoc.data();

      console.log(`\n2️⃣  Policy #${policyId}: "${policy.name}"`);
      console.log(`   - Arms: ${policy.arms}`);
      console.log(`   - Features: ${(policy.feature_names || []).join(', ') || 'none'}`);
      console.log(`   - Created: ${policy.created_at?.toDate().toISOString() || 'N/A'}`);

      // 3. Get events for this policy
      const eventsSnap = await db
        .collection('bandit_events')
        .where('policy_id', '==', policyId)
        .get();

      console.log(`\n   📊 Events: ${eventsSnap.size} total`);

      if (eventsSnap.size === 0) {
        console.log('      ⚠️  No events yet. Run a campaign to generate events.');
        continue;
      }

      // 4. Analyze events by arm
      const armStats = {};
      for (let arm = 0; arm < policy.arms; arm += 1) {
        armStats[arm] = {
          events: [],
          with_reward: 0,
          without_reward: 0,
          delivered: 0,
          sent: 0,
          failed: 0,
          read: 0,
          replied: 0,
        };
      }

      for (const eventDoc of eventsSnap.docs) {
        const event = eventDoc.data();
        const arm = Number(event.arm);

        if (armStats[arm]) {
          armStats[arm].events.push({
            id: eventDoc.id,
            reward: event.reward,
            delivery_status: event.delivery_status,
            read_status: event.read_status,
            reply_received: event.reply_received,
          });

          if (event.reward !== null && event.reward !== undefined) {
            armStats[arm].with_reward += 1;
          } else {
            armStats[arm].without_reward += 1;
          }

          if (event.delivery_status === 'delivered') armStats[arm].delivered += 1;
          else if (event.delivery_status === 'sent') armStats[arm].sent += 1;
          else if (event.delivery_status === 'failed') armStats[arm].failed += 1;

          if (Number(event.read_status) === 1) armStats[arm].read += 1;
          if (Number(event.reply_received) === 1) armStats[arm].replied += 1;
        }
      }

      // 5. Display arm statistics
      console.log(`\n   👾 Arm Statistics:`);
      for (let arm = 0; arm < policy.arms; arm += 1) {
        const stats = armStats[arm];
        const rewards = stats.events
          .filter((e) => e.reward !== null && e.reward !== undefined)
          .map((e) => Number(e.reward));
        const avgReward = rewards.length ? rewards.reduce((a, b) => a + b, 0) / rewards.length : 0;
        const totalReward = rewards.reduce((a, b) => a + b, 0);

        console.log(`\n      Arm ${arm}:`);
        console.log(`        • Total Events: ${stats.events.length}`);
        console.log(`        • With Reward: ${stats.with_reward} | Without: ${stats.without_reward}`);
        console.log(`        • Avg Reward: ${avgReward.toFixed(3)}`);
        console.log(`        • Total Reward: ${totalReward.toFixed(2)}`);
        console.log(`        • Delivery Status: Delivered=${stats.delivered}, Sent=${stats.sent}, Failed=${stats.failed}`);
        console.log(`        • Engagement: Read=${stats.read}, Replied=${stats.replied}`);
      }
    }

    console.log('\n\n✅ Bandit Analytics Test Completed!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

testBanditAnalytics();
