# Multi-Armed Bandit - Arm Definitions & Optimization Guide

## Overview

This document explains how to define arms in the Contextual Multi-Armed Bandit system and how the automatic reward function works.

---

## What Are "Arms"?

In the context of WhatsApp campaign optimization, each **arm** represents a different campaign strategy or decision that the system can choose from.

**Examples of arm definitions:**

### Option 1: Time-Based Arms (When to send)
```json
[
  { "arm_id": 0, "name": "Morning", "description": "Send between 6-12 AM" },
  { "arm_id": 1, "name": "Afternoon", "description": "Send between 12-6 PM" },
  { "arm_id": 2, "name": "Evening", "description": "Send between 6-11 PM" }
]
```

### Option 2: Content-Based Arms (What to send)
```json
[
  { "arm_id": 0, "name": "Short Message", "description": "Plain text, <100 chars" },
  { "arm_id": 1, "name": "Long Message", "description": "Detailed message, 100-500 chars" },
  { "arm_id": 2, "name": "Message with Media", "description": "Message + image/document" }
]
```

### Option 3: Personalization Arms (How to personalize)
```json
[
  { "arm_id": 0, "name": "Generic", "description": "Standard message to all" },
  { "arm_id": 1, "name": "Name Personalized", "description": "Include recipient name" },
  { "arm_id": 2, "name": "Full Personalization", "description": "Name + education + interest" }
]
```

### Option 4: Segmentation Arms (Who to target)
```json
[
  { "arm_id": 0, "name": "Cluster 0", "description": "High engagement users" },
  { "arm_id": 1, "name": "Cluster 1", "description": "Medium engagement users" },
  { "arm_id": 2, "name": "Cluster 2", "description": "Low engagement users" }
]
```

---

## Setting Up Arms

### Step 1: Create a Policy with Arms

```bash
curl -X POST http://localhost:3001/api/bandit/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "time_optimization",
    "arms": 3,
    "features": ["hour", "day", "recency_days", "message_count", "cluster_id"],
    "alpha": 1.0,
    "lambda": 1.0
  }'
```

Response:
```json
{
  "success": true,
  "policy": {
    "id": 1,
    "name": "time_optimization",
    "arms": 3,
    "featureNames": ["hour", "day", "recency_days", "message_count", "cluster_id"]
  }
}
```

### Step 2: Define What Each Arm Means

```bash
curl -X POST http://localhost:3001/api/bandit/define-arms \
  -H "Content-Type: application/json" \
  -d '{
    "policy_id": 1,
    "arm_definitions": [
      { "arm_id": 0, "name": "Morning", "description": "Send 6-12 AM", "optimal_hour": 9 },
      { "arm_id": 1, "name": "Afternoon", "description": "Send 12-6 PM", "optimal_hour": 14 },
      { "arm_id": 2, "name": "Evening", "description": "Send 6-11 PM", "optimal_hour": 19 }
    ]
  }'
```

### Step 3: Verify Arm Definitions

```bash
curl http://localhost:3001/api/bandit/arm-definitions/1
```

Response:
```json
{
  "success": true,
  "definitions": [
    { "arm_id": 0, "name": "Morning", "description": "Send 6-12 AM", "optimal_hour": 9 },
    { "arm_id": 1, "name": "Afternoon", "description": "Send 12-6 PM", "optimal_hour": 14 },
    { "arm_id": 2, "name": "Evening", "description": "Send 6-11 PM", "optimal_hour": 19 }
  ]
}
```

---

## Automatic Reward Function

### How Rewards Are Calculated

The system automatically assigns rewards based on message delivery status:

| Status | Base Reward | Reason |
|--------|-------------|--------|
| `sent` | 0.5 | Message reached WhatsApp server |
| `delivered` | 0.8 | Message reached recipient |
| `failed` | -0.5 | Delivery failed |
| `read` | +0.3 | Bonus for message read |
| `reply` | +1.0 | Bonus for engagement/reply |

**Formula:**
```
total_reward = base_reward + read_bonus + reply_bonus
```

**Examples:**
- Message sent, not read: **0.5**
- Message delivered, not read: **0.8**
- Message delivered + read: **0.8 + 0.3 = 1.1**
- Message delivered + read + reply: **0.8 + 0.3 + 1.0 = 2.1**
- Message failed: **-0.5**

### Automatic Reward Application

When a message is sent during blast, the system:

1. **Immediately** calls auto-reward with `delivery_status='sent'`
2. Calculates base reward of **0.5**
3. Sends this reward to LinUCB algorithm
4. Updates policy state (A_inv, b vectors)

Later, when you get delivery/read/reply feedback:
1. **Call update-delivery-status endpoint** with actual status
2. System **recalculates reward** with new bonuses
3. System **updates policy** with new reward

### API: Update Delivery Status (Manual Feedback)

```bash
curl -X POST http://localhost:3001/api/bandit/update-delivery-status \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": 42,
    "delivery_status": "delivered",
    "read_status": 1,
    "reply_received": 1
  }'
```

Response:
```json
{
  "success": true,
  "eventId": 42,
  "autoReward": 2.1,
  "deliveryStatus": "delivered"
}
```

---

## Analytics Dashboard

### Get Arm Performance Comparison

```bash
curl http://localhost:3001/api/bandit/analytics/1
```

Response:
```json
{
  "success": true,
  "analytics": {
    "0": {
      "arm_id": 0,
      "total_recommendations": 150,
      "total_reward": 85.5,
      "avg_reward": 0.57,
      "successful_count": 130,
      "failed_count": 20,
      "read_count": 45,
      "reply_count": 12
    },
    "1": {
      "arm_id": 1,
      "total_recommendations": 160,
      "total_reward": 110.4,
      "avg_reward": 0.69,
      "successful_count": 145,
      "failed_count": 15,
      "read_count": 62,
      "reply_count": 18
    },
    "2": {
      "arm_id": 2,
      "total_recommendations": 140,
      "total_reward": 102.2,
      "avg_reward": 0.73,
      "successful_count": 125,
      "failed_count": 15,
      "read_count": 55,
      "reply_count": 22
    }
  }
}
```

### Interpreting Results

**Arm 2 is best because:**
- Highest average reward (0.73)
- Best read rate (39%)
- Best reply rate (16%)

**Recommendation:** The system will gradually increase selection of Arm 2 (Evening) based on LinUCB's exploration-exploitation strategy.

---

## Workflow: Complete Example

### Scenario: Optimize Send Times for Student Recruitment Campaign

**Step 1: Create policy**
```bash
curl -X POST http://localhost:3001/api/bandit/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "student_recruitment_timing",
    "arms": 3,
    "features": ["hour", "day", "cluster_id", "recency_days"]
  }'
# Returns: policy_id = 5
```

**Step 2: Define arms**
```bash
curl -X POST http://localhost:3001/api/bandit/define-arms \
  -H "Content-Type: application/json" \
  -d '{
    "policy_id": 5,
    "arm_definitions": [
      { "arm_id": 0, "name": "Class Break", "optimal_hour": 10, "context": "Between classes" },
      { "arm_id": 1, "name": "Lunch Time", "optimal_hour": 12, "context": "Lunch break" },
      { "arm_id": 2, "name": "After School", "optimal_hour": 16, "context": "Going home" }
    ]
  }'
```

**Step 3: Use in campaign**
- Blast to 500 students
- System randomly selects arms (exploration phase)
- Auto-rewards each message based on delivery
- After ~50 messages, system learns which arm works best

**Step 4: Monitor performance**
```bash
curl http://localhost:3001/api/bandit/analytics/5

# Result shows: "After School" arm has 0.74 avg reward
# vs "Class Break" 0.52
```

**Step 5: Optimize further**
- Next campaign will favor "After School" arm
- System continues learning and optimizing
- Over time, delivery rate improves

---

## Best Practices

### ✅ DO:
- Define **3-5 arms max** (more arms = slower learning)
- Use **mutually exclusive** arm definitions
- Update delivery status **as soon as available**
- Monitor analytics **periodically** to validate learning
- Define arms **before running campaigns** (for consistency)

### ❌ DON'T:
- Mix different types of arms (e.g., time + content in same policy)
- Define too many arms (>10) - slows convergence
- Ignore negative rewards (they help algorithm avoid bad strategies)
- Change arm definitions mid-campaign (breaks consistency)
- Forget to collect feedback/delivery status

---

## Integration with Frontend

The frontend should:
1. Show arm definitions in UI
2. Display analytics charts
3. Allow manual delivery status updates
4. Show learning progress over time
5. Recommend "best arm" based on current analytics

Example UI flow:
```
Campaign → Select Policy → Review Arm Definitions
    ↓
Start Blast → Auto-rewards applied
    ↓
Monitor Progress → View Analytics
    ↓
Update Feedback → Recalculate rewards
    ↓
View Recommendations → Best performing arm highlighted
```

---

## Troubleshooting

**Q: Why is my average reward negative?**
- Too many failed deliveries
- Check WhatsApp connection status
- Verify recipient phone numbers are valid

**Q: Arms are too similar, what should I do?**
- Redefine with more distinct differences
- Ensure features capture differences between arms
- Use more descriptive arm definitions

**Q: How long until the system learns?**
- With 3 arms: ~30-50 messages for initial signal
- With 5 arms: ~50-100 messages
- Consistent learning: ~300+ messages for confidence

---

For more info, see [CLUSTERING_DEBUG.md](CLUSTERING_DEBUG.md) for contact segmentation context.
