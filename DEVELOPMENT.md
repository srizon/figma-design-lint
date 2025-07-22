# Development Guide

This guide will help you set up the development environment and contribute to the Design System Detector plugin.

## Prerequisites

- Figma Desktop App
- Basic knowledge of JavaScript
- Understanding of Figma Plugin API

## Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/figma-ds-linter.git
   cd figma-ds-linter
   ```

2. **Open Figma Desktop App**

3. **Import the plugin for development**
   - Go to Plugins → Development → New Plugin...
   - Click "Import plugin from manifest..."
   - Select the `manifest.json` file from this project

4. **Start developing**
   - Make changes to `code.js` or `ui.html`
   - Reload the plugin in Figma (Plugins → Development → Design System Detector)
   - Test your changes

## Project Structure

```
figma-ds-linter/
├── manifest.json    # Plugin configuration and metadata
├── code.js         # Main plugin logic (Figma Plugin API)
├── ui.html         # User interface (HTML/CSS/JS)
├── package.json    # Project metadata
├── README.md       # User documentation
├── DEVELOPMENT.md  # This file
└── .gitignore      # Git ignore rules
```

## Key Files Explained

### manifest.json
- Defines plugin metadata and permissions
- Specifies entry points (`main` and `ui`)
- Sets up plugin capabilities

### code.js
- Contains the main plugin logic
- Handles Figma API interactions
- Processes design elements
- Communicates with the UI

### ui.html
- Provides the user interface
- Handles user interactions
- Displays scan results
- Manages plugin state

## Development Workflow

1. **Make changes** to the code
2. **Test locally** in Figma Desktop
3. **Reload plugin** to see changes
4. **Test with different files** to ensure compatibility
5. **Commit changes** with descriptive messages

## Testing

### Test Scenarios
- Files with no detached elements
- Files with many detached elements
- Large files (performance testing)
- Different element types
- Various file structures

### Test Files
Create test files with:
- Detached component instances
- Text without styles
- Custom colors and effects
- Vector shapes and groups
- Mixed content types

## Common Development Tasks

### Adding New Detection Types

1. **Update the detection logic** in `code.js`:
   ```javascript
   // Add new detection in traverseNode function
   if (node.type === 'YOUR_NODE_TYPE') {
     // Your detection logic
   }
   ```

2. **Update the results structure**:
   ```javascript
   // Add to scanResults object
   newDetections: [],
   ```

3. **Update the UI** in `ui.html`:
   - Add new tab
   - Update summary cards
   - Handle new data type

### Modifying the UI

The UI is built with vanilla HTML/CSS/JavaScript. Key areas:
- **Styling**: Modify CSS in the `<style>` section
- **Layout**: Update HTML structure
- **Functionality**: Modify JavaScript functions

### Performance Optimization

For large files:
- Implement pagination
- Add progress indicators
- Use async processing
- Limit scan depth

## Debugging

### Console Logging
Add console.log statements in `code.js`:
```javascript
console.log('Processing node:', node.name);
```

### Figma Notifications
Use Figma's notification system:
```javascript
figma.notify('Debug message');
```

### UI Debugging
Use browser dev tools for UI debugging:
- Right-click in plugin window
- Select "Inspect Element"

## Building for Production

1. **Test thoroughly** with various file types
2. **Update manifest.json** with final details
3. **Create production build** (if needed)
4. **Follow Figma's publishing guidelines**

## Contributing Guidelines

### Code Style
- Use consistent indentation (2 spaces)
- Add comments for complex logic
- Use descriptive variable names
- Follow JavaScript best practices

### Commit Messages
Use conventional commit format:
```
feat: add new detection type for gradients
fix: resolve issue with text style detection
docs: update README with new features
```

### Pull Requests
1. Create feature branch
2. Make changes
3. Test thoroughly
4. Update documentation
5. Submit PR with description

## Resources

- [Figma Plugin API Documentation](https://www.figma.com/plugin-docs/)
- [Figma Plugin Examples](https://github.com/figma/plugin-examples)
- [Figma Community Guidelines](https://www.figma.com/community-guidelines/)

## Support

For development questions:
1. Check the Figma Plugin API docs
2. Review existing issues
3. Create a new issue with details
4. Join the Figma Plugin community

---

Happy coding! 🚀 