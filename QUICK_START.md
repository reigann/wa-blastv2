# 🚀 Quick Start Guide - WhatsApp Blaster

## 1️⃣ Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend (in separate terminal)
cd frontend
npm install
```

## 2️⃣ Start Backend

```bash
cd backend
npm run dev
```

**Expected:**
```
Backend running on http://localhost:3001
```

## 3️⃣ Start Frontend

```bash
cd frontend
npm run dev
```

**Navigate to:** http://localhost:5173

## 4️⃣ Connect WhatsApp

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
