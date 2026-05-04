# 🚀 WhatsApp Blaster - Complete Installation & Setup Guide

Panduan lengkap untuk setup dan menjalankan WhatsApp Blaster dari awal hingga semua berjalan normal.

---

## 📋 Prerequisites (Persiapan Awal)

Pastikan sistem Anda sudah memiliki:

### 1. **Node.js v18+**
Download dari: https://nodejs.org/

**Verifikasi instalasi:**
```bash
node --version
npm --version
```

### 2. **Python 3.8+**
Download dari: https://www.python.org/

**Verifikasi instalasi:**
```bash
python --version
```

### 3. **Chrome/Chromium Browser**
WhatsApp Web automation memerlukan Chrome untuk berjalan.
- Download: https://www.google.com/chrome/
- Atau gunakan Chromium jika sudah terinstall

### 4. **Git** (Optional, untuk version control)
Download dari: https://git-scm.com/

---

## 🔧 Step-by-Step Installation

### **STEP 1: Clone/Extract Project**

```bash
# Jika menggunakan git
git clone <repository-url>
cd whatsapp-blaster

# Atau extract folder jika sudah download ZIP
cd whatsapp-blaster
```

---

### **STEP 2: Backend Setup**

#### 2.1 Install Backend Dependencies
```bash
cd backend
npm install
```

**Dependencies yang akan diinstall:**
- `express` - Web framework
- `socket.io` - Real-time communication
- `whatsapp-web.js` - WhatsApp Web integration
- `better-sqlite3` - Database
- `multer` - File upload
- `csv-parser` - CSV parsing
- `dotenv` - Environment variables
- `qrcode` - QR code generation
- `axios` - HTTP client
- Dan dependencies lainnya...

**Expected output:**
```
added XX packages in Xs
```

#### 2.2 Verifikasi Backend Dependencies
```bash
npm list
```

---

### **STEP 3: Python Setup (untuk Clustering)**

#### 3.1 Buat Virtual Environment Python
```bash
# Windows
python -m venv .venv
.venv\Scripts\activate

# macOS/Linux
python3 -m venv .venv
source .venv/bin/activate
```

#### 3.2 Install Python Dependencies
```bash
pip install --upgrade pip
pip install numpy pandas scikit-learn
```

**Verifikasi instalasi:**
```bash
python -c "import numpy, pandas, sklearn; print('✅ All Python packages installed')"
```

**Dependencies yang diinstall:**
- `numpy` - Numerical computing
- `pandas` - Data manipulation
- `scikit-learn` - Machine learning (untuk clustering)

---

### **STEP 4: Frontend Setup**

Buka terminal baru (jangan close backend terminal):

```bash
cd frontend
npm install
```

**Dependencies yang akan diinstall:**
- `react` - UI framework
- `vite` - Build tool
- `react-router-dom` - Routing
- `socket.io-client` - Real-time client
- `tailwind-css` - Styling
- `axios` - HTTP requests
- `react-hot-toast` - Notifications
- `lucide-react` - Icons
- `recharts` - Charts
- `react-bootstrap` - UI components
- Dan dependencies lainnya...

**Expected output:**
```
added XX packages in Xs
```

#### 3.2 Verifikasi Frontend Dependencies
```bash
npm list
```

---

### **STEP 5: Environment Configuration**

#### 5.1 Buka file `.env` di backend
```bash
# Di folder backend
# File sudah ada: backend\.env
```

#### 5.2 Configure `.env` file

**File: `backend/.env`**

```env
# ============================================
# PORT & HOST CONFIGURATION
# ============================================
PORT=3001
HOST=localhost

# ============================================
# DATABASE
# ============================================
DB_PATH=./db/blaster.db

# ============================================
# WHATSAPP CONFIGURATION
# ============================================
WA_HEADLESS=true
WA_DEVTOOLS=false
WA_CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe

# ============================================
# BANDIT ALGORITHM (Optional)
# ============================================
BANDIT_ENABLED=true

# ============================================
# PYTHON PATH (untuk clustering)
# ============================================
PYTHON_PATH=D:\PROJECT\whatsapp-blaster\.venv\Scripts\python.exe

# ============================================
# CORS CONFIGURATION
# ============================================
CORS_ORIGIN=http://localhost:5173

# ============================================
# LOGGING
# ============================================
LOG_LEVEL=debug
```

**Penjelasan penting:**
- `PORT`: Port untuk backend server
- `WA_HEADLESS`: `true` = browser tidak visible, `false` = browser muncul
- `WA_CHROME_PATH`: Path ke Chrome installation (sesuaikan dengan sistem Anda)
- `PYTHON_PATH`: Path ke Python executable di virtual environment
- `CORS_ORIGIN`: Frontend URL

**Untuk Windows, cari Chrome path:**
```bash
# Biasanya di salah satu lokasi ini:
C:\Program Files\Google\Chrome\Application\chrome.exe
C:\Program Files (x86)\Google\Chrome\Application\chrome.exe
```

#### 5.3 Verifikasi Chrome Path
```bash
# Windows
echo "C:\Program Files\Google\Chrome\Application\chrome.exe"

# Atau gunakan PowerShell
Get-Item "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

---

### **STEP 6: Database Initialization**

Backend akan otomatis membuat database saat pertama kali dijalankan. Tapi Anda bisa verifikasi manual:

```bash
# Di folder backend
node -e "require('./db/database'); console.log('✅ Database initialized')"
```

**Database akan membuat tabel:**
- `contacts` - Penyimpanan kontak
- `blast_sessions` - History blast campaigns
- `blast_logs` - Detail setiap pesan yang dikirim
- `templates` - Template pesan
- `bandit_policies` - Multi-Armed Bandit policies
- `bandit_events` - Event history untuk bandit learning
- `cluster_metadata` - Metadata clustering
- `features` - Feature storage untuk clustering

---

## 🎯 Running the Project

### **TERMINAL 1: Backend Server**

```bash
cd backend
npm start
```

**Expected output:**
```
✅ WhatsApp client initialized
✅ Server running on http://localhost:3001
✅ Socket.io connected
```

### **TERMINAL 2: Frontend Development Server**

Buka terminal baru:

```bash
cd frontend
npm run dev
```

**Expected output:**
```
  VITE v4.x.x  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

---

## ✅ Verification Checklist

Setelah semua berjalan, verifikasi:

- [ ] Backend server running di `http://localhost:3001`
- [ ] Frontend accessible di `http://localhost:5173`
- [ ] Browser bisa buka frontend tanpa error
- [ ] Sidebar dan menu tampil normal
- [ ] Database file dibuat di `backend/db/blaster.db`
- [ ] Python modules tersedia (jika clustering digunakan)

**Test di Frontend:**
1. Buka http://localhost:5173
2. Login (jika ada authentication)
3. Buka menu **Dashboard** - harus tampil QR code WhatsApp
4. Buka menu **Contacts** - harus bisa import CSV
5. Buka menu **Blast** - harus bisa membuat blast
6. Buka menu **Sessions** - harus bisa lihat history

---

## 🐛 Troubleshooting

### **Problem 1: Port 3001 sudah digunakan**
```bash
# Ubah PORT di .env file atau gunakan port lain
PORT=3002
```

### **Problem 2: Chrome path tidak ditemukan**
```bash
# Cari di lokasi berbeda atau gunakan chromium
WA_CHROME_PATH=/usr/bin/chromium
# atau di Mac
WA_CHROME_PATH=/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome
```

### **Problem 3: Python tidak ditemukan**
```bash
# Pastikan Python diinstall
python --version

# Atau gunakan python3
python3 --version
```

### **Problem 4: Module sklearn tidak ditemukan**
```bash
# Install ulang sklearn di virtual environment
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # macOS/Linux

pip install scikit-learn numpy pandas
```

### **Problem 5: CORS Error di Frontend**
```bash
# Pastikan CORS_ORIGIN di .env match dengan frontend URL
CORS_ORIGIN=http://localhost:5173
```

### **Problem 6: Socket.io Connection Failed**
```bash
# Pastikan backend running
# Check backend console untuk error messages
# Refresh frontend page (Ctrl+R atau Cmd+R)
```

---

## 📦 Project Structure setelah Setup

```
whatsapp-blaster/
├── backend/
│   ├── node_modules/          ← npm packages
│   ├── db/
│   │   └── blaster.db         ← SQLite database (auto-created)
│   ├── .env                   ← Environment config
│   ├── package.json
│   ├── server.js
│   ├── routes/
│   ├── services/
│   └── ...
│
├── frontend/
│   ├── node_modules/          ← npm packages
│   ├── src/
│   ├── package.json
│   ├── vite.config.js
│   └── ...
│
├── .venv/                     ← Python virtual environment
│   ├── Scripts/
│   │   └── python.exe
│   └── Lib/
│       └── site-packages/     ← Python packages
│
└── ...other files
```

---

## 🚀 Quick Start Commands

**Shortest path untuk menjalankan project:**

```bash
# Terminal 1 - Backend
cd backend
npm install
npm start

# Terminal 2 - Frontend (buka terminal baru)
cd frontend
npm install
npm run dev

# Open browser
# http://localhost:5173
```

---

## 🔐 Environment Setup untuk Production (Optional)

Untuk production deployment:

```env
# backend/.env

PORT=3001
NODE_ENV=production

WA_HEADLESS=true
WA_DEVTOOLS=false

# Gunakan absolute path untuk Chrome
WA_CHROME_PATH=/usr/bin/chromium-browser

BANDIT_ENABLED=true

# Use actual domain
CORS_ORIGIN=https://your-domain.com

LOG_LEVEL=info
```

---

## 📞 Support & Common Issues

### **Setelah setup, jika ada masalah:**

1. **Check backend console** untuk error messages
2. **Check browser console** (F12) untuk frontend errors
3. **Verifikasi .env** settings benar
4. **Restart backend & frontend** (stop dan jalankan lagi)
5. **Clear cache** browser (Ctrl+Shift+Delete)

---

## ✨ Next Steps

Setelah semua berjalan:

1. **Scan QR Code di Dashboard** untuk login WhatsApp
2. **Import Contacts** dari CSV file
3. **Buat Template** untuk campaign
4. **Jalankan Blast** ke contacts
5. **Monitor Sessions** untuk tracking hasil

---

## 📝 Notes

- Pastikan **hanya satu instance** backend & frontend running
- WhatsApp session akan **persist** di database
- Setiap blast ditrack di `blast_logs` untuk analytics
- Multi-Armed Bandit learning terjadi **otomatis** per campaign
- Database backup bisa di-copy dari `backend/db/blaster.db`

**Selamat! Project sudah siap digunakan! 🎉**
