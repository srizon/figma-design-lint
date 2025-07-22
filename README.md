# Design Lint - Figma Plugin

**Version 1.1.1**

A Figma plugin that helps maintain design system consistency by identifying detached elements and suggesting fixes from your existing design tokens.

## Features

- **🔍 Comprehensive Scanning** - Analyze selection, current page, or entire file
- **📝 Text Style Detection** - Find text without applied styles with smart matching suggestions
- **🎨 Color Variable Detection** - Identify colors that could use design tokens
- **🧩 Component Detection** - Locate shapes and layers not organized in components
- **📚 Library Support** - Full support for text styles from connected libraries
- **⚡ One-Click Fixes** - Apply suggested text styles and color variables instantly
- **🎯 Smart Empty State Detection** - Distinguishes between empty pages and clean, well-organized designs
- **📱 Responsive UI** - Optimized layout with proper vertical centering and modern Figma-style interface

## Installation

### Development Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/srizon/figma-design-lint.git
   ```

2. In Figma Desktop:
   - Go to **Plugins** → **Development** → **Import plugin from manifest...**
   - Select the `manifest.json` file from this repository
   - Run the plugin from **Plugins** → **Development** → **Design Lint**

## Usage

1. **Choose scan scope**: Selection, Page, or File
2. **Review results**: Browse detached elements by category (Text, Color, Layers)
3. **Apply fixes**: Use one-click fixes for suggested text styles and color variables
4. **Navigate**: Click any item to select it in Figma

### Smart Suggestions

**Text Styles**
- **Exact Match**: Font family, size, line height, and letter spacing match
- **Partial Match**: Font family and size match
- **Fuzzy Match**: Font family matches

**Color Variables**
- **Exact Match**: Identical RGB values
- **Similar Match**: Colors within 10% tolerance

## What Gets Detected

### Text Without Styles
Text layers that don't use your design system's text styles, with suggestions from local and library styles.

### Colors Not Using Variables
- Solid color fills and strokes
- Effect colors (shadows, etc.)
- Suggestions from existing color variables

### Detached Layers
- Custom shapes, vectors, and elements not organized in components
- Groups that could benefit from componentization

## Recent Improvements (v1.1.1)

### Enhanced User Experience
- **Smart Empty State Messaging**: Now distinguishes between truly empty pages and well-organized designs with no issues
- **Improved Visual Layout**: Better vertical centering and responsive design
- **Context-Aware Messages**: Different messaging for Selection, Page, and File scans
- **Better Status Feedback**: More informative notifications and progress indicators

### Technical Improvements
- **Optimized Performance**: Better handling of large files and complex component structures
- **Enhanced Accessibility**: Improved screen reader support and keyboard navigation
- **Versioning System**: Automated version management with semantic versioning
- **Development Workflow**: Git hooks and automated processes for consistent releases

## Contributing

Contributions welcome! Please open an issue for major changes before submitting a pull request.

### Development Setup

1. Clone the repository and install dependencies
2. Run `npm run setup-hooks` to configure Git hooks
3. Use version scripts for releases:
   - `npm run version:patch` - Bug fixes
   - `npm run version:minor` - New features
   - `npm run version:major` - Breaking changes
   - `npm run version:auto` - Automatic versioning

## License

MIT License - see LICENSE file for details.

---

*Maintain clean, consistent design systems by identifying elements that have drifted from your established patterns.* 