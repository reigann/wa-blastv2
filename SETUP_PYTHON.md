# Python Setup untuk Clustering Feature

## Masalah
Error: `spawn D:\PROJECT\whatsapp-blaster\.venv\Scripts\python.exe ENOENT`

Python virtual environment tidak ditemukan atau Python tidak terinstall.

## Solusi

### Option 1: Setup Virtual Environment (Recommended)

**Windows:**
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install scikit-learn pandas numpy
```

**Linux/Mac:**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install scikit-learn pandas numpy
```

### Option 2: Gunakan Python Global
Jika tidak ingin membuat venv, pastikan Python terinstall globally dan di PATH:
```bash
python --version  # atau python3 --version
```

## Verifikasi
Jalankan test clustering:
```bash
cd backend
node -e "const c = require('./services/clusteringServiceWrapper'); console.log('Python path:', c.pythonPath || 'Using global python')"
```

## Dependencies
Clustering memerlukan:
- `scikit-learn`
- `pandas`
- `numpy`

Install dengan:
```bash
pip install scikit-learn pandas numpy
```

---

**Note:** Aplikasi akan tetap berjalan meski Python tidak ada - hanya fitur Clustering yang akan disabled dengan error message yang jelas.
