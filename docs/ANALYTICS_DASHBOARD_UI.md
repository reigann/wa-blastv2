# Analytics Dashboard UI - Implementation Guide

## Overview

Analytics dashboard UI telah ditambahkan untuk menampilkan Bandit performance metrics dengan cara yang lebih mudah dan visual. Fitur ini terintegrasi penuh dengan backend API analytics yang sudah dibuat di Priority 1.

---

## 📁 Files Created/Modified

### New Files Created:
1. **`frontend/src/components/BanditAnalytics.jsx`** - Main analytics component
2. **`frontend/src/pages/Bandit.jsx`** - Full-page analytics dashboard

### Files Modified:
1. **`frontend/src/App.jsx`** - Added route for Bandit page
2. **`frontend/src/components/Sidebar.jsx`** - Added navigation link
3. **`frontend/src/pages/Dashboard.jsx`** - Added analytics preview

---

## 🎯 Features

### 1. **Full Bandit Analytics Page** (`/bandit`)

Complete dedicated page for bandit analytics with:

- **Policy Selector Dropdown** - Choose which bandit policy to analyze
- **Arm Performance Cards** - 3-4 cards showing each arm's metrics
  - Total recommendations count
  - Average reward (highlighted in green)
  - Success rate percentage
  - Engagement metrics (read count, reply count)
  - Best arm badge

- **Multiple Charts:**
  - **Average Reward Comparison** - Bar chart showing avg reward per arm
  - **Delivery Success vs Failure** - Stacked bar chart
  - **Engagement Metrics** - Line chart for read & reply trends
  - **Total Reward Accumulation** - Shows cumulative rewards

- **Detailed Statistics Table** - Full data in table format

### 2. **Dashboard Preview** (Quick View)

Dashboard homepage juga menampilkan:
- BanditAnalytics component dengan condensed view
- Link ke full analytics page
- Auto-selects first available policy

---

## 🚀 How to Use

### View Full Analytics

**Method 1: Navigation**
```
Sidebar → Analytics & Tools → Bandit Analytics
```

**Method 2: Direct URL**
```
http://localhost:5173/bandit
```

### Steps:

1. **Open Bandit Analytics page**
   - Click "Bandit Analytics" in sidebar
   - Or navigate to `/bandit`

2. **Select a policy**
   - Dropdown at top shows all available policies
   - Click to select (loads analytics automatically)

3. **Read the insights:**
   - **Performance Cards** - Quick overview per arm
   - **Charts** - Visual trends and comparisons
   - **Table** - Detailed numbers

### From Dashboard:

1. Open Dashboard (home page)
2. Scroll to bottom
3. See "Bandit Analytics Preview"
4. Click "View Full Analytics →" for detailed view

---

## 📊 Components Breakdown

### BanditAnalytics Component

**Props:**
```javascript
<BanditAnalytics policyId={1} />
```

**Features:**
- Auto-fetches analytics data from `/api/bandit/analytics/:policy_id`
- Auto-refreshes every 30 seconds
- Shows loading state while fetching
- Error handling with user-friendly messages
- Responsive design (mobile/tablet/desktop)

**Data Displayed:**

For each arm, shows:
```javascript
{
  arm_id: 0,
  total_recommendations: 150,       // How many times selected
  total_reward: 85.5,                // Sum of all rewards
  avg_reward: 0.57,                  // Average per message
  successful_count: 130,             // Successful deliveries
  failed_count: 20,                  // Failed deliveries
  read_count: 45,                    // Messages read
  reply_count: 12                    // Messages with replies
}
```

### Bandit Page

**Features:**
- Policy selector dropdown
- Loads available policies on mount
- Auto-selects first policy
- Passes selected policy to BanditAnalytics
- Responsive layout

---

## 📈 Chart Types

### 1. Average Reward (Bar Chart)
Shows which arm has highest average reward
- **X-axis:** Arm names
- **Y-axis:** Average reward value (0-2+)
- **Best use:** Identify best performing arm

### 2. Success vs Failure (Stacked Bar)
Compares delivery success/failure per arm
- **Green bars:** Successful deliveries
- **Red bars:** Failed deliveries
- **Best use:** Reliability comparison

### 3. Engagement Metrics (Line Chart)
Shows read and reply trends
- **Blue line:** Read count
- **Orange line:** Reply count
- **Best use:** Track engagement improvements

### 4. Total Reward (Bar Chart)
Cumulative rewards accumulated per arm
- **Purple bars:** Total reward
- **Best use:** Overall arm value comparison

### 5. Summary Table
Detailed data in table format for export/analysis

---

## 💡 Key Insights You Can Get

From the dashboard you can see:

1. **Which arm is best?**
   - Look at cards with highest avg_reward
   - Badge shows "Best" on top performing arm

2. **Is the algorithm learning?**
   - Check if "Best" arm gets more recommendations over time
   - Avg reward should increase for best arm

3. **Are there failures?**
   - Look at failed count in cards
   - Check Success vs Failure chart
   - If failures are high, investigate WhatsApp connection

4. **Engagement quality?**
   - Look at read_count vs reply_count
   - Higher engagement = better campaign

5. **Reward trend?**
   - Total reward should increase over time
   - Shows cumulative learning progress

---

## 🔌 API Integration

Component automatically calls:

```javascript
GET /api/bandit/analytics/:policy_id
```

Response format:
```json
{
  "success": true,
  "analytics": {
    "0": { "arm_id": 0, "avg_reward": 0.57, ... },
    "1": { "arm_id": 1, "avg_reward": 0.69, ... },
    "2": { "arm_id": 2, "avg_reward": 0.73, ... }
  }
}
```

---

## 🎨 Styling

Uses Bootstrap 5 + custom Recharts styling:
- **Green theme** - WhatsApp branding
- **Responsive** - Mobile/tablet/desktop
- **Dark/Light mode ready** - Adapts to system
- **Print-friendly** - Can print analytics

---

## ⚡ Performance

- **Auto-refresh:** Every 30 seconds
- **Loading state:** Shows spinner while fetching
- **Caching:** Recharts memoizes components
- **Error handling:** Graceful error messages

---

## 🔄 Auto-Refresh

Analytics auto-refresh every 30 seconds to show latest data:

```javascript
useEffect(() => {
  if (!policyId) return;
  
  const loadAnalytics = async () => { ... };
  
  loadAnalytics();
  const interval = setInterval(loadAnalytics, 30000); // 30s
  return () => clearInterval(interval);
}, [policyId]);
```

To change refresh rate, edit `30000` (milliseconds) in `BanditAnalytics.jsx`

---

## 📱 Responsive Design

| Device | Layout |
|--------|--------|
| Mobile | Single column cards, stacked charts |
| Tablet | 2-column cards, side-by-side charts |
| Desktop | 3-column cards, full width charts |

---

## 🛠️ Troubleshooting

### No data showing?
- ✓ Ensure bandit policy exists
- ✓ Run a blast campaign first
- ✓ Check browser console for errors

### Analytics not updating?
- ✓ Check if backend is running
- ✓ Network tab in DevTools → check `/api/bandit/analytics` calls
- ✓ Manually refresh page (F5)

### Charts not rendering?
- ✓ Check if Recharts is installed (`npm list recharts`)
- ✓ Check browser console for errors
- ✓ Try different screen width

---

## 📝 Next Steps (Optional Enhancements)

### Phase 2 (Future):
- [ ] Export analytics as PDF/CSV
- [ ] Comparison between policies
- [ ] Time-series analytics (daily/weekly)
- [ ] Statistical significance testing
- [ ] Recommendation engine (suggests best arm)
- [ ] Historical data tracking

### Phase 3 (Advanced):
- [ ] Real-time dashboard (WebSocket updates)
- [ ] Custom metric creation
- [ ] Alert triggers (e.g., low reward)
- [ ] Team collaboration features

---

## 📚 Integration Example

Usage in Blast page (to show analytics after campaign):

```javascript
import BanditAnalytics from './components/BanditAnalytics';

// In your campaign completion handler:
function onBlastCompleted(policyId) {
  return <BanditAnalytics policyId={policyId} />;
}
```

---

## ✨ For Your Publication

This UI demonstrates:
- ✅ Real-time analytics visualization
- ✅ Multi-arm performance comparison
- ✅ User-friendly metrics presentation
- ✅ Actionable insights display
- ✅ Production-grade dashboard

Great for:
- Publication screenshots
- User study results
- System demonstration
- Academic papers (system design section)

---

## Files Structure

```
frontend/src/
├── components/
│   ├── BanditAnalytics.jsx      ← Main analytics component
│   ├── Sidebar.jsx              ← Updated with /bandit link
│   └── ...
├── pages/
│   ├── Bandit.jsx               ← Analytics page
│   ├── Dashboard.jsx            ← Updated with preview
│   └── ...
└── App.jsx                       ← Updated with /bandit route
```

---

Done! 🎉 Analytics dashboard is now fully integrated and ready to use.
