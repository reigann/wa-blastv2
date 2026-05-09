# 🤖 Bandit Analytics - Troubleshooting & Setup Guide

## ✅ Checklist Perbaikan yang Sudah Dilakukan

### 1. **Backend Improvements** (`banditService.js`)
- ✅ Improved `getArmAnalytics()` dengan proper logging
- ✅ Added numeric validation untuk semua reward calculations
- ✅ Better error handling untuk edge cases

### 2. **Frontend Improvements** (`BanditAnalytics.jsx`)
- ✅ Enhanced error logging dengan console messages
- ✅ Added data validation untuk arms array
- ✅ Fixed numeric conversions untuk chart data
- ✅ Better fallback handling untuk missing properties

### 3. **Route Improvements** (`routes/bandit.js`)
- ✅ Added detailed logging untuk analytics endpoint
- ✅ Better error messages dengan development mode support

---

## 🚀 Testing & Troubleshooting

### Test 1: Verify Backend Analytics Function
```bash
cd backend
node scripts/test-bandit-analytics.js
```

Ini akan:
- ✓ List semua bandit policies
- ✓ Fetch events untuk setiap policy
- ✓ Calculate dan display arm statistics
- ✓ Identify masalah dengan data

### Test 2: Check API Endpoint Directly
```bash
# Get all policies
curl -X GET http://localhost:3001/api/bandit/policies

# Get analytics untuk policy dengan ID 1
curl -X GET http://localhost:3001/api/bandit/analytics/1
```

### Test 3: Check Browser Console
1. Buka aplikasi di browser
2. Klik di Bandit page
3. Buka DevTools (F12)
4. Lihat Console tab untuk logs:
   - `[BanditAnalytics] Loading analytics for policyId: X`
   - Response data dari server
   - Error messages jika ada

---

## 📋 Cara Menggunakan Bandit Analytics

### Step 1: Create a Policy
```bash
curl -X POST http://localhost:3001/api/bandit/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Campaign",
    "arms": 2,
    "features": ["time_of_day", "day_of_week"],
    "alpha": 1.0,
    "lambda": 1.0
  }'
```

### Step 2: Get Recommendations
```bash
curl -X POST http://localhost:3001/api/bandit/recommend \
  -H "Content-Type: application/json" \
  -d '{
    "policy_id": 1,
    "context": {
      "time_of_day": 10,
      "day_of_week": 5
    }
  }'
```

Response:
```json
{
  "success": true,
  "eventId": 1,
  "arm": 0
}
```

### Step 3: Send Message dengan Arm yang Dipilih
Gunakan `arm` dari response untuk:
- Customize message template
- Track delivery
- Get feedback

### Step 4: Update Delivery Status
```bash
curl -X POST http://localhost:3001/api/bandit/update-delivery-status \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": 1,
    "delivery_status": "delivered",
    "read_status": 0,
    "reply_received": 0
  }'
```

Ini automatically akan calculate reward dan update arm states!

### Step 5: View Analytics
- Di UI: Masuk ke Bandit page dan pilih policy
- Di API: GET `/api/bandit/analytics/1`

---

## 🔍 Common Issues & Solutions

### ❌ Issue: "No data yet" di Analytics
**Penyebab:** Belum ada events untuk policy
**Solusi:**
1. Create policy (Step 1 di atas)
2. Generate recommendations (Step 2)
3. Update delivery status (Step 4)

### ❌ Issue: Analytics menampilkan 0 untuk semua arm
**Penyebab:** Events ada tapi tidak ada reward
**Solusi:**
1. Pastikan menggunakan `update-delivery-status` endpoint
2. Jangan gunakan `feedback` endpoint manual
3. Check di Firebase: `bandit_events` collection apakah ada `reward` field

### ❌ Issue: "Policy not found" error
**Penyebab:** Policy ID tidak valid
**Solusi:**
1. Get list policies: `GET /api/bandit/policies`
2. Gunakan ID yang benar

### ❌ Issue: CORS error
**Penyebab:** Frontend & Backend CORS tidak sesuai
**Solusi:**
1. Check `.env` di backend: `FRONTEND_URL`
2. Pastikan sesuai dengan domain frontend

### ❌ Issue: Firebase initialization error
**Penyebab:** firebase-key.json tidak ditemukan atau invalid
**Solusi:**
1. Pastikan `firebase-key.json` ada di `backend/`
2. Verify credentials valid di Firebase Console

---

## 🛠️ Debug Mode

### Enable Detailed Logging
Di `.env`:
```
NODE_ENV=development
DEBUG=*
```

### Check Logs
```bash
# Terminal 1: Tail backend logs
cd backend
npm start 2>&1 | tee bandit-debug.log

# Terminal 2: Run test
node scripts/test-bandit-analytics.js
```

---

## 📊 Expected Data Flow

```
User Action
    ↓
POST /api/bandit/recommend
    ↓ (returns arm ID)
Send Message dengan Arm
    ↓
(User membuka/reply)
    ↓
POST /api/bandit/update-delivery-status
    ↓ (calculates reward)
Firebase: bandit_events.reward = X
    ↓
GET /api/bandit/analytics/:policy_id
    ↓
Return: Arm statistics (avg_reward, success_rate, etc)
    ↓
Display di UI: Charts & KPI Cards
```

---

## 🔑 Key Fields di Firebase

### bandit_policies Collection
```json
{
  "id": 1,
  "name": "Campaign Name",
  "arms": 2,
  "feature_names": ["feature1", "feature2"],
  "policy_state": {
    "arms_state": [
      { "A_inv": [[...]], "b": [...] },
      { "A_inv": [[...]], "b": [...] }
    ],
    "alpha": 1.0,
    "lambda": 1.0
  },
  "created_at": Timestamp,
  "updated_at": Timestamp
}
```

### bandit_events Collection
```json
{
  "id": 1,
  "policy_id": 1,
  "arm": 0,
  "context": { "feature1": 5, "feature2": 3 },
  "reward": 0.8,  // null jika belum di-feedback
  "delivery_status": "delivered",  // sent, failed, null
  "read_status": 0,
  "reply_received": 0,
  "auto_reward_applied": 1,
  "created_at": Timestamp,
  "updated_at": Timestamp
}
```

---

## ✨ Next Steps untuk Optimization

1. **Implement A/B Testing** - Compare arm performance
2. **Add Real-time Updates** - WebSocket untuk live analytics
3. **Export Reports** - CSV/PDF export
4. **Advanced Policies** - Multi-armed Thompson Sampling
5. **Context-based Recommendations** - Use ML untuk better features

---

## 📞 Support

Jika masih ada masalah:
1. ✓ Run: `node scripts/test-bandit-analytics.js`
2. ✓ Check browser console untuk logs
3. ✓ Check backend logs untuk errors
4. ✓ Verify Firebase connection
5. ✓ Share error messages di logs

Happy Bandit Arming! 🎯
