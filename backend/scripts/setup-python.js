#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const isWindows = os.platform() === 'win32';
const backendDir = __dirname + '/..';
const venvDir = path.join(backendDir, '.venv');

console.log('🐍 Python Setup for WhatsApp Blaster Clustering\n');

// Check if venv already exists
if (fs.existsSync(venvDir)) {
  console.log('✅ Virtual environment already exists at:', venvDir);
  
  // Check if Python is available in venv
  const pythonPath = isWindows 
    ? path.join(venvDir, 'Scripts', 'python.exe')
    : path.join(venvDir, 'bin', 'python');
  
  if (fs.existsSync(pythonPath)) {
    console.log('✅ Python found in venv:', pythonPath);
    checkDependencies(pythonPath);
    return;
  }
}

// Create virtual environment
console.log('📦 Creating virtual environment...');
try {
  if (isWindows) {
    execSync('python -m venv .venv', { cwd: backendDir, stdio: 'inherit' });
  } else {
    execSync('python3 -m venv .venv', { cwd: backendDir, stdio: 'inherit' });
  }
  console.log('✅ Virtual environment created\n');
} catch (err) {
  console.error('❌ Failed to create virtual environment:', err.message);
  console.error('\nMake sure Python is installed and in your PATH');
  console.error('Windows: https://www.python.org/downloads/');
  console.error('Linux: apt-get install python3-venv');
  process.exit(1);
}

// Get pip path
const pipPath = isWindows
  ? path.join(venvDir, 'Scripts', 'pip.exe')
  : path.join(venvDir, 'bin', 'pip');

// Install dependencies
console.log('📚 Installing Python dependencies...');
const dependencies = ['scikit-learn', 'pandas', 'numpy'];

try {
  for (const dep of dependencies) {
    console.log(`  Installing ${dep}...`);
    execSync(`"${pipPath}" install ${dep}`, { 
      cwd: backendDir,
      stdio: 'pipe'
    });
  }
  console.log('✅ All dependencies installed\n');
} catch (err) {
  console.error('❌ Failed to install dependencies:', err.message);
  process.exit(1);
}

// Verify installation
const pythonPath = isWindows
  ? path.join(venvDir, 'Scripts', 'python.exe')
  : path.join(venvDir, 'bin', 'python');

checkDependencies(pythonPath);

function checkDependencies(pythonPath) {
  console.log('🔍 Verifying installation...');
  try {
    execSync(`"${pythonPath}" -c "import sklearn, pandas, numpy; print('✅ All modules OK')"`, {
      stdio: 'inherit'
    });
    console.log('\n✨ Setup complete! You can now use clustering features.\n');
  } catch (err) {
    console.error('❌ Verification failed:', err.message);
    process.exit(1);
  }
}
