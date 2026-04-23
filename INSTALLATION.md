# 📦 Installation Guide - WhatsApp Blaster

Detailed step-by-step instructions for installing and running the WhatsApp Blaster system.

## ✅ System Requirements

### Minimum Requirements
- **OS:** Windows 10+, macOS 10.14+, Linux (Ubuntu 18.04+)
- **RAM:** 2GB (4GB recommended)
- **Disk:** 500MB free space
- **Node.js:** v18.0.0 or higher
- **npm:** v7.0.0 or higher
- **Browser:** Chrome/Chromium/Firefox
- **Phone:** WhatsApp-enabled Android/iPhone

### Optional but Recommended
- **Git:** For version control
- **Docker:** For containerized deployment
- **Postman:** For API testing
- **SQLite Browser:** For database inspection

---

## 🪟 Windows Installation

### Step 1: Install Node.js

1. Visit [nodejs.org](https://nodejs.org/)
2. Download **LTS version** (v18 or v20)
3. Run installer `.exe`
4. Follow wizard:
   - ✅ Accept license agreement
   - ✅ Keep default installation path
   - ✅ Enable "npm package manager"
   - ✅ Skip optional dependencies
5. Click "Install"
6. Restart computer

### Step 2: Verify Installation

Open Command Prompt and type:
```cmd
node --version
npm --version
```

Should output:
```
v18.x.x
9.x.x
```

### Step 3: Clone or Download Project

**Option A: Using Git**
```cmd
git clone https://github.com/your-repo/whatsapp-blaster.git
cd whatsapp-blaster
```

**Option B: Manual Download**
1. Download ZIP from repository
2. Extract to desired folder
3. Open File Explorer to that folder
4. Shift + Right-click → "Open PowerShell here"

### Step 4: Install Backend Dependencies

```cmd
cd backend
npm install
```

Wait for installation to complete (~2-3 minutes).

Check successful installation:
```cmd
npm list whatsapp-web.js
```

### Step 5: Install Frontend Dependencies

Open new Command Prompt in project root:
```cmd
cd frontend
npm install
```

Wait for installation (~2-3 minutes).

### Step 5.5: Setup Python for Clustering (Optional)

The clustering feature requires Python. You can skip this if you don't need clustering functionality.

**Option A: Automatic Setup (Recommended)**
```cmd
cd backend
npm run setup-python
```

**Option B: Manual Setup**

1. Install Python from [python.org](https://www.python.org/downloads/) (3.8+)
2. Open Command Prompt in backend folder:
```cmd
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install scikit-learn pandas numpy
```

Verify:
```cmd
python -c "import sklearn, pandas, numpy; print('✅ OK')"
```

### Step 6: Verify Configuration

Check `.env` file in backend folder:
```env
PORT=3001
FRONTEND_URL=http://localhost:5173
DELAY_MIN=3000
DELAY_MAX=7000
```

All should be present with correct values.

### Step 7: Start Backend

Open Command Prompt:
```cmd
cd backend
npm run dev
```

Expected output:
```
Backend running on http://localhost:3001
```

### Step 8: Start Frontend

Open **new** Command Prompt/PowerShell, navigate to project:
```cmd
cd frontend
npm run dev
```

Expected output:
```
VITE v5.x.x  ready in 123 ms

➜  Local:   http://localhost:5173/
```

### Step 9: Open Application

1. Open web browser (Chrome recommended)
2. Go to: `http://localhost:5173`
3. You should see the WhatsApp Blaster dashboard
4. QR code modal appears (see WhatsApp Connection below)

---

## 🍎 macOS Installation

### Step 1: Install Node.js

**Using Homebrew (Recommended):**
```bash
# Install Homebrew if not installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node@18
```

**Manual Installation:**
1. Visit [nodejs.org](https://nodejs.org/)
2. Download macOS installer
3. Run `.pkg` file
4. Follow wizard

### Step 2: Verify Installation

```bash
node --version
npm --version
```

### Step 3-9: Follow Windows Steps (same commands)

Note: Use `bash` instead of `cmd`

---

## 🐧 Linux Installation

### Debian/Ubuntu

```bash
# Update package manager
sudo apt update
sudo apt upgrade

# Install Node.js
sudo apt install nodejs npm

# Verify
node --version
npm --version
```

### Red Hat/CentOS

```bash
sudo yum install nodejs npm
```

### Arch Linux

```bash
sudo pacman -S nodejs npm
```

### Rest of Installation: Follow Windows Steps (same)

---

## 🚀 First Run Checklist

After installation, verify everything works:

- [ ] Backend running on `http://localhost:3001`
- [ ] Frontend running on `http://localhost:5173`
- [ ] Both showing in browser without errors
- [ ] Dashboard loads with QR code modal
- [ ] Can scan QR with WhatsApp
- [ ] Status changes to "Connected"

---

## 🔐 WhatsApp Connection Setup

### Initial Connection (First Time)

1. **Browser shows QR modal**
   - Large QR code centered on screen
   - Instructions: "Open WhatsApp on your phone..."

2. **On your phone:**
   - Open WhatsApp app
   - Go to: **Settings** → **Linked Devices** → **Link a Device**
   - Point phone camera at QR code on screen
   - Click checkmark

3. **Wait for connection**
   - Status shows "Connecting..."
   - Loading screen with percentage
   - Takes 30-60 seconds
   - Once ready: "Connected" status badge

4. **First connection successful!**
   - QR modal closes
   - Dashboard shows statistics
   - Ready to send messages

### Session Persistence

The connection is saved automatically:
- **Location:** `backend/.wwebjs_auth/`
- **Behavior:** App remembers connection next time
- **Duration:** Session lasts 1-2 weeks then needs rescan

### Disconnection Recovery

If disconnected:
1. Status changes to "Disconnected"
2. QR modal appears automatically
3. Scan QR code again
4. Same connection flow as first time

### Manual Logout

To fully disconnect:
1. Dashboard → Status Badge
2. Or use API: `/api/auth/logout`
3. Session folder deleted
4. Requires fresh QR scan next time

---

## 📦 Update & Reinstall

### Update Dependencies

If updating later:
```bash
# Backend
cd backend
npm update

# Frontend
cd frontend
npm update
```

### Clean Reinstall

If facing issues:

```bash
# Backend
cd backend
rm -rf node_modules
rm package-lock.json
npm install
npm run dev

# Frontend
cd frontend
rm -rf node_modules
rm package-lock.json
npm install
npm run dev
```

### Reset Database

To clear all data (contacts, logs, sessions):

```bash
cd backend
rm db/blaster.db
npm run dev
```

Database recreates automatically on first run.

### Reset WhatsApp Session

To disconnect and start fresh:

```bash
cd backend
rm -rf .wwebjs_auth
npm run dev
```

Fresh QR code required on next dashboard load.

---

## 🆘 Troubleshooting

### "npm not found" Error
**Cause:** Node.js not installed or PATH not set
**Solution:** 
- Restart terminal and computer
- Reinstall Node.js
- Verify: `node --version`

### "Port 3001 already in use" Error
**Cause:** Another app using port 3001
**Solution:**
```bash
# Find what's using port 3001
# Windows
netstat -ano | findstr :3001

# macOS/Linux
lsof -i :3001

# Kill the process or use different port in .env
```

### "Chrome not found" Error
**Cause:** Chromium/Chrome not installed
**Solution:**
- Install Chrome from [google.com/chrome](https://www.google.com/chrome)
- Or install Chromium: `apt install chromium-browser` (Linux)
- Or install via Homebrew: `brew install chromium` (macOS)

### "Module not found" Error
**Cause:** Dependencies not installed
**Solution:**
```bash
npm install
npm install --force  # If conflicts
```

### QR Code Not Appearing
**Cause:** Backend not running or connection lost
**Solution:**
- Check backend terminal shows "Backend running..."
- Restart backend: `npm run dev`
- Check browser console for errors (F12)
- Refresh browser: Ctrl+R or Cmd+R

### Cannot Send Messages
**Cause:** WhatsApp not connected
**Solution:**
- Check status badge (should be "Connected")
- Rescan QR code
- Ensure phone has internet
- Close WhatsApp on other devices
- Try with manually verified contact

### CSV Import Failing
**Cause:** Column headers wrong
**Solution:**
- Verify headers are exactly: `name` and `phone`
- No extra spaces
- Save as UTF-8
- Test with small file first

### Database Errors
**Cause:** Corrupted database
**Solution:**
```bash
cd backend
rm db/blaster.db
npm run dev
```

---

## 🔧 Advanced Configuration

### Change Server Port

Edit `backend/.env`:
```env
PORT=3002  # Change from 3001
```

### Change Message Delays

Edit `backend/.env`:
```env
DELAY_MIN=2000  # Minimum 2 seconds
DELAY_MAX=5000  # Maximum 5 seconds
```

### Frontend URL (for remote access)

Edit `backend/.env`:
```env
FRONTEND_URL=http://your-ip:5173
# or
FRONTEND_URL=http://your-domain.com
```

---

## 🐳 Docker Installation (Advanced)

### Dockerfile Example

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy backend
COPY backend ./backend
COPY frontend ./frontend

# Install dependencies
RUN cd backend && npm install
RUN cd frontend && npm install

EXPOSE 3001 5173

CMD ["sh", "-c", "cd backend && npm start & cd frontend && npm run build"]
```

### Build and Run

```bash
docker build -t whatsapp-blaster .
docker run -p 3001:3001 -p 5173:5173 whatsapp-blaster
```

---

## 📱 Production Deployment

### Backend (Node.js Hosting)

Recommended platforms:
- Railway.app
- Render.com
- Heroku (free tier deprecated)
- AWS EC2
- DigitalOcean

Steps:
1. Push code to GitHub
2. Connect repo to hosting platform
3. Set environment variables
4. Deploy
5. Monitor logs

### Frontend (Static Hosting)

Recommended platforms:
- Vercel
- Netlify
- GitHub Pages
- Cloudflare Pages
- AWS S3 + CloudFront

Steps:
1. Run `npm run build`
2. Upload `dist/` folder to hosting
3. Configure for SPA (catch-all to index.html)

### Full Stack (Docker)

Push Docker image to:
- Docker Hub
- AWS ECR
- DigitalOcean Container Registry

---

## 📊 Performance Tips

### Optimize Speed

1. **Use SSD disk** instead of HDD
2. **Increase RAM** to 4GB+ for smoother operation
3. **Close unnecessary apps** when running
4. **Use wired internet** for stable connection

### Database Growth

Monitor database size:
```bash
# macOS/Linux
ls -lh db/blaster.db

# Windows
dir backend\db\blaster.db
```

Clean up old logs monthly:
```sql
DELETE FROM blast_logs WHERE sent_at < datetime('now', '-30 days');
DELETE FROM blast_sessions WHERE created_at < datetime('now', '-30 days');
```

---

## 🆘 Getting Help

If issues persist:

1. **Check logs**
   - Backend console output
   - Browser developer console (F12)
   - Browser Network tab

2. **Review documentation**
   - README.md - Overview
   - QUICK_START.md - Fast setup
   - ARCHITECTURE.md - Technical details
   - FEATURES.md - Feature guide

3. **Known issues**
   - Check GitHub Issues
   - Search similar problems

4. **Contact support**
   - Create GitHub Issue with:
     - Your OS (Windows/Mac/Linux version)
     - Node.js version
     - Full error message
     - Steps to reproduce
     - Screenshot of issue

---

## ✨ Verification Checklist

After full installation:

- [ ] Node.js v18+ installed
- [ ] npm v7+ installed
- [ ] Backend dependencies installed (backend/node_modules exists)
- [ ] Frontend dependencies installed (frontend/node_modules exists)
- [ ] .env file exists and correct
- [ ] Backend runs without errors
- [ ] Frontend runs without errors
- [ ] Browser shows dashboard
- [ ] QR code appears on dashboard
- [ ] Can scan QR with WhatsApp
- [ ] Status changes to "Connected"
- [ ] Contacts page loads
- [ ] Can add/import contacts
- [ ] Can create templates
- [ ] Blast form appears and works

If all checked: ✅ **Installation successful!**

---

Last Updated: April 2024
Version: 1.0.0
