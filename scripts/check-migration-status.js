#!/usr/bin/env node

/**
 * Migration Status Checker
 * Helps track progress of SQLite → MySQL migration
 */

const fs = require('fs');
const path = require('path');

const filesToCheck = [
  'backend/routes/contacts.js',
  'backend/routes/templates.js',
  'backend/routes/blast.js',
  'backend/routes/bandit.js',
  'backend/services/blastService.js',
  'backend/services/banditService.js',
  'backend/services/clusteringServiceWrapper.js'
];

const sqlitePatterns = [
  /db\.prepare\(/g,
  /\.all\(\)/g,
  /\.get\(\)/g,
  /\.run\(\)/g,
  /\.transaction\(/g,
  /lastInsertRowid/g
];

const mysqlPatterns = [
  /await db\.all\(/g,
  /await db\.get\(/g,
  /await db\.run\(/g,
  /async \(/g
];

function checkFile(filePath) {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    return {
      file: filePath,
      exists: false,
      sqliteUsage: 0,
      mysqlUsage: 0,
      migratedPercentage: 0,
      issues: ['File not found']
    };
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  
  let sqliteUsage = 0;
  sqlitePatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) sqliteUsage += matches.length;
  });

  let mysqlUsage = 0;
  mysqlPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) mysqlUsage += matches.length;
  });

  const totalUsage = sqliteUsage + mysqlUsage;
  const migratedPercentage = totalUsage > 0 ? Math.round((mysqlUsage / totalUsage) * 100) : 0;

  const issues = [];
  if (sqliteUsage > 0) issues.push(`Still uses SQLite patterns: ${sqliteUsage} found`);
  if (!content.includes('async')) issues.push('No async functions found');
  if (!content.includes('try')) issues.push('No error handling found');
  if (!content.includes('catch')) issues.push('No catch blocks found');

  return {
    file: filePath,
    exists: true,
    sqliteUsage,
    mysqlUsage,
    totalUsage,
    migratedPercentage,
    issues: issues.length > 0 ? issues : ['✓ Appears migrated']
  };
}

console.log('\n=== Migration Status Report ===\n');

const results = filesToCheck.map(checkFile);
let totalFiles = 0;
let fullyMigrated = 0;
let totalPercentage = 0;

results.forEach(result => {
  if (!result.exists) {
    console.log(`❌ ${result.file} - NOT FOUND`);
    return;
  }

  totalFiles++;
  const status = result.migratedPercentage === 100 ? '✓' : '⚠';
  
  if (result.migratedPercentage === 100) {
    fullyMigrated++;
  }
  
  totalPercentage += result.migratedPercentage;

  console.log(`${status} ${result.file}`);
  console.log(`   Migrated: ${result.migratedPercentage}% (${result.mysqlUsage}/${result.totalUsage} calls)`);
  
  if (result.issues[0] !== '✓ Appears migrated') {
    result.issues.forEach(issue => {
      console.log(`   ⚠ ${issue}`);
    });
  }
  console.log('');
});

const overallPercentage = totalFiles > 0 ? Math.round(totalPercentage / totalFiles) : 0;
const progressBar = '█'.repeat(Math.floor(overallPercentage / 5)) + '░'.repeat(20 - Math.floor(overallPercentage / 5));

console.log('=== Overall Progress ===');
console.log(`Files: ${fullyMigrated}/${totalFiles} fully migrated`);
console.log(`Progress: [${progressBar}] ${overallPercentage}%`);
console.log('');

if (fullyMigrated === totalFiles) {
  console.log('✓ All routes migrated! Ready for testing.');
} else {
  console.log(`⚠ ${totalFiles - fullyMigrated} file(s) still need migration.`);
  console.log('\nNext steps:');
  console.log('1. Review ROUTE_MIGRATION_GUIDE.md for migration patterns');
  console.log('2. Migrate each file listed above');
  console.log('3. Run this script again to verify progress');
  console.log('4. Test endpoints after migration');
}

console.log('');
