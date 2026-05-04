# 🚀 Quick Start Guide - WhatsApp Blaster

## ⚙️ Prerequisites (Harus Diinstall Dulu)

✅ **Node.js v18+** → https://nodejs.org/  
✅ **Python 3.8+** → https://www.python.org/  
✅ **Chrome Browser** → https://www.google.com/chrome/

**Verifikasi:**
```bash
node --version      # v18+
python --version    # 3.8+
```

---

## 🎯 Automated Setup (1 Menit)

### Windows
```bash
setup.bat
```

### macOS/Linux
```bash
chmod +x setup.sh
./setup.sh
```

Setelah selesai, lanjut ke **Running the Project**.

---

## 📋 Manual Setup (Step-by-Step)

### Step 1: Backend Dependencies
```bash
cd backend
npm install
```

### Step 2: Python Setup
```bash
# Windows
python -m venv .venv
.venv\Scripts\activate

# macOS/Linux
python3 -m venv .venv
source .venv/bin/activate

# Install Python packages
pip install -r ../requirements.txt
```

### Step 3: Frontend Dependencies
```bash
cd frontend
npm install
```

### Step 4: Configure Environment
Edit `backend/.env`:
```env
PORT=3001
WA_CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
PYTHON_PATH=D:\PROJECT\whatsapp-blaster\.venv\Scripts\python.exe
```

---

## ▶️ Running the Project

### Terminal 1: Backend
```bash
cd backend
npm start
```

**Expected output:**
```
✅ Server running on http://localhost:3001
✅ Socket.io initialized
```

### Terminal 2: Frontend (Buka terminal baru)
```bash
cd frontend
npm run dev
```

**Expected output:**
```
➜ Local:   http://localhost:5173/
➜ press h to show help
```

### Buka Browser
```
http://localhost:5173
```

---

## 🎨 Using the Application

1. QR code appears on Dashboard
2. Open WhatsApp → Settings → Linked Devices → Link a Device
3. Scan the QR code
4. Wait for "Connected" status

## 5️⃣ Import Contacts

1. Go to **Contacts** page
2. Click **Import CSV**
3. Upload file with columns: `name`, `phone`
4. Example:
   ```csv
   name,phone
   John,081234567890
   Jane,082345678901
   ```

## 6️⃣ Send Blast

1. Go to **Blast** page
2. Select target group
3. Write message (use `{{name}}` for personalization)
4. Keep delay min 3000ms
5. Click **Start Blast**

## 7️⃣ Monitor Progress

1. Dashboard shows live progress
2. **Logs** page shows detailed results
3. Check errors if any messages fail

## ✅ Done!

Your WhatsApp Blaster is ready to use! 🎉

---

### 📱 Phone Number Formats Accepted
- ✅ `081234567890` (format: 08xxx)
- ✅ `628234567890` (format: 628xxx)
- ✅ `+628234567890` (format: +628xxx)

### ⚠️ Critical Rules
- Keep delay min **3000ms** minimum
- Max **500 contacts/day** per number
- **Test with 5-10 contacts** first
- Respect WhatsApp ToS

### 🛠️ Troubleshooting

| Issue | Solution |
|-------|----------|
| QR code not showing | Restart both servers |
| Messages won't send | Check if number exists on WhatsApp |
| "Port already in use" | Change PORT in `backend/.env` |
| CSV import fails | Ensure `phone` column exists |
| Connection drops | Reconnect via QR scan |

For full documentation, see [README.md](README.md)
