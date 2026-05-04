# 🔧 Troubleshooting: Clustering 500 Error

## ❌ Problem
```
Failed to load resource: the server responded with a status of 500 (Internal Server Error)
:3001/api/clustering/run:1
```

---

## ✅ Fixes Applied

### 1. **Enhanced Error Logging**
- ✅ Detailed error messages returned to frontend
- ✅ Stack traces logged on backend
- ✅ Clear error messages at each step

### 2. **Better Input Validation**
- ✅ Check if contacts exist (min 2)
- ✅ Validate clustering result object structure
- ✅ Parse `nClusters` parameter correctly
- ✅ Ensure labels array length matches contacts

### 3. **Database Operations**
- ✅ Tables already created: `cluster_metadata`, `features`, `contacts`
- ✅ Better transaction handling
- ✅ Added console logging for debugging

### 4. **Python Integration**
- ✅ Better error handling from Python subprocess
- ✅ Clear error messages from Python output
- ✅ Validate JSON output from Python script

---

## 🔍 Debugging Steps

### Step 1: Check Clustering Service Health
```bash
curl http://localhost:3001/api/clustering/debug
```

Expected response:
```json
{
  "pythonAvailable": true,
  "pythonPath": "D:\\PROJECT\\whatsapp-blaster\\.venv\\Scripts\\python.exe",
  "totalContacts": 10,
  "clusteringMetadataRecords": 0,
  "tables": {
    "contacts": true,
    "cluster_metadata": true,
    "features": true
  },
  "status": "OK"
}
```

### Step 2: Verify Python Dependencies
```bash
python -c "import sklearn, pandas, numpy; print('✅ OK')"
```

### Step 3: Test Python Script Directly
```bash
cd backend
python services/clusteringService.py '[{"id":1,"minat_prodi":"Teknik Informatika","asal_sekolah":"unknown"}]' 3
```

Should output valid JSON like:
```json
{
  "success": true,
  "labels": [0],
  "silhouette_score": 0,
  "davies_bouldin_index": 0,
  "n_clusters": 3,
  "cluster_stats": {...},
  "features_used": [...]
}
```

### Step 4: Check Backend Console
Look for these messages:
```
✅ Using Python: ...
📊 Starting clustering with X contacts, nClusters=...
✅ Python clustering completed successfully
✅ Saved cluster metadata with ID: ...
✅ Updated X contacts with cluster assignments
```

If you see ❌ messages, note the error and check below.

---

## 🚨 Common Error Messages & Fixes

### Error: "Python is not installed or not found in PATH"
**Fix:**
```bash
# Windows
cd backend
npm run setup-python

# Or manually
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install scikit-learn pandas numpy
```

### Error: "Minimal 2 kontak diperlukan untuk clustering"
**Fix:** Add at least 2 contacts via the Contacts page before clustering.

### Error: "Python script produced no output"
**Cause:** Python crash or script error
**Fix:**
1. Check backend console for ❌ Python script error message
2. Run test directly: `python services/clusteringService.py '[...data...]'`
3. Check if scikit-learn is installed: `pip list | grep scikit`

### Error: "Labels count doesn't match contacts count"
**Cause:** Python returned wrong number of labels
**Fix:**
1. Verify Python scikit-learn version: `pip show scikit-learn`
2. Try with fewer contacts
3. Check if contacts have valid `minat_prodi` and `asal_sekolah` fields

### Error: "Invalid clustering result: missing or invalid labels array"
**Cause:** Python script returned malformed JSON
**Fix:**
1. Check Python output: `python services/clusteringService.py '[...data...]' | cat`
2. Look for any print statements or errors in Python output
3. Ensure JSON is valid (use online JSON validator)

---

## 🧪 Complete Test Procedure

### 1. Add Test Contacts
Via UI or API:
```bash
curl -X POST http://localhost:3001/api/contacts \
  -H "Content-Type: application/json" \
  -d '[
    {"name":"Test 1","phone":"081234567890","group_name":"test","minat_prodi":"Teknik Informatika","asal_sekolah":"SMA 1"},
    {"name":"Test 2","phone":"082345678901","group_name":"test","minat_prodi":"Ilmu Komputer","asal_sekolah":"SMA 2"},
    {"name":"Test 3","phone":"083456789012","group_name":"test","minat_prodi":"Sistem Informasi","asal_sekolah":"SMA 3"}
  ]'
```

### 2. Check Debug Info
```bash
curl http://localhost:3001/api/clustering/debug
```

### 3. Run Clustering
```bash
curl -X POST http://localhost:3001/api/clustering/run \
  -H "Content-Type: application/json" \
  -d '{"nClusters": 2}'
```

### 4. Check Results
```bash
curl http://localhost:3001/api/clustering/latest
```

---

## 📋 Checklist

- [ ] Python installed: `python --version` ✓
- [ ] Dependencies installed: `pip list | grep scikit` ✓
- [ ] Backend running: `npm run dev` ✓
- [ ] Database tables exist (check debug endpoint) ✓
- [ ] At least 2 contacts in database ✓
- [ ] Backend console shows ✅ messages ✓
- [ ] Clustering debug endpoint returns OK ✓
- [ ] Python test script works directly ✓

---

## 📊 Files Modified

- `backend/services/clusteringServiceWrapper.js` - Enhanced logging
- `backend/routes/clustering.js` - Better error handling + debug endpoint
- `frontend/src/pages/Clustering.jsx` - Better error display

## 🔗 Related Endpoints

- `GET /api/clustering/debug` - Health check
- `POST /api/clustering/run` - Run clustering
- `GET /api/clustering/latest` - Get results
- `GET /api/clustering/results` - Get all results
- `DELETE /api/clustering/clear` - Clear clustering

---

## 💡 Tips

1. **Always check backend console first** - Error messages logged there
2. **Use debug endpoint** - Quick health check: `curl .../api/clustering/debug`
3. **Test Python directly** - Helps identify if issue is in Python or Node
4. **Add more contacts** - Sometimes works better with more data
5. **Restart backend** - `npm run dev` after installing Python packages

---

## 📞 Still Stuck?

1. Check all ✅ in checklist above
2. Run: `curl http://localhost:3001/api/clustering/debug`
3. Look at backend console output
4. Search error message in this guide
5. Share backend console output when asking for help
