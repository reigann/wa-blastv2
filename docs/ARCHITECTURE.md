# 🏗️ WhatsApp Blaster - Architecture & Design

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      WhatsApp Blaster                        │
├──────────────────┬──────────────────┬──────────────────────┤
│   Frontend       │    Backend       │   External Services  │
│   (React Vite)   │  (Express.io)    │                      │
├──────────────────┼──────────────────┼──────────────────────┤
│ • Dashboard      │ • RESTful API    │ • WhatsApp Web       │
│ • Contacts       │ • Socket.io      │ • Chrome (headless) │
│ • Blast Sender   │ • SQLite DB      │ • WhatsApp WebSocket │
│ • Templates      │ • File Upload    │                      │
│ • Logs           │ • Session Auth   │                      │
└──────────────────┴──────────────────┴──────────────────────┘
```

---

## Backend Architecture

### Server Structure

```
backend/
├── server.js                 ← Main entry point
├── .env                      ← Configuration
├── package.json              ← Dependencies
├── db/
│   └── database.js           ← Database initialization
├── services/
│   ├── whatsappService.js    ← WhatsApp Web integration
│   └── blastService.js       ← Blast logic
├── routes/
│   ├── auth.js               ← Authentication endpoints
│   ├── contacts.js           ← Contact CRUD
│   ├── blast.js              ← Blast operations
│   └── templates.js          ← Template CRUD
└── uploads/                  ← Temporary CSV uploads
```

### Core Components

#### 1. Express Server (`server.js`)
```javascript
// Initialization flow
require('dotenv').config()
↓
Create HTTP server with Socket.io
↓
Setup CORS & middleware
↓
Mount API routes
↓
Initialize WhatsApp client
↓
Listen on PORT
```

**Responsibilities:**
- Serve API endpoints
- Manage Socket.io connections
- Coordinate between services
- Handle CORS for frontend

#### 2. WhatsApp Service (`services/whatsappService.js`)

**Class: WhatsAppClient**

```
State Machine:
disconnected → qr → connecting → connected → disconnected (cycle)
```

**Key Methods:**
- `initWhatsApp(io)` - Initialize client with puppeteer
- `getClient()` - Get active client instance
- `getStatus()` - Return current status + QR
- `sendMessage(phone, message)` - Send single message
- `logout()` - Disconnect and clear session

**Puppeteer Configuration:**
```
Headless: true (no visible browser)
Args: [
  --no-sandbox        ← Let any user run
  --disable-gpu       ← No GPU rendering
  --disable-dev-shm   ← Use disk instead of RAM
  ... (security flags)
]
```

**Number Format Conversion:**
```
Input: 081234567890      →  Validate (08xxx format)
       ↓
Convert: 62 + 81234567890
         ↓
Format: 628xxx@c.us     →  WhatsApp Chat ID
```

**Validation:**
```javascript
isRegisteredUser(chatId)  ← Check number exists on WA
    ↓
If not registered → throw Error
If registered     → proceed with send
```

#### 3. Blast Service (`services/blastService.js`)

**Execution Model: Sequential Processing**

```
Start Blast
    ↓
For each contact:
  ├─ Process template ({{name}}, {{phone}})
  ├─ Send message
  │  ├─ Success → Log as 'sent'
  │  └─ Error   → Log as 'failed' with error
  ├─ Update counters
  └─ Wait random(min, max) ms
    ↓
Mark session complete
```

**Key Functions:**
- `startBlast(sessionId, contacts, message, delays)` - Main loop
- `processTemplate(message, contact)` - Variable replacement
- `randomDelay(min, max)` - Simulate human behavior
- `cancelBlast()` - Flag for cancellation
- `getActiveBlast()` - Check if running

**Error Handling:**
```javascript
try {
  sendMessage()
} catch (error) {
  logFailure(error);
  continue;  // Don't stop on single failure
}
```

### API Routes

#### Auth Routes (`routes/auth.js`)
```
GET  /api/auth/status
     └─ Return: { status, qr }

POST /api/auth/logout
     └─ Call: whatsappService.logout()
```

#### Contacts Routes (`routes/contacts.js`)
```
GET    /api/contacts              ← Get all, filtered by ?group
GET    /api/contacts/groups       ← Get groups with counts
POST   /api/contacts              ← Add single contact
POST   /api/contacts/upload       ← CSV import
DELETE /api/contacts/:id          ← Delete one
DELETE /api/contacts?group=name   ← Delete group
```

**CSV Processing:**
```
Stream CSV → Parse each row
           ↓
Detect headers (name/Name/NAMA, phone/Phone/NOMOR)
           ↓
Transaction batch insert
           ↓
Handle duplicates (UNIQUE constraint)
           ↓
Return stats { imported, skipped, total }
```

#### Blast Routes (`routes/blast.js`)
```
GET    /api/blast/sessions        ← Get all sessions
GET    /api/blast/sessions/:id/logs ← Get session details
POST   /api/blast/start           ← Create & start session
POST   /api/blast/cancel          ← Cancel active blast
GET    /api/blast/active          ← Check if running
DELETE /api/blast/sessions/:id    ← Delete session
```

**Blast Start Flow:**
```
1. Validate input
2. Check if already running
3. Fetch target contacts
4. Create session in DB
5. Start async startBlast()
6. Return immediately with sessionId
```

#### Templates Routes (`routes/templates.js`)
```
GET    /api/templates             ← Get all templates
POST   /api/templates             ← Create template
PUT    /api/templates/:id         ← Update template
DELETE /api/templates/:id         ← Delete template
```

### Database Schema

#### Table: contacts
```sql
CREATE TABLE contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  phone TEXT NOT NULL UNIQUE,          ← Prevents duplicates
  group_name TEXT DEFAULT 'default',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)

Indexes:
  • phone (UNIQUE) - Fast lookup & duplicate prevention
  • group_name - Fast group filtering
```

#### Table: templates
```sql
CREATE TABLE templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                  ← Template identifier
  content TEXT NOT NULL,               ← Message template
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

#### Table: blast_sessions
```sql
CREATE TABLE blast_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,                          ← User-friendly name
  message TEXT,                       ← Full message sent
  total INTEGER DEFAULT 0,            ← Initial contact count
  sent INTEGER DEFAULT 0,             ← Success counter
  failed INTEGER DEFAULT 0,           ← Failure counter
  status TEXT DEFAULT 'pending',      ← pending|running|completed|cancelled
  scheduled_at DATETIME,              ← For future scheduling
  started_at DATETIME,                ← When actually started
  completed_at DATETIME,              ← When finished
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

#### Table: blast_logs
```sql
CREATE TABLE blast_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER,                 ← FK to blast_sessions
  phone TEXT,                         ← Recipient number
  name TEXT,                          ← Recipient name
  status TEXT,                        ← sent|failed
  error_message TEXT,                 ← Reason if failed
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES blast_sessions(id)
)

Index:
  • session_id - Fast lookup of logs for session
```

### Socket.io Events

**Server → Client (Frontend Listener):**
```
Event: wa:status
Data: { status: 'connected|disconnected|qr|connecting' }
→ Updates WhatsApp connection badge

Event: wa:qr
Data: { qr: 'data:image/png;base64,...' }
→ Displays QR code modal

Event: wa:loading
Data: { percent: 0-100, message: 'Loading WhatsApp...' }
→ Shows loading progress

Event: blast:started
Data: { sessionId: 123, total: 50 }
→ Initialize blast progress UI

Event: blast:progress
Data: {
  sessionId: 123,
  current: 5,
  total: 50,
  sent: 4,
  failed: 1,
  phone: '628xxx@c.us',
  name: 'John Doe',
  status: 'sent|failed'
}
→ Update live progress

Event: blast:completed
Data: { sessionId: 123, sent: 45, failed: 5, total: 50 }
→ Show completion summary

Event: blast:cancelled
Data: { sessionId: 123 }
→ Show cancellation message
```

**Client → Server (Optional):**
Currently no client-emitted events in use. Could add:
- `blast:cancel` - User cancels
- `wa:update-qr` - Manual QR refresh

### Session Management

**WhatsApp Session Storage:**
```
Location: backend/.wwebjs_auth/
Contains:
  • Session tokens
  • Encrypted credentials
  • Device info
  • Cookies
  
Persistence: Survives server restarts
Lifespan: Until manual logout or token expiry (~1-2 weeks)
Recovery: Auto-reconnects on server restart

Reset: Delete folder + restart server
```

---

## Frontend Architecture

### Directory Structure

```
frontend/
├── src/
│   ├── main.jsx                ← Entry point
│   ├── App.jsx                 ← Root component + router
│   ├── style.css               ← Global styles (Tailwind)
│   ├── pages/
│   │   ├── Dashboard.jsx       ← Stats & monitoring
│   │   ├── Contacts.jsx        ← Contact management
│   │   ├── Blast.jsx           ← Blast sender
│   │   ├── Templates.jsx       ← Template management
│   │   └── Logs.jsx            ← Blast history
│   ├── components/
│   │   ├── Sidebar.jsx         ← Navigation
│   │   ├── QRModal.jsx         ← QR code display
│   │   └── StatusBadge.jsx     ← Status indicator
│   ├── hooks/
│   │   └── useSocket.js        ← Socket.io integration
│   └── services/
│       └── api.js              ← Axios API client
├── index.html                  ← HTML template
├── vite.config.js              ← Vite configuration
├── tailwind.config.js          ← Tailwind CSS config
└── postcss.config.js           ← PostCSS config
```

### Component Hierarchy

```
App (Root)
├── Sidebar (Navigation)
│   └── Link to each page
└── Routes
    ├── Dashboard
    │   ├── StatusBadge
    │   ├── QRModal (conditional)
    │   └── Stats Cards
    ├── Contacts
    │   ├── Filter Buttons
    │   ├── Add Form (conditional)
    │   └── Contacts Table
    ├── Blast
    │   ├── QRModal (conditional)
    │   ├── Progress Card (conditional)
    │   └── Blast Form
    ├── Templates
    │   ├── Template Form
    │   └── Templates List
    └── Logs
        ├── Sessions List
        └── Expandable Logs Table
```

### State Management Strategy

**Global State:**
- WhatsApp connection status
- Blast progress
- QR code for display

**Local State (per component):**
- Form inputs
- Expanded/collapsed states
- Loading states
- Modal visibility

**Updates Via:**
- Socket.io events (real-time)
- API calls (actions)
- User interactions (form changes)

### useSocket Hook

```javascript
const { waStatus, qrCode, blastProgress, blastStatus } = useSocket()

Returns:
  • waStatus: 'connected'|'disconnected'|'qr'|'connecting'
  • qrCode: Base64 PNG string or null
  • blastProgress: { current, total, sent, failed, ... }
  • blastStatus: 'started'|'completed'|'cancelled'|null
```

**Hook Logic:**
```javascript
useEffect(() => {
  1. Connect Socket.io to backend (port 3001)
  2. Register event listeners
     - wa:status → update waStatus
     - wa:qr → update qrCode
     - blast:* → update blast states
  3. Cleanup: disconnect on unmount
}, [])
```

### API Service Layer

```javascript
export const contactsAPI = {
  getAll: (group?) → GET /api/contacts?group=X
  getGroups: () → GET /api/contacts/groups
  add: (data) → POST /api/contacts
  uploadCSV: (formData) → POST /api/contacts/upload
  delete: (id) → DELETE /api/contacts/:id
  deleteAll: (group) → DELETE /api/contacts?group=X
}

export const blastAPI = {
  getSessions: () → GET /api/blast/sessions
  getSessionLogs: (id) → GET /api/blast/sessions/:id/logs
  start: (data) → POST /api/blast/start
  cancel: () → POST /api/blast/cancel
  isActive: () → GET /api/blast/active
  deleteSession: (id) → DELETE /api/blast/sessions/:id
}

export const templatesAPI = {
  getAll: () → GET /api/templates
  create: (data) → POST /api/templates
  update: (id, data) → PUT /api/templates/:id
  delete: (id) → DELETE /api/templates/:id
}
```

All use axios with:
- `baseURL: http://localhost:3001/api`
- `timeout: 30000`

### Styling Strategy

**Tailwind CSS:**
- Utility-first approach
- Pre-configured breakpoints (sm, md, lg, xl, 2xl)
- Custom spacing scale
- Green color palette for WhatsApp theme

**File: tailwind.config.js**
```javascript
content: [
  './index.html',
  './src/**/*.{js,jsx,ts,tsx}'
]
// Scans files for class names
// Only includes used styles in build
```

### Build Configuration (Vite)

**File: vite.config.js**
```javascript
plugins: [react()]  ← React Fast Refresh
```

**Benefits:**
- HMR (Hot Module Replacement) - changes instant
- Lightning fast builds
- Optimized for React

---

## Data Flow Diagram

### Sending a Blast

```
┌─── Frontend ─────────────┐
│                          │
│  User submits form       │
│  ├─ Group: "customers"   │
│  ├─ Message: "Hi {{name}}"
│  └─ Delays: 3000-7000ms  │
│                          │
└────────┬─────────────────┘
         │
         ├─→ POST /api/blast/start
         │
┌────────┴─────────────────┐
│    Backend Processing    │
│                          │
│  1. Validate input       │
│  2. Fetch contacts       │
│  3. Create session       │
│  4. Start async loop     │
│                          │
│  For each contact:       │
│  ├─ Get: "John", "628xx"│
│  ├─ Process: "Hi John"   │
│  ├─ Send to WhatsApp     │
│  ├─ Wait 4-6 seconds     │
│  ├─ Log result           │
│  └─ Emit blast:progress  │
│                          │
└────────┬─────────────────┘
         │
         ├→ Socket.io broadcast
         │
┌────────┴─────────────────┐
│  Frontend Receives       │
│                          │
│  - blast:progress events │
│  - Update UI in real-time│
│  - Show counters         │
│  - Show names            │
│  - Show errors           │
│                          │
└──────────────────────────┘
```

### Contact Upload Process

```
Frontend: User uploads CSV
    ↓
Browser reads file
    ↓
POST FormData to /api/contacts/upload
    ↓
Backend: Multer receives file
    ↓
Read CSV stream → Parse each row
    ↓
For each row:
  ├─ Extract name, phone
  ├─ Validate phone
  ├─ Attempt insert
  ├─ Handle duplicate
    ↓
    Count: imported + skipped
    ↓
Delete temp file
    ↓
Return: { imported: X, skipped: Y, total: Z }
    ↓
Frontend: Show toast notification
    ↓
Refresh contacts list via API
```

---

## Security Considerations

### Input Validation
- Phone numbers: Validated format
- Contact names: No SQL injection (parameterized queries)
- Messages: Plain text, no code execution
- File upload: Size limits, MIME type check (future)

### CORS
```javascript
Access-Control-Allow-Origin: http://localhost:5173
Methods: GET, POST, PUT, DELETE
Credentials: not sent (API tokens not used)
```

### Session Security
- LocalAuth stores tokens locally
- Not transmitted over network
- Device ID prevents multi-login
- Logout clears all session data

### Error Handling
- No sensitive info in error messages
- Numbers partially masked in logs (future)
- Stack traces only in development
- Rate limiting prevents brute force (future)

---

## Performance Optimization

### Frontend
- Code splitting by route
- Lazy loading pages
- CSS purging via Tailwind
- Image optimization via Vite
- React.memo for expensive components (future)

### Backend
- Database indexing on frequently queried fields
- Async/await for non-blocking I/O
- Transaction batching for bulk inserts
- Connection pooling (future)
- Caching for frequently accessed data (future)

### Network
- Socket.io binary frames
- WebSocket for low latency
- HTTP pipelining
- Compression via middleware (future)

---

## Deployment Considerations

### Environment Variables Required
```
PORT=3001
FRONTEND_URL=http://your-domain.com
DELAY_MIN=3000
DELAY_MAX=7000
NODE_ENV=production
```

### Database
- SQLite suitable for single-instance deployment
- For scaling: migrate to PostgreSQL
- Backup `.db` file regularly
- .wwebjs_auth folder must persist

### Frontend Build
```bash
npm run build  → Outputs to dist/
```
Serve via:
- Nginx (recommended)
- Vercel
- Netlify
- GitHub Pages

### Backend Deployment
- Node.js hosting: Heroku, Railway, Render
- Docker containerization (Dockerfile)
- Process manager: PM2, systemd
- Reverse proxy: Nginx

### Browser Requirements
- Chrome/Chromium (for whatsapp-web.js)
- Node.js process must have display capabilities
- Xvfb for headless servers (Linux)

---

## Monitoring & Logging

### Logs to Track
- **Backend console:** All socket events and API calls
- **Database:** Every message sent/failed
- **Browser console:** Frontend errors
- **Network tab:** API response times

### Metrics to Monitor
- Messages sent per day
- Success/failure ratio
- Average response time
- Active socket connections
- Database size growth

### Error Scenarios
1. WhatsApp disconnected → Auto-reconnect in 5 sec
2. Number not registered → Logged, continue
3. Network timeout → Retry (future)
4. Database error → Transaction rollback
5. File upload too large → Validation before upload

---

## Testing Strategy (Future)

### Unit Tests
- Message template processing
- Phone number formatting
- CSV parsing

### Integration Tests
- API endpoints
- Database CRUD operations
- Socket.io event flow

### End-to-End Tests
- Complete blast workflow
- Contact import flow
- Template usage

### Load Testing
- Concurrent blast sessions
- Multiple socket connections
- CSV upload handling

---

Last Updated: April 2024
