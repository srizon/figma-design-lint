#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Setup script to install git hooks for automatic versioning
 */

console.log('🔧 Setting up git hooks for automatic versioning...');

// Paths
const hooksDir = path.join(__dirname, '..', '.git', 'hooks');
const sourceHooksDir = path.join(__dirname, '..', '.githooks');

// Check if .git directory exists
if (!fs.existsSync(path.join(__dirname, '..', '.git'))) {
  console.error('❌ Not in a git repository. Please run "git init" first.');
  process.exit(1);
}

// Ensure hooks directory exists
if (!fs.existsSync(hooksDir)) {
  fs.mkdirSync(hooksDir, { recursive: true });
  console.log('📁 Created .git/hooks directory');
}

// Copy hooks
const hooks = ['pre-commit', 'post-commit'];

hooks.forEach(hookName => {
  const sourcePath = path.join(sourceHooksDir, hookName);
  const targetPath = path.join(hooksDir, hookName);
  
  if (fs.existsSync(sourcePath)) {
    try {
      // Copy the hook file
      fs.copyFileSync(sourcePath, targetPath);
      
      // Make it executable
      fs.chmodSync(targetPath, '755');
      
      console.log(`✅ Installed ${hookName} hook`);
    } catch (error) {
      console.error(`❌ Failed to install ${hookName} hook:`, error.message);
    }
  } else {
    console.warn(`⚠️  Source hook not found: ${sourcePath}`);
  }
});

// Set git hooks path (optional, for custom hooks directory)
try {
  execSync('git config core.hooksPath .githooks', { stdio: 'pipe' });
  console.log('🔧 Configured git to use .githooks directory');
} catch (error) {
  console.log('💡 Note: Using default .git/hooks directory (hooks copied there)');
}

console.log('\n🎉 Git hooks setup complete!');
console.log('\nHow it works:');
console.log('• Every commit will automatically increment the version number');
console.log('• Version type is determined by your commit message:');
console.log('  - "feat:", "feature:", "add:", "minor:" → minor version bump');
console.log('  - "breaking change", "major:", "!:", "breaking:" → major version bump');
console.log('  - Everything else → patch version bump');
console.log('• Git tags will be created automatically');
console.log('\nManual versioning:');
console.log('• npm run version:patch   (1.0.0 → 1.0.1)');
console.log('• npm run version:minor   (1.0.0 → 1.1.0)');
console.log('• npm run version:major   (1.0.0 → 2.0.0)');
console.log('• npm run version:auto    (analyzes last commit message)'); 