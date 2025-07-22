# Automatic Versioning System

This Figma plugin includes an automated versioning system that automatically increments version numbers based on your git commit messages.

## How It Works

The versioning system:
- **Automatically increments version numbers** on every git commit
- **Updates version** in `package.json` (manifest.json doesn't support version field)
- **Creates git tags** for each version
- **Analyzes commit messages** to determine the appropriate version bump

## Setup

### Initial Setup

1. **Install the git hooks:**
   ```bash
   npm run setup-hooks
   ```

2. **That's it!** The system is now active and will automatically version your commits.

## Version Increment Rules

The system analyzes your commit messages to determine the version increment type:

### Major Version (1.0.0 → 2.0.0)
Triggered by commit messages containing:
- `breaking change`
- `major:`
- `!:`
- `breaking:`

**Examples:**
```bash
git commit -m "major: Complete redesign of plugin architecture"
git commit -m "feat!: Remove deprecated API endpoints"
git commit -m "breaking change: Update to new Figma API"
```

### Minor Version (1.0.0 → 1.1.0)
Triggered by commit messages containing:
- `feat:`
- `feature:`
- `add:`
- `minor:`

**Examples:**
```bash
git commit -m "feat: Add new component detection feature"
git commit -m "feature: Support for color variables"
git commit -m "add: Export functionality"
```

### Patch Version (1.0.0 → 1.0.1)
Everything else (default):
- `fix:`
- `docs:`
- `style:`
- `refactor:`
- `test:`
- Or any other commit message

**Examples:**
```bash
git commit -m "fix: Resolve issue with text style detection"
git commit -m "docs: Update README with new features"
git commit -m "refactor: Improve code organization"
```

## Manual Versioning

You can also manually increment versions:

```bash
# Increment patch version (1.0.0 → 1.0.1)
npm run version:patch

# Increment minor version (1.0.0 → 1.1.0)
npm run version:minor

# Increment major version (1.0.0 → 2.0.0)
npm run version:major

# Auto-detect version based on last commit message
npm run version:auto
```

## GitHub Actions Integration

The repository includes a GitHub Action that:
- Automatically versions commits pushed to `main`/`master`
- Creates GitHub releases
- Pushes version tags back to the repository

## Files Updated

When versioning occurs, this file is automatically updated:
- `package.json` - Updates the `version` field

**Note:** `manifest.json` does not support a version field according to Figma's plugin specification.

## Git Tags

Each version automatically creates a git tag in the format `v1.0.0`, which:
- Helps track releases
- Enables easy rollbacks
- Integrates with GitHub releases

## Troubleshooting

### Hooks not working?
```bash
# Re-run the setup
npm run setup-hooks

# Check if hooks are executable
ls -la .git/hooks/
```

### Want to disable automatic versioning temporarily?
```bash
# Skip hooks for a single commit
git commit --no-verify -m "Your commit message"
```

### Version conflicts?
If you encounter version conflicts, you can manually reset:

```bash
# Reset to a specific version in package.json
node -e "
const fs = require('fs');
const version = '1.0.0'; // Set your desired version
const pkg = JSON.parse(fs.readFileSync('package.json'));
pkg.version = version;
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
console.log('Reset to version', version);
"
```

## Examples

Here's what the versioning output looks like:

```bash
$ git commit -m "feat: Add automatic versioning system"

🚀 Running pre-commit versioning...
🔄 Starting automatic versioning...
Current version: 1.0.0
Analyzing commit message: "feat: Add automatic versioning system"
Auto-detected version type: minor
New version: 1.1.0
Updated package.json: 1.0.0 -> 1.1.0
✅ Version updated successfully in package.json
ℹ️  Note: Figma manifest.json does not support version field
📝 Staged updated version file
📝 Continuing with commit...

🏷️  Creating version tag...
✅ Created tag v1.1.0
```

## Best Practices

1. **Use conventional commit messages** for consistent versioning
2. **Review version increments** before major releases
3. **Test your plugin** before pushing to main/master
4. **Use feature branches** for development to avoid automatic versioning on every commit
5. **Document breaking changes** in commit messages when introducing them

---

For more information about conventional commits, see: https://www.conventionalcommits.org/ 