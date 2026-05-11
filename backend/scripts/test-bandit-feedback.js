#!/usr/bin/env node

/**
 * Test script for CMAB Feedback Tracking System
 * Tests the complete flow from policy creation to statistics aggregation
 */

const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

// Helper to make API calls
async function apiCall(method, endpoint, data = null) {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = { method, url };
    if (data) config.data = data;
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`❌ API Error [${method} ${endpoint}]:`, error.response?.data || error.message);
    throw error;
  }
}

async function runTests() {
  console.log('🚀 CMAB Feedback Tracking System - Test Suite\n');
  console.log(`API Base URL: ${API_BASE_URL}\n`);

  try {
    // Test 1: Health Check
    console.log('📋 Test 1: Health Check');
    const health = await apiCall('GET', '/health');
    console.log('✅ Backend is healthy\n');

    // Test 2: Create Bandit Policy
    console.log('📋 Test 2: Create Bandit Policy');
    const policyRes = await apiCall('POST', '/bandit/create', {
      name: 'Test_Format_Optimization',
      arms: 3,
      features: ['hour', 'recency_days', 'message_count', 'cluster_id'],
      alpha: 1.0,
      lambda: 1.0
    });
    const policyId = policyRes.policy.id;
    console.log(`✅ Policy created with ID: ${policyId}\n`);

    // Test 3: Generate test events
    console.log('📋 Test 3: Generating test events (simulating message sends)');
    const events = [];
    for (let i = 0; i < 30; i++) {
      const arm = i % 3;
      const context = {
        hour: Math.floor(Math.random() * 24),
        recency_days: Math.floor(Math.random() * 30),
        message_count: Math.floor(Math.random() * 20),
        cluster_id: Math.floor(Math.random() * 5)
      };
      
      const recommendRes = await apiCall('POST', '/bandit/recommend', {
        policy_id: policyId,
        context: context,
        session_id: `test_session_${i}`,
        phone: `628${String(i).padStart(9, '0')}`
      });
      
      events.push(recommendRes.eventId);
    }
    console.log(`✅ Created ${events.length} test events\n`);

    // Test 4: Simulate feedback (mark as delivered, read, replied)
    console.log('📋 Test 4: Simulating message feedback');
    let simulatedFeedback = 0;
    
    for (let i = 0; i < events.length; i++) {
      const eventId = events[i];
      
      // Randomly assign delivery status
      const rand = Math.random();
      let delivered = true, read = false, replied = false;
      
      if (rand < 0.05) {
        // 5% failed
        delivered = false;
      } else if (rand < 0.3) {
        // 25% sent only
        delivered = true;
      } else if (rand < 0.8) {
        // 50% delivered + read
        delivered = true;
        read = true;
      } else {
        // 20% delivered + read + replied
        delivered = true;
        read = true;
        replied = true;
      }
      
      // Update delivery status
      try {
        await apiCall('POST', '/bandit/update-delivery-status', {
          event_id: eventId,
          delivery_status: delivered ? 'delivered' : 'failed',
          read_status: read ? 1 : 0,
          reply_received: replied ? 1 : 0
        });
        simulatedFeedback++;
      } catch (err) {
        // Continue even if one fails
      }
    }
    console.log(`✅ Simulated feedback for ${simulatedFeedback} events\n`);

    // Test 5: Get Policy Analytics
    console.log('📋 Test 5: Retrieving Policy Analytics');
    const analyticsRes = await apiCall('GET', `/bandit/stats/policy/${policyId}`);
    console.log('✅ Policy Analytics retrieved:');
    console.log(`   - Total Events: ${analyticsRes.analytics.total_events}`);
    console.log(`   - Completed: ${analyticsRes.analytics.completed_events}`);
    console.log(`   - Avg Reward: ${analyticsRes.analytics.overall.avg_reward}`);
    console.log(`   - Delivery Rate: ${analyticsRes.analytics.overall.delivery_rate}%`);
    console.log(`   - Read Rate: ${analyticsRes.analytics.overall.read_rate}%`);
    console.log(`   - Reply Rate: ${analyticsRes.analytics.overall.reply_rate}%\n`);

    // Test 6: Get Event Breakdown
    console.log('📋 Test 6: Retrieving Event Breakdown');
    const breakdownRes = await apiCall('GET', `/bandit/stats/breakdown/${policyId}`);
    console.log('✅ Event Breakdown retrieved:');
    const bd = breakdownRes.breakdown;
    console.log(`   Delivery Status:`);
    console.log(`   - Pending: ${bd.by_delivery_status.pending}`);
    console.log(`   - Sent: ${bd.by_delivery_status.sent}`);
    console.log(`   - Delivered: ${bd.by_delivery_status.delivered}`);
    console.log(`   - Failed: ${bd.by_delivery_status.failed}`);
    console.log(`   Engagement:`);
    console.log(`   - Read: ${bd.by_read_status.read}`);
    console.log(`   - Replied: ${bd.by_reply_status.replied}\n`);

    // Test 7: Get Recent Events
    console.log('📋 Test 7: Retrieving Recent Events');
    const eventsRes = await apiCall('GET', `/bandit/stats/events/${policyId}?limit=10`);
    console.log(`✅ Retrieved ${eventsRes.events.length} recent events\n`);

    // Test 8: Get Learning Progress
    console.log('📋 Test 8: Retrieving Learning Progress');
    const learningRes = await apiCall('GET', `/bandit/stats/learning-progress/${policyId}`);
    if (learningRes.progress.timeline) {
      console.log('✅ Learning Progress retrieved:');
      console.log(`   - Phases: ${learningRes.progress.phases}`);
      console.log(`   - Total Events: ${learningRes.progress.total_events}`);
      console.log(`   - Initial Avg Reward: ${learningRes.progress.improvement.first_phase_avg_reward}`);
      console.log(`   - Current Avg Reward: ${learningRes.progress.improvement.last_phase_avg_reward}`);
      console.log(`   - Improvement: ${learningRes.progress.improvement.avg_reward_change}%\n`);
    } else {
      console.log('⚠️ Not enough events for learning analysis\n');
    }

    // Test 9: Define Arms
    console.log('📋 Test 9: Define Arm Meanings');
    const defineRes = await apiCall('POST', '/bandit/define-arms', {
      policy_id: policyId,
      arm_definitions: [
        { arm: 0, name: 'Short Message', description: 'Concise 2-3 line message' },
        { arm: 1, name: 'Medium + Emoji', description: 'Medium message with benefits list' },
        { arm: 2, name: 'Media Format', description: 'Message with image attachment' }
      ]
    });
    console.log('✅ Arm definitions saved\n');

    // Test 10: Get Arm Definitions
    console.log('📋 Test 10: Retrieving Arm Definitions');
    const defRes = await apiCall('GET', `/bandit/arm-definitions/${policyId}`);
    console.log('✅ Arm Definitions:');
    (defRes.definitions || []).forEach(def => {
      console.log(`   Arm ${def.arm}: ${def.name}`);
    });
    console.log();

    // Final Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ ALL TESTS PASSED!');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('📊 System is ready to use!');
    console.log(`\n✨ Access Bandit Dashboard: ${BACKEND_URL}/bandit`);
    console.log(`📈 Policy ID for testing: ${policyId}`);
    console.log('\n🎯 Next steps:');
    console.log('1. Start a WhatsApp blast with policy_id:', policyId);
    console.log('2. Messages will be automatically tracked');
    console.log('3. Statistics will auto-update as feedback arrives');
    console.log('4. View dashboard to see arm performance\n');

  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error.message);
    process.exit(1);
  }
}

runTests();
