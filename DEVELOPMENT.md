# Development Guide

**Version 1.1.1**

This guide will help you set up the development environment and contribute to the Figma Design Lint plugin.

## Prerequisites

- Figma Desktop App
- Basic knowledge of JavaScript
- Understanding of Figma Plugin API
- Git for version control

## Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/srizon/figma-design-lint.git
   cd figma-design-lint
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
figma-design-lint/
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
- Sets up plugin capabilities for design system analysis

### code.js
- Contains the main plugin logic for scanning design elements
- Handles Figma API interactions and element traversal
- Processes text styles, color variables, and layer organization
- Communicates with the UI via postMessage
- **Recent improvements**: Added timeout protection, error handling, and performance optimizations

### ui.html
- Provides the user interface with Figma-inspired design
- Handles user interactions and scan controls
- Displays scan results in organized tabs
- Manages plugin state and responsive design
- **Recent improvements**: Enhanced error display and loading states

## Development Workflow

1. **Make changes** to the code
2. **Test locally** in Figma Desktop
3. **Reload plugin** to see changes (Plugins → Development → Design System Detector → Reload)
4. **Test with different files** to ensure compatibility
5. **Commit changes** with descriptive messages
6. **Push to GitHub** for version control

## Recent Fixes and Improvements

### Performance & Reliability (Latest Update)
- **Timeout Protection**: Added 30s main scan, 10s text styles, 5s color variables timeouts
- **Error Handling**: Comprehensive try-catch blocks with fallback mechanisms
- **Simplified Logic**: Removed complex library component importing that caused hanging
- **UI Reliability**: Ensures scan always completes with proper error display
- **Instance Limiting**: Limited to first 50 instances for performance

### User Experience Improvements (v1.1.1)
- **Smart Empty State Detection**: Distinguishes between empty pages and clean designs
- **Improved Visual Layout**: Better vertical centering and responsive design
- **Context-Aware Messaging**: Different messages for Selection/Page/File scans
- **Enhanced Accessibility**: Better screen reader support and keyboard navigation
- **Versioning System**: Automated semantic versioning with Git hooks

### Key Features
- **Text Style Detection**: Finds text without applied styles
- **Color Variable Detection**: Identifies colors that could use variables
- **Layer Organization**: Detects custom shapes that could be components
- **Library Support**: Works with both local and remote design system elements
- **Responsive UI**: Adapts to different window sizes

## Testing

### Test Scenarios
- Files with no detached elements (should show success message)
- Files with many detached elements (performance testing)
- Large files (should complete within timeout limits)
- Different element types (text, shapes, components)
- Various file structures (pages, frames, groups)
- Library-connected files (remote components and styles)

### Test Files
Create test files with:
- Text elements without text styles applied
- Rectangles with custom colors (not using variables)
- Custom vector shapes outside components
- Groups containing mixed content
- Component instances with overrides
- Library components and styles

### Performance Testing
- **Small files** (< 100 elements): Should complete in < 5 seconds
- **Medium files** (100-1000 elements): Should complete in < 15 seconds
- **Large files** (> 1000 elements): Should complete in < 30 seconds
- **Timeout protection**: Should never hang indefinitely

## Common Development Tasks

### Adding New Detection Types

1. **Update the detection logic** in `code.js`:
   ```javascript
   // Add new detection in traverseNode function
   if (node.type === 'YOUR_NODE_TYPE') {
     // Your detection logic
     scanResults.newDetections.push({
       id: node.id,
       name: node.name,
       type: 'NEW_TYPE',
       path: getNodePath(node),
       description: 'Description of the issue'
     });
   }
   ```

2. **Update the results structure**:
   ```javascript
   // Add to scanResults object
   newDetections: [],
   ```

3. **Update the UI** in `ui.html`:
   - Add new tab in the results section
   - Update summary counts
   - Handle new data type in displayList function

### Modifying the UI

The UI is built with vanilla HTML/CSS/JavaScript with Figma-inspired design:

- **Styling**: Modify CSS variables in the `:root` section
- **Layout**: Update HTML structure in the main content area
- **Functionality**: Modify JavaScript functions for user interactions
- **Responsive Design**: Use CSS media queries for different screen sizes

### Performance Optimization

For large files:
- **Timeout Protection**: Always implement timeouts for async operations
- **Error Handling**: Use try-catch blocks with fallback logic
- **Limiting**: Limit the number of elements processed in complex operations
- **Caching**: Use the existing caching system for repeated operations

## Debugging

### Console Logging
Add console.log statements in `code.js`:
```javascript
console.log('Processing node:', node.name, 'Type:', node.type);
```

### Figma Notifications
Use Figma's notification system:
```javascript
figma.notify('Debug message', {timeout: 3000});
```

### UI Debugging
Use browser dev tools for UI debugging:
- Right-click in plugin window
- Select "Inspect Element"
- Check console for JavaScript errors

### Common Issues
- **Loading screen hanging**: Check for infinite loops or missing error handling
- **Performance issues**: Look for operations without timeouts
- **UI not updating**: Verify postMessage communication between code.js and ui.html

## Building for Production

1. **Test thoroughly** with various file types and sizes
2. **Update manifest.json** with final details and version
3. **Verify all error handling** works correctly
4. **Test timeout scenarios** to ensure reliability
5. **Follow Figma's publishing guidelines**

## Contributing Guidelines

### Code Style
- Use consistent indentation (2 spaces)
- Add comments for complex logic
- Use descriptive variable names
- Follow JavaScript best practices
- **Always include error handling** for async operations
- **Add timeouts** for potentially long-running operations

### Commit Messages
Use conventional commit format:
```
feat: add new detection type for gradients
fix: resolve infinite loading screen issue
perf: optimize scan performance with timeouts
docs: update development guide with recent fixes
```

### Pull Requests
1. Create feature branch from master
2. Make changes with proper error handling
3. Test thoroughly with different file types
4. Update documentation if needed
5. Submit PR with detailed description

## Recent Development Notes

### Critical Fixes Applied
- **Infinite Loading Issue**: Resolved by adding timeout protection and simplifying complex logic
- **Library Component Importing**: Removed problematic async importing that caused hanging
- **Error Recovery**: Added fallback mechanisms to ensure UI always receives results
- **Performance**: Limited instance checking and simplified traversal algorithms

### Best Practices for Future Development
- **Always add timeouts** to async operations
- **Use try-catch blocks** around potentially failing code
- **Provide fallback logic** for error scenarios
- **Test with large files** to ensure performance
- **Limit complex operations** to prevent hanging

## Resources

- [Figma Plugin API Documentation](https://www.figma.com/plugin-docs/)
- [Figma Plugin Examples](https://github.com/figma/plugin-examples)
- [Figma Community Guidelines](https://www.figma.com/community-guidelines/)
- [Project Repository](https://github.com/srizon/figma-design-lint)

## Support

For development questions:
1. Check the Figma Plugin API docs
2. Review existing issues on GitHub
3. Create a new issue with detailed reproduction steps
4. Join the Figma Plugin community

---

Happy coding! 🚀 