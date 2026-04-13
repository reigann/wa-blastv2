# WhatsApp Blaster - Complete Setup Guide

A full-stack WhatsApp bulk messaging system with Node.js backend and React frontend.

## 📋 Project Structure

```
wa-blaster/
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── .env
│   ├── routes/
│   │   ├── blast.js
│   │   ├── contacts.js
│   │   ├── auth.js
│   │   └── templates.js
│   ├── services/
│   │   ├── whatsappService.js
│   │   └── blastService.js
│   ├── db/
│   │   └── database.js
│   └── uploads/          ← auto-created (CSV uploads)
│
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── main.jsx
    │   ├── style.css
    │   ├── pages/
    │   │   ├── Dashboard.jsx
    │   │   ├── Contacts.jsx
    │   │   ├── Blast.jsx
    │   │   ├── Templates.jsx
    │   │   └── Logs.jsx
    │   ├── components/
    │   │   ├── QRModal.jsx
    │   │   ├── StatusBadge.jsx
    │   │   └── Sidebar.jsx
    │   ├── hooks/
    │   │   └── useSocket.js
    │   └── services/
    │       └── api.js
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    └── postcss.config.js
```

## 🛠️ Tech Stack

### Backend
- **Node.js v18+** - JavaScript runtime
- **Express** - Web framework
- **Socket.io** - Real-time communication
- **whatsapp-web.js** - WhatsApp Web integration
- **better-sqlite3** - Lightweight database
- **Multer** - File upload handling
- **QRCode** - QR code generation
- **csv-parser** - CSV parsing

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool
- **React Router** - Navigation
- **Socket.io-client** - Real-time communication
- **Tailwind CSS** - Styling
- **Axios** - HTTP client
- **react-hot-toast** - Notifications
- **lucide-react** - Icons
- **papaparse** - CSV parsing

## ⚙️ Prerequisites

Before starting, ensure you have:
- **Node.js v18+** installed ([download](https://nodejs.org/))
- **npm** or **yarn** package manager
- A WhatsApp-enabled phone with mobile internet
- Chrome or Chromium installed (for whatsapp-web.js)

## 🚀 Installation & Setup

### Step 1: Install Backend Dependencies

```bash
cd backend
npm install
```

### Step 2: Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

### Step 3: Configure Environment Variables

The `.env` file is already created in the `backend/` folder with default values:

```env
PORT=3001
FRONTEND_URL=http://localhost:5173
DELAY_MIN=3000
DELAY_MAX=7000
```

**Parameters:**
- `PORT` - Backend server port
- `FRONTEND_URL` - Frontend URL (for CORS)
- `DELAY_MIN` - Minimum delay between messages (ms)
- `DELAY_MAX` - Maximum delay between messages (ms)

## 📱 Running the Application

### Terminal 1: Start Backend

```bash
cd backend
npm run dev
```

Expected output:
```
Backend running on http://localhost:3001
```

### Terminal 2: Start Frontend

```bash
cd frontend
npm run dev
```

Expected output:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
```

### Open Browser

Navigate to: **http://localhost:5173**

## 🔐 WhatsApp Connection (First Time)

1. **Dashboard loads** → QR code appears automatically
2. **Scan with WhatsApp:**
   - Open WhatsApp on your phone
   - Go to Settings → Linked Devices → Link a Device
   - Scan the QR code shown in the browser
3. **Wait for connection:**
   - Status changes to "Connecting..."
   - Once connected, status shows "Connected"
   - QR modal disappears

> ⚠️ **Important:** The connection data is stored in `backend/.wwebjs_auth/`. Do NOT delete this folder as it contains your session. If deleted, you'll need to scan the QR code again.

## 📚 Features Guide

### 1. Dashboard
- Real-time WhatsApp connection status
- Quick stats (contacts, sessions, sent, failed)
- Active blast progress monitoring
- Recent blast sessions overview

### 2. Contacts Management
- **Add Single Contact:** Name + Phone number
- **Import from CSV:** Upload bulk contacts
- **Organize by Groups:** Categorize contacts
- **CSV Format Example:**
  ```csv
  name,phone
  John Doe,081234567890
  Jane Smith,082345678901
  ```
- Supported phone formats: `08xxx`, `628xxx`, or `+628xxx`

### 3. Send Blast (Bulk Messages)
1. Select target group from dropdown
2. Write message with personalization
   - Use `{{name}}` for contact name
   - Use `{{phone}}` for phone number
3. Set delay parameters:
   - Min delay: 3000ms recommended
   - Max delay: 7000ms recommended
4. Click "Start Blast"
5. Monitor real-time progress

**Example Message:**
```
Hi {{name}},

This is a special offer just for you!
Reply to confirm your participation.

Best regards,
Marketing Team
```

### 4. Message Templates
- Create reusable message templates
- Edit existing templates
- Delete templates
- Quickly apply templates during blast

### 5. Blast Logs
- View all previous blast sessions
- Expand session to see detailed logs
- Check individual message status
- View error messages for failed sends
- Delete sessions from history

## 🚨 Important Notes

### Ban Risk Prevention
- ⚠️ **Keep minimum delay at 3000ms** to reduce ban risk
- Don't send to more than 500 contacts per day per number
- **Test with 5-10 contacts first** before large campaigns
- Space out blasts with time intervals
- Don't use aggressive timing

### Session Management
- Session data stored in `backend/.wwebjs_auth/`
- Database stored in `backend/db/blaster.db`
- Session persists even after app restart
- To reset: delete `.wwebjs_auth/` folder and restart

### Phone Number Validation
- Accepts: `08xxx`, `628xxx`, `+628xxx`
- Validates against WhatsApp registration
- Invalid numbers fail gracefully with error message

### Database
- SQLite database automatically created on first run
- Tables: contacts, templates, blast_sessions, blast_logs
- No setup required

## 🔧 Troubleshooting

### QR Code Not Appearing
**Solution:** 
- Check console for errors
- Ensure backend is running on port 3001
- Restart both backend and frontend

### Messages Failing to Send
**Possible Causes:**
- Number not registered on WhatsApp
- WhatsApp account banned (too many messages)
- Network connectivity issue
- Phone number format incorrect

**Solution:**
- Check error message in logs
- Verify number exists on WhatsApp manually
- Increase delay between messages
- Use smaller contact groups

### "WhatsApp is not connected" Error
**Solution:**
- Check connection status on Dashboard
- Scan QR code again if disconnected
- Ensure WhatsApp is open on your phone
- Check internet connection

### Port Already in Use
**Solution:**
```bash
# Change port in backend/.env
PORT=3002  # or any other available port
```

### CSV Import Issues
**Solution:**
- Ensure CSV has headers: `name`, `phone`
- Phone numbers must be in column named exactly `phone` or `Phone` or `NOMOR`
- Remove special characters from numbers
- Save CSV as UTF-8 encoding

## 📝 API Endpoints

### Authentication
- `GET /api/auth/status` - Get WhatsApp connection status
- `POST /api/auth/logout` - Logout from WhatsApp

### Contacts
- `GET /api/contacts` - Get all contacts
- `GET /api/contacts/groups` - Get contact groups
- `POST /api/contacts` - Add single contact
- `POST /api/contacts/upload` - Upload CSV
- `DELETE /api/contacts/:id` - Delete contact
- `DELETE /api/contacts?group=name` - Delete group

### Blast
- `GET /api/blast/sessions` - Get all blast sessions
- `GET /api/blast/sessions/:id/logs` - Get session logs
- `POST /api/blast/start` - Start new blast
- `POST /api/blast/cancel` - Cancel active blast
- `GET /api/blast/active` - Check if blast is running
- `DELETE /api/blast/sessions/:id` - Delete session

### Templates
- `GET /api/templates` - Get all templates
- `POST /api/templates` - Create template
- `PUT /api/templates/:id` - Update template
- `DELETE /api/templates/:id` - Delete template

## 🔌 Socket.io Events

### Server → Client
- `wa:status` - WhatsApp connection status
- `wa:qr` - QR code for scanning
- `wa:loading` - Loading progress
- `wa:ready` - Connection established
- `wa:disconnected` - Connection lost
- `blast:started` - Blast session started
- `blast:progress` - Progress update
- `blast:completed` - Blast finished
- `blast:cancelled` - Blast was cancelled

## 📦 Build for Production

### Backend
```bash
npm start  # Runs with node (not nodemon)
```

### Frontend
```bash
npm run build   # Creates optimized build in dist/
npm run preview # Preview production build locally
```

## 🐛 Debugging

### View Backend Logs
```bash
cd backend
npm run dev   # Shows real-time logs
```

### View Database Content
```bash
cd backend
npx sqlite3 db/blaster.db
> .tables              # Show all tables
> SELECT * FROM contacts;  # View contacts
> SELECT * FROM blast_sessions;  # View sessions
```

### Browser Developer Tools
1. Press `F12` or `Ctrl+Shift+I`
2. Check Console for errors
3. Network tab shows API requests
4. Application → Socket.io shows real-time events

## 📄 License

This project is provided as-is for educational and business purposes.

## ⚠️ Disclaimer

- This tool is for marketing with **user consent only**
- WhatsApp Terms of Service compliance is your responsibility
- Misuse may result in account bans
- Always comply with local laws and regulations

## 🎯 Next Steps

1. **Import Contacts** → Populate your contact database
2. **Create Templates** → Save time with message templates
3. **Test Blast** → Send to 5-10 contacts first
4. **Monitor Logs** → Check success rates and optimize
5. **Scale Blasts** → Increase contacts with proven results

## 📞 Support

For issues or questions:
1. Check troubleshooting section above
2. Review logs in backend console
3. Check browser developer console
4. Verify environment variables in `.env`

---

**Version:** 1.0.0  
**Last Updated:** April 2024
