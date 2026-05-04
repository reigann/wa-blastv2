@echo off
REM WhatsApp Blaster - Automated Setup Script for Windows
REM Run this script in the project root directory

echo.
echo ======================================
echo  WhatsApp Blaster Setup
echo ======================================
echo.

REM Check Node.js
echo [1/6] Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js not found! Please install Node.js v18+ from https://nodejs.org/
    pause
    exit /b 1
) else (
    echo ✅ Node.js found: 
    node --version
)

REM Check Python
echo.
echo [2/6] Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python not found! Please install Python 3.8+ from https://www.python.org/
    pause
    exit /b 1
) else (
    echo ✅ Python found:
    python --version
)

REM Backend Setup
echo.
echo [3/6] Installing Backend dependencies...
cd backend
call npm install
if errorlevel 1 (
    echo ❌ Backend npm install failed!
    pause
    exit /b 1
)
echo ✅ Backend dependencies installed
cd ..

REM Python Virtual Environment
echo.
echo [4/6] Setting up Python Virtual Environment...
if not exist ".venv" (
    python -m venv .venv
    echo ✅ Virtual environment created
) else (
    echo ✅ Virtual environment already exists
)

REM Activate venv and install Python packages
echo.
echo [5/6] Installing Python packages...
call .venv\Scripts\activate.bat
pip install --upgrade pip
pip install -r requirements.txt
if errorlevel 1 (
    echo ❌ Python packages installation failed!
    pause
    exit /b 1
)
echo ✅ Python packages installed
call .venv\Scripts\deactivate.bat

REM Frontend Setup
echo.
echo [6/6] Installing Frontend dependencies...
cd frontend
call npm install
if errorlevel 1 (
    echo ❌ Frontend npm install failed!
    pause
    exit /b 1
)
echo ✅ Frontend dependencies installed
cd ..

echo.
echo ======================================
echo  ✅ Setup Complete!
echo ======================================
echo.
echo Next steps:
echo   1. Configure backend\.env file
echo   2. Update WA_CHROME_PATH if needed
echo   3. Run: npm start (in backend folder)
echo   4. Run: npm run dev (in frontend folder)
echo.
echo Open browser: http://localhost:5173
echo.
pause
