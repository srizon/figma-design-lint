#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Automatic versioning script for Figma plugin
 * Updates package.json with version information
 * Note: Figma manifest.json doesn't support version field
 */

// File paths
const packageJsonPath = path.join(__dirname, '..', 'package.json');

/**
 * Parse semantic version string (e.g., "1.2.3" -> [1, 2, 3])
 */
function parseVersion(versionString) {
  return versionString.split('.').map(num => parseInt(num, 10));
}

/**
 * Format version array back to string (e.g., [1, 2, 3] -> "1.2.3")
 */
function formatVersion(versionArray) {
  return versionArray.join('.');
}

/**
 * Increment version based on type
 */
function incrementVersion(currentVersion, type = 'patch') {
  const [major, minor, patch] = parseVersion(currentVersion);
  
  switch (type.toLowerCase()) {
    case 'major':
      return formatVersion([major + 1, 0, 0]);
    case 'minor':
      return formatVersion([major, minor + 1, 0]);
    case 'patch':
    default:
      return formatVersion([major, minor, patch + 1]);
  }
}

/**
 * Determine version increment type based on git commit messages
 */
function determineVersionType() {
  try {
    // Get the latest commit message
    const commitMessage = execSync('git log -1 --pretty=%B', { encoding: 'utf8' }).trim().toLowerCase();
    
    console.log(`Analyzing commit message: "${commitMessage}"`);
    
    // Check for breaking changes or major updates
    if (commitMessage.includes('breaking change') || 
        commitMessage.includes('major:') ||
        commitMessage.includes('!:') ||
        commitMessage.includes('breaking:')) {
      return 'major';
    }
    
    // Check for new features
    if (commitMessage.includes('feat:') || 
        commitMessage.includes('feature:') ||
        commitMessage.includes('add:') ||
        commitMessage.includes('minor:')) {
      return 'minor';
    }
    
    // Default to patch for fixes, docs, refactor, etc.
    return 'patch';
  } catch (error) {
    console.log('Could not determine version type from git, defaulting to patch');
    return 'patch';
  }
}

/**
 * Update version in a JSON file
 */
function updateVersionInFile(filePath, newVersion) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const jsonData = JSON.parse(fileContent);
    
    const oldVersion = jsonData.version;
    jsonData.version = newVersion;
    
    fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2) + '\n');
    console.log(`Updated ${path.basename(filePath)}: ${oldVersion} -> ${newVersion}`);
    
    return true;
  } catch (error) {
    console.error(`Error updating ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Get current version from package.json
 */
function getCurrentVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.version;
  } catch (error) {
    console.error('Error reading current version:', error.message);
    process.exit(1);
  }
}

/**
 * Create git tag for the new version
 */
function createGitTag(version) {
  try {
    execSync(`git tag -a v${version} -m "Version ${version}"`, { stdio: 'inherit' });
    console.log(`Created git tag: v${version}`);
  } catch (error) {
    console.log(`Note: Could not create git tag (${error.message})`);
  }
}

/**
 * Main versioning function
 */
function main() {
  const args = process.argv.slice(2);
  const versionType = args[0] || 'auto';
  
  console.log('🔄 Starting automatic versioning...');
  
  // Get current version
  const currentVersion = getCurrentVersion();
  console.log(`Current version: ${currentVersion}`);
  
  // Determine new version
  let newVersion;
  if (versionType === 'auto') {
    const autoType = determineVersionType();
    newVersion = incrementVersion(currentVersion, autoType);
    console.log(`Auto-detected version type: ${autoType}`);
  } else {
    newVersion = incrementVersion(currentVersion, versionType);
    console.log(`Manual version type: ${versionType}`);
  }
  
  console.log(`New version: ${newVersion}`);
  
  // Update package.json file
  const packageUpdated = updateVersionInFile(packageJsonPath, newVersion);
  
  if (packageUpdated) {
    console.log('✅ Version updated successfully in package.json');
    console.log('ℹ️  Note: Figma manifest.json does not support version field');
    
    // Stage the updated files for commit
    try {
      execSync('git add package.json', { stdio: 'inherit' });
      console.log('📝 Staged updated version file');
    } catch (error) {
      console.log('Note: Could not stage files automatically');
    }
    
    // Create git tag if this isn't running in a hook
    if (!process.env.GIT_HOOK) {
      createGitTag(newVersion);
    }
    
  } else {
    console.error('❌ Failed to update version file');
    process.exit(1);
  }
}

// Only run if called directly (not imported)
if (require.main === module) {
  main();
}

module.exports = {
  incrementVersion,
  parseVersion,
  formatVersion,
  determineVersionType,
  getCurrentVersion
}; 