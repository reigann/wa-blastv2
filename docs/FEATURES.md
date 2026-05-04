# 🎯 WhatsApp Blaster - Features Overview

## System Architecture

### Backend Architecture
- **Express Server** - RESTful API endpoints
- **Socket.io** - Real-time event streaming
- **WhatsApp Web.js** - WhatsApp Web automation
- **SQLite Database** - Persistent data storage
- **Multer** - File upload handling

### Frontend Architecture
- **React Hooks** - State management
- **React Router** - Client-side routing
- **Socket.io Client** - Real-time updates
- **Axios** - HTTP requests
- **Tailwind CSS** - Responsive design

---

## 📱 Dashboard

### Purpose
Central monitoring hub for WhatsApp connection and blast statistics.

### Features
1. **WhatsApp Status Badge**
   - Shows real-time connection status
   - Color-coded indicators
   - Auto-refreshes on connection change

2. **Statistics Cards**
   - Total Contacts
   - Active Blast Sessions
   - Messages Successfully Sent
   - Failed Messages

3. **Active Blast Monitor**
   - Real-time progress bar
   - Current vs. total contacts
   - Success/failure count
   - Last recipient info

4. **Recent Sessions Table**
   - Last 5 blast sessions
   - Session names and metrics
   - Status at a glance
   - Quick access to details

### Socket.io Events Used
- `wa:status` - Connection status
- `wa:qr` - QR code for new sessions
- `blast:started` - Blast begins
- `blast:progress` - Live progress updates
- `blast:completed` - Session finished

---

## 📋 Contacts Management

### Purpose
Organize and manage WhatsApp contact database for targeted campaigns.

### Features

#### Add Single Contact
- Manual contact entry form
- Name (optional) and phone (required)
- Group assignment
- Prevents duplicates via UNIQUE constraint

#### Bulk CSV Import
- Drag-and-drop or file picker
- Auto-detects multiple CSV formats
  - `name` / `Name` / `NAMA`
  - `phone` / `Phone` / `NOMOR` / `nomor`
- Group assignment during import
- Import report (successful/skipped count)
- Auto-cleanup of temporary files

#### Contact Organization
- Group-based filtering
- All contacts view
- Group statistics (contact count)
- Quick group switching

#### Contact Actions
- Delete individual contacts
- Delete entire groups
- View contact details
- In-table editing (planned feature)

### Supported Phone Formats
```
✅ 081234567890    (0 prefix)
✅ 628234567890    (62 prefix)
✅ +628234567890   (international)
```

### Database Schema
```sql
CREATE TABLE contacts (
  id INTEGER PRIMARY KEY,
  name TEXT,
  phone TEXT NOT NULL UNIQUE,
  group_name TEXT DEFAULT 'default',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

---

## 🚀 Blast Messaging

### Purpose
Send personalized WhatsApp messages to bulk contacts with safety controls.

### Features

#### Message Composition
- Full-featured text area
- Template variable support
  - `{{name}}` → contact name
  - `{{phone}}` → contact phone
- Character counter (optional)
- Real-time preview
- Template picker dropdown

#### Template Integration
- One-click template loading
- Pre-saved message templates
- Personalization variables included
- Quick switch between templates

#### Targeting Options
1. **Group-based** (recommended)
   - Select pre-defined contact group
   - Shows contact count
   - Atomic operation safety

2. **Individual selection** (optional)
   - Pick specific contacts
   - Useful for follow-ups

#### Safety Controls
1. **Minimum Delay Configuration**
   - Default: 3000ms (3 seconds)
   - Prevents rate limiting
   - Configurable per blast

2. **Maximum Delay Configuration**
   - Default: 7000ms (7 seconds)
   - Varies timing to avoid pattern detection
   - Randomizer: `random(min, max)`

3. **Pre-flight Checks**
   - Validates WhatsApp connection
   - Confirms message content
   - Verifies contact availability
   - Shows contact count

#### Blast Execution
1. Creates new session record
2. Fetches target contacts
3. Processes message template
4. Sends with random delay between each
5. Logs each result (success/failure)
6. Real-time progress broadcast

#### Progress Monitoring
- Live counter: X/Total
- Success count
- Failure count
- Percentage bar
- Current recipient info
- Last message status

#### Cancellation
- Stop button during active blast
- Graceful shutdown
- Session marked as cancelled
- Remaining contacts not processed

### Message Variables Example
```
Subject: Product Launch Special!

Hi {{name}},

We're launching our new product line this Friday!
Exclusive pre-order discount for {{phone}} only.

Reserve yours now: [link]

Best regards,
Sales Team
```

### Processing Logic
```
For each contact:
  1. Replace {{name}} with contact.name
  2. Replace {{phone}} with contact.phone
  3. Check number exists on WhatsApp
  4. Send message
  5. Wait random(delayMin, delayMax)
  6. Log result
  7. On error: continue with next contact
```

### Database Schema
```sql
CREATE TABLE blast_sessions (
  id INTEGER PRIMARY KEY,
  name TEXT,
  message TEXT,
  total INTEGER,
  sent INTEGER,
  failed INTEGER,
  status TEXT, -- pending|running|completed|cancelled
  started_at DATETIME,
  completed_at DATETIME,
  created_at DATETIME
)

CREATE TABLE blast_logs (
  id INTEGER PRIMARY KEY,
  session_id INTEGER,
  phone TEXT,
  name TEXT,
  status TEXT, -- sent|failed
  error_message TEXT,
  sent_at DATETIME,
  FOREIGN KEY (session_id) REFERENCES blast_sessions
)
```

---

## 💬 Message Templates

### Purpose
Create and reuse message templates for common campaigns.

### Features

#### Template Management
- Create new templates
  - Name (title)
  - Content (message body)
- Edit existing templates
  - Modify name or content
  - Immediate updates
- Delete templates
  - Remove from database
  - Can be recreated

#### Template Usage
- Use in blast campaigns
- Click dropdown → select template
- Auto-populate message textarea
- Can edit after selection

#### Variables Support
- `{{name}}` - personalizes to contact name
- `{{phone}}` - adds contact number
- Plain text also supported

#### Template Examples

**Sales Pitch Template:**
```
Hi {{name}},

Limited time offer!
Click here to claim your discount.
Your phone: {{phone}}

Don't miss out!
```

**Appointment Reminder:**
```
Hello {{name}},

This is a reminder for your appointment.
We'll call you at {{phone}} on Friday at 2 PM.

Confirm by replying "YES"
```

### Database Schema
```sql
CREATE TABLE templates (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

---

## 📊 Blast Logs & Analytics

### Purpose
Track and analyze blast campaign results with detailed logging.

### Features

#### Session Overview
- Expandable session list
- Shows per session:
  - Session name
  - Created date/time
  - Total contacts targeted
  - Sent count (green)
  - Failed count (red)
  - Status badge (completed/running/failed)
  - Delete button

#### Detailed Logs
- Click to expand session
- Shows all recipient records
- Columns per message:
  - Contact name
  - Phone number
  - Delivery status (sent/failed)
  - Error message (if failed)
  - Sent timestamp

#### Log Actions
- View by expanding session
- Delete individual sessions
- Scroll through large logs (max-height with scroll)
- Search/filter (planned feature)

#### Data Visualization
- Status badges with color coding
- Count indicators
- Time-based sorting
- Responsive table layout

### Error Tracking
When message fails:
1. Error reason captured
2. Possible reasons:
   - "Number not registered on WhatsApp"
   - Network timeout
   - WhatsApp rate limit
   - Invalid phone format
3. Contact info preserved
4. Can retry later (manual)

### Database Queries Used
```sql
SELECT * FROM blast_sessions ORDER BY created_at DESC
SELECT * FROM blast_logs WHERE session_id=? ORDER BY sent_at DESC
DELETE FROM blast_logs WHERE session_id=?
DELETE FROM blast_sessions WHERE id=?
```

---

## 🔐 WhatsApp Authentication

### Purpose
Securely connect to WhatsApp Web for messaging.

### Connection Flow

1. **Initialization**
   - Client instantiated with LocalAuth
   - Session stored: `.wwebjs_auth/`
   - Chromium headless browser started

2. **QR Display**
   - QR event triggered
   - Code displayed on Dashboard
   - Client status: `qr`

3. **Scanning**
   - User scans on phone
   - WhatsApp WebSocket authenticated
   - LocalAuth saves session token

4. **Connection Established**
   - Client status: `connecting`
   - Authenticated event fired
   - Client status: `ready`

5. **Persistent Session**
   - Token stored in `.wwebjs_auth/`
   - Next startup: auto-reconnect
   - No QR scan needed

### Session Persistence
- **Location:** `backend/.wwebjs_auth/`
- **Includes:**
  - Session tokens
  - User credentials (encrypted)
  - Device info
- **Persistence:** Until manual logout
- **Reset:** Delete folder + restart

### Disconnection Handling
- Auto-reconnect after 5 seconds
- Retains session if valid
- New QR only if session expired
- Dashboard shows status changes

### API Endpoints
- `GET /api/auth/status` - Current status + QR
- `POST /api/auth/logout` - Clear session + disconnect

---

## 🔌 Real-time Updates (Socket.io)

### WhatsApp Events
```
wa:status    → Connection status changed
wa:qr        → New QR code (scan needed)
wa:loading   → Loading progress
wa:ready     → Connected successfully
wa:disconnected → Connection lost
```

### Blast Events
```
blast:started     → New session created
blast:progress    → Message sent/failed
blast:completed   → Session finished
blast:cancelled    → Cancelled by user
blast:waiting     → Delay between messages
```

### Real-time Architecture
1. Backend initializes Socket.io server
2. Frontend connects on mount
3. Events broadcasted to all connected clients
4. No polling needed - instant updates
5. Handles multiple concurrent users

---

## 🛡️ Safety & Rate Limiting

### WhatsApp Rate Limits
- **Contact per day:** ~500 messages recommended
- **Delay between:** 3-7 seconds minimum
- **Concurrent:** 1 device per account

### Built-in Protections
1. **Delay System**
   - Random delay between min/max
   - Simulates human behavior
   - Avoids pattern detection

2. **Error Handling**
   - Failed messages don't stop blast
   - Each failure logged
   - User notified of failures

3. **Connection Limits**
   - Single WhatsApp session per server
   - Prevents duplicate connects
   - LocalAuth prevents multi-device

4. **Message Validation**
   - Check number exists before sending
   - Proper format conversion
   - Handle international numbers

### Best Practices
```
✅ DO:
- Test with small group first (5-10)
- Use 4-5 second average delay
- Spread campaigns over time
- Monitor for failures
- Respect recipient preferences

❌ DON'T:
- Send to more than 500/day
- Use minimum delay < 2 seconds
- Send spam/unsolicited messages
- Change phone number often
- Ignore account warnings
```

---

## 📈 Performance Considerations

### Database Optimization
- SQLite in-memory option (future)
- Indexed phone column (unique)
- Transaction batching for imports
- Prepared statements for queries

### Frontend Optimization
- Component-level code splitting
- Route-based lazy loading
- Image optimization in Vite
- CSS purging via Tailwind

### Backend Performance
- Async message sending
- Batch logging operations
- Connection pooling (future)
- Memory-efficient streaming

---

## 🔄 Data Flow Diagram

```
Frontend                    Backend                    WhatsApp
   │                          │                           │
   ├─ Click Send Blast ──────>│                           │
   │                          ├─ Create Session           │
   │                          ├─ Fetch Contacts           │
   │<─── blast:started ──────│                           │
   │                          ├──────────────────────────>│
   │                          │ Send Message (with delay) │
   │<─── blast:progress ─────│<──────────── Delivered ───│
   │                          │                           │
   │<─── blast:progress ─────│ (repeat for each contact) │
   │                          │                           │
   │<─ blast:completed ──────│                           │
   │                          ├─ Update Session (final)   │
   └─ Display Results          └──────────────────────────└
```

---

## 🐛 Debugging Features

### Logging
- Backend: Console logs with timestamps
- Frontend: Browser DevTools
- Database: SQLite direct access
- Socket.io: Event inspection

### Error Reporting
- Try-catch in all async functions
- Meaningful error messages
- Toast notifications to user
- Detailed logs in database

### Monitoring
- Real-time progress updates
- Status indicators
- Count-down timers
- Success/failure indicators

---

## 🚀 Future Enhancements

Potential features for next versions:

1. **Scheduling**
   - Schedule blasts for specific time
   - Recurring campaigns
   - Auto-send on triggers

2. **Analytics**
   - Delivery rate graphs
   - Time-based analysis
   - Export reports (CSV/PDF)

3. **Advanced Targeting**
   - Filter by last contacted
   - Segment contacts
   - Re-engagement campaigns

4. **Media Support**
   - Image messages
   - Document sharing
   - Audio/video clips

5. **Automation**
   - Webhook triggers
   - API integrations
   - Response handling

6. **Security**
   - Two-factor authentication
   - Audit logs
   - Access controls

---

Last Updated: April 2024
