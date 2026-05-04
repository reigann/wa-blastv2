# 📚 WhatsApp Blaster - Documentation Index

Panduan lengkap untuk setup, menjalankan, dan menggunakan WhatsApp Blaster.

---

## 🚀 Getting Started

### Pilih berdasarkan kebutuhan Anda:

#### **Saya ingin setup secepatnya** ⚡
→ [QUICK_START.md](QUICK_START.md)
- Automated setup script (1 menit)
- Minimal steps
- Langsung bisa digunakan

#### **Saya ingin setup manual & detail** 📖
→ [COMPLETE_SETUP.md](COMPLETE_SETUP.md)
- Step-by-step instructions
- Troubleshooting guide
- Semua konfigurasi dijelaskan

#### **Saya ingin tahu semua commands** 🔧
→ [AVAILABLE_COMMANDS.md](AVAILABLE_COMMANDS.md)
- Semua npm scripts
- Database commands
- Debugging tips

---

## 📋 Full Documentation

| File | Deskripsi | Untuk Siapa |
|------|-----------|-----------|
| [QUICK_START.md](QUICK_START.md) | Setup cepat dengan automated script | Pemula, ingin cepat |
| [COMPLETE_SETUP.md](COMPLETE_SETUP.md) | Panduan lengkap step-by-step | Developer, yang detail |
| [AVAILABLE_COMMANDS.md](AVAILABLE_COMMANDS.md) | Semua npm/python commands | Developer yang sudah setup |
| [README.md](README.md) | Overview project | Semua orang |
| [FEATURES.md](FEATURES.md) | Fitur-fitur yang tersedia | Product user |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Arsitektur sistem | Developer |

---

## ✅ Prerequisites

Sebelum setup, pastikan sudah punya:

- ✅ **Node.js v18+** - https://nodejs.org/
- ✅ **Python 3.8+** - https://www.python.org/
- ✅ **Chrome Browser** - https://www.google.com/chrome/
- ✅ **Git** (optional) - https://git-scm.com/

**Verifikasi:**
```bash
node --version
npm --version
python --version
```

---

## 🎯 Installation Paths

### Path 1: Windows User (Paling Cepat)
```bash
# 1. Run automated setup
setup.bat

# 2. Configure .env (edit backend/.env)

# 3. Terminal 1 - Backend
cd backend
npm start

# 4. Terminal 2 - Frontend
cd frontend
npm run dev

# 5. Open browser
http://localhost:5173
```

### Path 2: macOS/Linux User
```bash
# 1. Run automated setup
chmod +x setup.sh
./setup.sh

# 2. Configure .env (edit backend/.env)

# 3. Terminal 1 - Backend
cd backend
npm start

# 4. Terminal 2 - Frontend
cd frontend
npm run dev

# 5. Open browser
http://localhost:5173
```

### Path 3: Manual Setup (Kontrol Penuh)
Ikuti step-by-step di [COMPLETE_SETUP.md](COMPLETE_SETUP.md)

---

## 📂 Project Structure

```
whatsapp-blaster/
├── 📄 QUICK_START.md              ← START HERE (Cepat)
├── 📄 COMPLETE_SETUP.md           ← START HERE (Detail)
├── 📄 AVAILABLE_COMMANDS.md       ← Commands reference
│
├── setup.bat                      ← Automated setup (Windows)
├── setup.sh                       ← Automated setup (Mac/Linux)
├── requirements.txt               ← Python dependencies
│
├── backend/
│   ├── package.json              ← Node dependencies
│   ├── .env                      ← Configuration
│   ├── server.js                 ← Main entry point
│   └── ...
│
├── frontend/
│   ├── package.json              ← Node dependencies
│   ├── vite.config.js            ← Build config
│   └── ...
│
└── docs/
    ├── README.md
    ├── FEATURES.md
    ├── ARCHITECTURE.md
    └── ...
```

---

## 🔥 Quick Reference

### Start Development (Setelah setup)

**Terminal 1:**
```bash
cd backend && npm start
```

**Terminal 2:**
```bash
cd frontend && npm run dev
```

**Browser:**
```
http://localhost:5173
```

### Important Files

- **Backend config:** `backend/.env`
- **Database:** `backend/db/blaster.db`
- **Frontend config:** `frontend/vite.config.js`
- **Python packages:** `requirements.txt`
- **Node packages (Backend):** `backend/package.json`
- **Node packages (Frontend):** `frontend/package.json`

---

## 🐛 Having Issues?

### Issue: Setup Script Failed
→ [COMPLETE_SETUP.md - Troubleshooting](COMPLETE_SETUP.md#-troubleshooting)

### Issue: Port Already Used
→ [AVAILABLE_COMMANDS.md - Port Information](AVAILABLE_COMMANDS.md#port-information)

### Issue: Chrome Not Found
→ [COMPLETE_SETUP.md - Configure .env](COMPLETE_SETUP.md#step-5-environment-configuration)

### Issue: Python Not Found
→ [COMPLETE_SETUP.md - Python Setup](COMPLETE_SETUP.md#step-3-python-setup-untuk-clustering)

### Issue: Socket.io Connection Failed
→ [AVAILABLE_COMMANDS.md - Debugging](AVAILABLE_COMMANDS.md#debugging-commands)

---

## 📚 Learning Resources

### Understand the Project
1. [FEATURES.md](FEATURES.md) - Apa yang bisa dilakukan
2. [ARCHITECTURE.md](ARCHITECTURE.md) - Bagaimana sistem bekerja
3. [README.md](README.md) - Overview

### Develop Further
1. [AVAILABLE_COMMANDS.md](AVAILABLE_COMMANDS.md) - Commands reference
2. Code di `backend/` & `frontend/`
3. Database schema di `backend/db/database.js`

---

## 💡 Tips

- **First time?** → Baca [QUICK_START.md](QUICK_START.md)
- **Want details?** → Baca [COMPLETE_SETUP.md](COMPLETE_SETUP.md)
- **Need commands?** → Baca [AVAILABLE_COMMANDS.md](AVAILABLE_COMMANDS.md)
- **Understand system?** → Baca [FEATURES.md](FEATURES.md) & [ARCHITECTURE.md](ARCHITECTURE.md)

---

## 🎓 Next Steps

Setelah berhasil setup:

1. **Scan QR Code** di Dashboard untuk login WhatsApp
2. **Import Contacts** dari CSV file
3. **Buat Template** untuk campaign
4. **Jalankan Blast** ke contacts
5. **Monitor** di Sessions

---

## 📞 Support

Jika masih ada masalah:

1. **Check error messages** di backend console
2. **Check browser console** (F12 → Console tab)
3. **Verify .env settings** di backend folder
4. **Restart** backend & frontend
5. **Clear browser cache** (Ctrl+Shift+Delete)

---

**Happy blasting! 🚀**
