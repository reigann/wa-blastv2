#!/bin/bash

# WhatsApp Blaster - Automated Setup Script for macOS/Linux
# Run this script in the project root directory: chmod +x setup.sh && ./setup.sh

set -e  # Exit on error

echo ""
echo "======================================"
echo "  WhatsApp Blaster Setup"
echo "======================================"
echo ""

# Check Node.js
echo "[1/6] Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found! Please install Node.js v18+ from https://nodejs.org/"
    exit 1
else
    echo "✅ Node.js found:"
    node --version
fi

# Check Python
echo ""
echo "[2/6] Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python not found! Please install Python 3.8+ from https://www.python.org/"
    exit 1
else
    echo "✅ Python found:"
    python3 --version
fi

# Backend Setup
echo ""
echo "[3/6] Installing Backend dependencies..."
cd backend
npm install
if [ $? -ne 0 ]; then
    echo "❌ Backend npm install failed!"
    exit 1
fi
echo "✅ Backend dependencies installed"
cd ..

# Python Virtual Environment
echo ""
echo "[4/6] Setting up Python Virtual Environment..."
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
    echo "✅ Virtual environment created"
else
    echo "✅ Virtual environment already exists"
fi

# Activate venv and install Python packages
echo ""
echo "[5/6] Installing Python packages..."
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "❌ Python packages installation failed!"
    deactivate
    exit 1
fi
echo "✅ Python packages installed"
deactivate

# Frontend Setup
echo ""
echo "[6/6] Installing Frontend dependencies..."
cd frontend
npm install
if [ $? -ne 0 ]; then
    echo "❌ Frontend npm install failed!"
    exit 1
fi
echo "✅ Frontend dependencies installed"
cd ..

echo ""
echo "======================================"
echo "  ✅ Setup Complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "  1. Configure backend/.env file"
echo "  2. Update WA_CHROME_PATH if needed"
echo "  3. Run: npm start (in backend folder)"
echo "  4. Run: npm run dev (in frontend folder)"
echo ""
echo "Open browser: http://localhost:5173"
echo ""
