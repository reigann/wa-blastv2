# 🤖 Bandit Strategies Guide - Template & Timing Optimization

## Overview

This guide explains how to use the two pre-configured Multi-Armed Bandit strategies to optimize your WhatsApp campaigns.

### What is Multi-Armed Bandit?

Think of it like a smart experiment runner:
- **Normal way**: You send a message and hope it works
- **Bandit way**: System tries 3 different approaches → learns which one works best → uses that for future messages

It automatically learns what works best for **your audience**.

---

## Strategy 1: Template Type Optimization 🎯

**What it does**: Finds which **message format** gets the best responses

### The 3 Arms (Strategies):

| Arm | Strategy | Example |
|-----|----------|---------|
| 📝 | **Short Message** | Plain text, <100 chars | 
| 📝✨ | **Medium Message** | Formatted with emoji, 100-300 chars |
| 📸 | **Message + Media** | Text + image/document |

### How it Works:

```
Campaign Blast 1:
  Contact 1 → Arm 0 (Short) → Delivered ✅ → Reward: 0.8
  Contact 2 → Arm 1 (Medium) → Delivered ✅ → Reward: 0.8  
  Contact 3 → Arm 2 (Media) → Delivered ✅ → Reward: 0.8

Campaign Blast 2:
  Based on Blast 1 results... 
  If Arm 2 had 5 replies → Bandit gives more contacts to Arm 2
```

### Using It:

1. **Go to Blast Page** → Create new campaign
2. **Step 3 (Configure)**:
   - Scroll down to "🤖 Optimize Campaign with Bandit"
   - Click on **"template_type_optimization"** card
3. **Step 4 (Review)**:
   - Should show ✅ "Using template_type_optimization"
4. **Send Campaign** → System auto-distributes contacts across 3 template types
5. **Go to Dashboard/Bandit Analytics** → See which template won! 🏆

### Expected Results:

After 3-5 campaigns, you'll see:
```
📊 Analytics Card:
- Arm 0 (Short): 85% delivery rate
- Arm 1 (Medium): 92% delivery rate  ⭐ Best!
- Arm 2 (Media): 78% delivery rate
```

---

## Strategy 2: Sending Time Optimization ⏰

**What it does**: Finds the **best time** to send messages for highest engagement

### The 3 Arms (Time Slots):

| Arm | Time Range | Best For |
|-----|-----------|----------|
| 🌅 | **Morning** | 6 AM - 12 PM | School/work hours |
| ☀️ | **Afternoon** | 12 PM - 6 PM | Lunch break |
| 🌙 | **Evening** | 6 PM - 11 PM | After work, free time |

### How it Works:

```
Campaign Blast 1:
  Contact 1 → Send at 6 AM → Read rate: 30%
  Contact 2 → Send at 2 PM → Read rate: 75%  ← Better!
  Contact 3 → Send at 8 PM → Read rate: 60%

Campaign Blast 2:
  Based on Blast 1...
  More contacts sent at 2 PM (best arm)
```

### Using It:

1. **Go to Blast Page** → Create new campaign
2. **Step 3 (Configure)**:
   - Scroll to "🤖 Optimize Campaign with Bandit"
   - Click **"sending_time_optimization"** card
3. **Step 4 (Review)**:
   - Shows ✅ "Using sending_time_optimization"
4. **Send Campaign** → System spreads messages across 3 time slots
5. **Analytics** → See which time gets most opens/replies

### Expected Results:

```
📊 Analytics:
- Arm 0 (Morning 6-12 AM): 42% read rate
- Arm 1 (Afternoon 12-6 PM): 78% read rate  ⭐ Best!
- Arm 2 (Evening 6-11 PM): 55% read rate
```

---

## Setting Up Pre-configured Policies

### Method 1: Auto-Create (Recommended)

```bash
# Navigate to backend folder
cd backend

# Run initialization script
node scripts/init-bandit-policies.js
```

**Output:**
```
🤖 Initializing Bandit Policies...
📝 Creating Policy 1: Template Type Optimization...
✅ Policy 1 created with ID: 1
...
🎉 All Bandit Policies initialized successfully!
```

### Method 2: Manual Creation (curl)

**Create Template Strategy:**
```bash
curl -X POST http://localhost:3001/api/bandit/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "template_type_optimization",
    "arms": 3,
    "features": ["cluster_id", "recency_days", "message_count"],
    "alpha": 1.0,
    "lambda": 1.0
  }'
```

**Define Arms:**
```bash
curl -X POST http://localhost:3001/api/bandit/define-arms \
  -H "Content-Type: application/json" \
  -d '{
    "policy_id": 1,
    "arm_definitions": [
      {"arm_id": 0, "name": "Short Message", "description": "Plain text < 100 chars"},
      {"arm_id": 1, "name": "Medium Message", "description": "Formatted with emoji"},
      {"arm_id": 2, "name": "Message with Media", "description": "Text + image/document"}
    ]
  }'
```

---

## Reading the Analytics Dashboard

### Key Metrics:

**Per Arm Card Shows:**
- 📊 **Recommendations**: How many times this arm was chosen
- 💰 **Avg Reward**: Average score (-0.5 to +2.0)
- ✅ **Success Rate**: % of delivered messages
- 💬 **Engagement**: Read rate + Reply rate combined

**Reward Scoring:**
```
Message Sent:      +0.5
Message Delivered: +0.8
Message Read:      +0.3 (bonus)
Message Replied:   +1.0 (bonus)
Message Failed:    -0.5
```

**Example Score Calculation:**
- Message delivered + read → 0.8 + 0.3 = **1.1 points** ⭐
- Message delivered + reply → 0.8 + 1.0 = **1.8 points** 🏆
- Message failed → **-0.5 points** ❌

### Charts Explained:

1. **Average Reward** (Bar Chart)
   - Higher bar = Better arm
   - Look for tallest bar 📈

2. **Success vs Failure** (Stacked Bar)
   - Green = Delivered ✅
   - Red = Failed ❌
   - Wider green = Better arm

3. **Engagement Rate** (Line Chart)
   - Trends over time
   - Shows if arm improving or declining 📊

4. **Total Reward** (Accumulation)
   - Cumulative points
   - Steepest line = Best performer

---

## Best Practices

### ✅ Do's:

1. **Run Multiple Campaigns**
   - First 2-3 campaigns: Equal distribution (explores all options)
   - After 3 campaigns: Exploits best arm (learns faster)

2. **Use Similar Audiences**
   - All campaigns to students? Strategy learns for students
   - Mixing students + adults? Strategy confused

3. **Watch Weekly Analytics**
   - Check dashboard every 7 days
   - Look for clear winning arm

4. **Give It Time**
   - Minimum 100-200 messages per arm
   - 5+ campaigns for confident results

### ❌ Don'ts:

1. **Don't Mix Audiences**
   - Strategy learns for specific groups
   - Template that works for B2C ≠ B2B

2. **Don't Change Message Content**
   - Bandit optimizes FORMAT not CONTENT
   - Keep message same, only vary template type

3. **Don't Disable Mid-Campaign**
   - Let it run to completion
   - Interrupting ruins learning

4. **Don't Use for One-off Blasts**
   - Bandit learns over time
   - Single campaign = no optimization benefit

---

## Troubleshooting

### Problem: No Analytics Data Showing

**Cause**: No campaigns run with this policy yet

**Solution**:
1. Go to Blast page
2. Select the policy
3. Run at least 1 campaign
4. Wait 5 minutes
5. Check Analytics again

### Problem: All Arms Same Score

**Cause**: Not enough data yet (< 50 messages per arm)

**Solution**:
- Run 3-5 more campaigns
- Scores will diverge as more data collected

### Problem: Best Arm Not Selected

**Cause**: Exploration phase (early campaigns)

**Solution**:
- Bandit explores all options first
- After 3-5 campaigns → exploits best arm
- Exploitation happens automatically

### Problem: Policies Don't Show in Selector

**Cause**: Script not run yet

**Solution**:
```bash
# SSH/Terminal to server
cd backend
node scripts/init-bandit-policies.js
```

---

## Academic Publication Tips

### For Your Paper:

**Section 1: Algorithm**
- LinUCB (Contextual Multi-Armed Bandit)
- Sherman-Morrison matrix updates
- 5 features: recency, message_count, cluster_id, hour, day

**Section 2: Application**
- Real WhatsApp campaign optimization
- 3-arm strategies (template type & timing)
- Auto-reward mechanism

**Section 3: Results**
- A/B testing metrics in analytics
- Convergence rate to best arm
- Business impact (engagement rate, reply rate)

**Section 4: Implementation**
- Production Node.js + SQLite
- Real-time recommendations
- Integration with existing blast system

---

## Quick Reference

| Task | Steps |
|------|-------|
| **Create policies** | `node scripts/init-bandit-policies.js` |
| **Use in campaign** | Blast → Config → Select policy → Send |
| **View analytics** | Dashboard → Bandit Analytics |
| **Understand scores** | Delivered=0.8, Read=+0.3, Reply=+1.0 |
| **Best arm wins** | Look for highest avg reward in cards |
| **Reset strategy** | Delete policy + recreate (new learning) |

---

## Need Help?

1. Check logs: `curl http://localhost:3001/api/bandit/policies`
2. View events: `curl http://localhost:3001/api/bandit/events/[POLICY_ID]`
3. See analytics: `curl http://localhost:3001/api/bandit/analytics/[POLICY_ID]`

Enjoy optimizing! 🚀📊
