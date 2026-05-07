@echo off
REM Quick Start: Bandit Strategies Setup & Test (Windows)

cls
echo 🤖 WhatsApp Blaster - Bandit Strategies Quick Start
echo ==================================================
echo.

REM Check if backend is running
echo 1️⃣  Checking if backend is running...
curl -s http://localhost:3001/api/bandit/policies >nul 2>&1
if errorlevel 1 (
  echo ❌ Backend not running on :3001
  echo Please start backend first:
  echo   cd backend ^&^& npm start
  pause
  exit /b 1
)
echo ✅ Backend is running
echo.

REM Initialize policies
echo 2️⃣  Initializing Bandit Policies...
cd backend 2>nul || (
  echo ❌ Cannot find backend folder
  pause
  exit /b 1
)

node scripts/init-bandit-policies.js
if errorlevel 1 (
  echo ❌ Failed to initialize policies
  pause
  exit /b 1
)
echo.

REM Verify policies created
echo 3️⃣  Verifying policies...
echo 📋 Checking policies...
curl -s http://localhost:3001/api/bandit/policies | findstr "name"

echo.
echo ✅ Setup Complete!
echo.
echo Next Steps:
echo 1. Open http://localhost:5173 (Frontend)
echo 2. Go to Blast page
echo 3. Create campaign ^→ Configure step
echo 4. Select 'template_type_optimization' or 'sending_time_optimization'
echo 5. Send campaign
echo 6. Check results at Dashboard ^→ Bandit Analytics 📊
echo.
echo 📚 Read docs/BANDIT_STRATEGIES_GUIDE.md for detailed guide
echo.
pause
