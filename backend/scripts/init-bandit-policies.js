#!/usr/bin/env node

/**
 * Initialize Bandit Policies
 * Run this once to create pre-configured policies for template & timing optimization
 * Directly uses database to bypass authentication
 */

const db = require('../db/database');

function initializePolicies() {
  try {
    console.log('🤖 Initializing Bandit Policies...\n');

    // Policy 1: Template Type Optimization
    console.log('📝 Creating Policy 1: Template Type Optimization...');
    
    const policy1 = db.prepare(`
      INSERT INTO bandit_policies (name, arms, feature_names, arm_definitions)
      VALUES (?, ?, ?, ?)
    `).run(
      'template_type_optimization',
      3,
      JSON.stringify(['cluster_id', 'recency_days', 'message_count']),
      JSON.stringify([
        {
          arm_id: 0,
          name: 'Short Message',
          description: 'Plain text message (< 100 characters)',
          characteristics: {
            type: 'text_short',
            max_length: 100,
            emoji_count: 0
          }
        },
        {
          arm_id: 1,
          name: 'Medium Message',
          description: 'Formatted message with emoji (100-300 characters)',
          characteristics: {
            type: 'text_medium',
            max_length: 300,
            emoji_count: 3
          }
        },
        {
          arm_id: 2,
          name: 'Message with Media',
          description: 'Text message + image/document attachment',
          characteristics: {
            type: 'with_media',
            max_length: 300,
            include_media: true
          }
        }
      ])
    );

    const policy1Id = policy1.lastInsertRowid;
    console.log(`✅ Policy 1 created with ID: ${policy1Id}\n`);

    // Policy 2: Sending Time Optimization
    console.log('⏰ Creating Policy 2: Sending Time Optimization...');
    
    const policy2 = db.prepare(`
      INSERT INTO bandit_policies (name, arms, feature_names, arm_definitions)
      VALUES (?, ?, ?, ?)
    `).run(
      'sending_time_optimization',
      3,
      JSON.stringify(['hour', 'day', 'cluster_id', 'recency_days']),
      JSON.stringify([
        {
          arm_id: 0,
          name: 'Morning',
          description: 'Send 6 AM - 12 PM (school/work hours)',
          time_range: {
            start_hour: 6,
            end_hour: 12,
            optimal_hour: 9,
            days: 'weekdays'
          },
          context: 'Student might be at school/commuting'
        },
        {
          arm_id: 1,
          name: 'Afternoon',
          description: 'Send 12 PM - 6 PM (break/lunch time)',
          time_range: {
            start_hour: 12,
            end_hour: 18,
            optimal_hour: 14,
            days: 'weekdays'
          },
          context: 'Lunch break, free time'
        },
        {
          arm_id: 2,
          name: 'Evening',
          description: 'Send 6 PM - 11 PM (after school/work)',
          time_range: {
            start_hour: 18,
            end_hour: 23,
            optimal_hour: 19,
            days: 'all_days'
          },
          context: 'Home time, more free time'
        }
      ])
    );

    const policy2Id = policy2.lastInsertRowid;
    console.log(`✅ Policy 2 created with ID: ${policy2Id}\n`);

    console.log('═════════════════════════════════════════════');
    console.log('🎉 All Bandit Policies initialized successfully!\n');
    console.log('📊 Policy Summary:');
    console.log('─────────────────────────────────────────────');
    console.log(`\n1️⃣  TEMPLATE TYPE OPTIMIZATION (ID: ${policy1Id})`);
    console.log('   └─ Optimize: Which template type works best');
    console.log('   ├─ Arm 0: Short message');
    console.log('   ├─ Arm 1: Medium message with emoji');
    console.log('   └─ Arm 2: Message with media');
    console.log(`\n2️⃣  SENDING TIME OPTIMIZATION (ID: ${policy2Id})`);
    console.log('   └─ Optimize: What time to send messages');
    console.log('   ├─ Arm 0: Morning (6 AM - 12 PM)');
    console.log('   ├─ Arm 1: Afternoon (12 PM - 6 PM)');
    console.log('   └─ Arm 2: Evening (6 PM - 11 PM)');
    console.log('\n═════════════════════════════════════════════');
    console.log('\n📝 Next Steps:');
    console.log('1. Go to Blast page');
    console.log('2. Create campaign');
    console.log('3. Select one of these policies');
    console.log('4. Run campaign');
    console.log('5. View analytics at /bandit');
    console.log('\n✅ Ready to start optimizing! 🚀\n');

  } catch (error) {
    console.error('❌ Error initializing policies:');
    if (error.response?.data) {
      console.error(error.response.data);
    } else {
      console.error(error.message || error);
    }
    process.exit(1);
  }
}

initializePolicies();
