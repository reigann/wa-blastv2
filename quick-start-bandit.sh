#!/bin/bash

# Quick Start: Bandit Strategies Setup & Test

echo "🤖 WhatsApp Blaster - Bandit Strategies Quick Start"
echo "=================================================="
echo ""

# Check if backend is running
echo "1️⃣  Checking if backend is running..."
if ! curl -s http://localhost:3001/api/bandit/policies > /dev/null 2>&1; then
  echo "❌ Backend not running on :3001"
  echo "Please start backend first:"
  echo "  cd backend && npm start"
  exit 1
fi
echo "✅ Backend is running"
echo ""

# Initialize policies
echo "2️⃣  Initializing Bandit Policies..."
cd backend 2>/dev/null || { echo "❌ Cannot find backend folder"; exit 1; }
node scripts/init-bandit-policies.js

if [ $? -ne 0 ]; then
  echo "❌ Failed to initialize policies"
  exit 1
fi
echo ""

# Verify policies created
echo "3️⃣  Verifying policies..."
POLICIES=$(curl -s http://localhost:3001/api/bandit/policies)
echo "📋 Policies:"
echo "$POLICIES" | grep -o '"name":"[^"]*"' | head -5

echo ""
echo "✅ Setup Complete!"
echo ""
echo "Next Steps:"
echo "1. Open http://localhost:5173 (Frontend)"
echo "2. Go to Blast page"
echo "3. Create campaign → Configure step"
echo "4. Select 'template_type_optimization' or 'sending_time_optimization'"
echo "5. Send campaign"
echo "6. Check results at Dashboard → Bandit Analytics 📊"
echo ""
echo "📚 Read docs/BANDIT_STRATEGIES_GUIDE.md for detailed guide"
