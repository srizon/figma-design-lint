# Design Lint - Figma Plugin

A powerful Figma plugin that helps you identify detached components, text styles, variables, and layers in your design files. Perfect for maintaining design system consistency and cleaning up your Figma projects.

## Features

### 🔍 Comprehensive Scanning
- **Scan Selection**: Analyze only selected frames and components
- **Scan Page**: Check all elements on the current page
- **Scan File**: Perform a complete analysis of the entire file

### 📊 Detailed Detection
- **Detached Text Styles**: Identify text layers without applied text styles
- **Detached Variables**: Discover color fills that could be converted to design tokens
- **Detached Layers**: Locate custom shapes, vectors, and other layers that aren't part of components

### 🎯 Smart Interface
- **Visual Summary**: Quick overview with color-coded statistics
- **Tabbed Results**: Organized view of different types of detached elements
- **Click to Select**: One-click navigation to any detected element
- **Path Information**: See the exact location of each detached element
- **Smart Suggestions**: Automatic recommendations for fixing detected issues
- **One-Click Fixes**: Apply suggested text styles, color variables, and component replacements

## Installation

### Method 1: Manual Installation (Recommended for Development)

1. **Clone or download this repository**
   ```bash
   git clone https://github.com/your-username/figma-design-lint.git
   cd figma-design-lint
   ```

2. **Open Figma Desktop App**

3. **Go to Plugins Menu**
   - Click on the menu icon (hamburger) in the top-left corner
   - Select "Plugins" → "Development" → "New Plugin..."

4. **Import Plugin**
   - Click "Import plugin from manifest..."
   - Select the `manifest.json` file from this repository

5. **Run the Plugin**
   - Go to "Plugins" → "Development" → "Design Lint"
   - Or use the keyboard shortcut: `Cmd/Ctrl + Shift + P`

### Method 2: Figma Community (Future Release)
Once published to the Figma Community, you'll be able to install it directly from the Figma Community marketplace.

## Usage

### Getting Started

1. **Open your Figma file** that you want to analyze

2. **Launch the plugin** from the Plugins menu

3. **Choose your scan scope**:
   - **Scan Selection**: Select specific frames/components first, then click "Scan Selection"
   - **Scan Page**: Click "Scan Page" to analyze the current page
   - **Scan File**: Click "Scan File" to check the entire document

4. **Review the results**:
   - Check the summary cards for quick statistics
   - Use the tabs to explore different types of detached elements
   - Click on any item to select it in Figma

### Understanding the Results

#### Summary Cards
- **Text Styles**: Teal - Text without applied styles
- **Variables**: Blue - Colors that could be variables
- **Layers**: Green - Custom shapes, vectors, and other layers not in components

#### Smart Suggestions
The plugin automatically suggests fixes for detected issues:

**Text Style Suggestions**
- **Exact Match**: Font family, size, line height, and letter spacing all match
- **Partial Match**: Font family and size match, other properties may differ
- **Fuzzy Match**: Font family matches, other properties may differ

**Color Variable Suggestions**
- **Exact Match**: Color values are identical
- **Similar Match**: Colors are within 10% tolerance



#### One-Click Fixes
- **Apply Text Style**: Automatically apply the suggested text style to the text element
- **Apply Color Variable**: Replace the color with the suggested design token
- **Ignore**: Dismiss the suggestion if it's not appropriate

#### Detected Elements
Each item shows:
- **Name**: The layer/component name
- **Type**: The element type (INSTANCE, TEXT, etc.)
- **Path**: Full hierarchy path to locate the element
- **Content**: Preview of text content or color values
- **Font Properties**: For text elements, shows font family, size, line height, and letter spacing
- **Suggestions**: Recommended fixes with accept/reject buttons

### Best Practices

1. **Start Small**: Begin with "Scan Selection" on a few frames to understand the results
2. **Review Suggestions**: Check each suggestion before applying to ensure it's appropriate
3. **Regular Checks**: Run the plugin periodically to maintain design system health
4. **Batch Fixes**: Use the one-click fixes to quickly resolve multiple issues
5. **Team Coordination**: Share results with your team to maintain consistency

## What Gets Detected

## Smart Suggestions & Fixes

### Text Style Matching
The plugin analyzes text elements without applied styles and finds matching text styles from your design system:
- **Font Family & Style**: Matches Inter Regular, Inter Bold, etc.
- **Font Size**: Matches exact pixel sizes (16px, 24px, etc.)
- **Line Height**: Matches pixel or percentage line heights
- **Letter Spacing**: Matches tracking values

### Color Variable Matching
For colors not using design tokens, the plugin suggests existing variables:
- **Exact Color Match**: Finds variables with identical RGB values
- **Similar Color Match**: Finds variables within 10% color tolerance
- **Fill & Stroke Support**: Detects both background fills and stroke/outline colors
- **Comprehensive Coverage**: Works on all shape types, text outlines, vectors, and custom graphics



### Detached Text Styles
- Text layers without applied text styles
- Text that uses local formatting instead of design system styles
- Can lead to inconsistent typography across your designs

### Detached Variables
- **Solid Color Fills**: Background colors that could be converted to design tokens
- **Solid Color Strokes**: Border/outline colors that aren't using variables
- **Text Outlines**: Stroke colors applied to text elements
- **Shape Borders**: Stroke colors on rectangles, circles, vectors, and custom shapes
- **Effect Colors**: Shadow and other effect colors that could use variables
- Helps identify opportunities for better variable usage across all color properties

### Detached Layers
- Custom vector shapes and boolean operations
- Rectangles, ellipses, polygons, and other shapes not in components
- Text elements that could be part of components
- Images and other media elements
- Groups containing components or custom shapes
- Any layer that isn't part of a component and could benefit from design system integration

## Troubleshooting

### Plugin Not Loading
- Ensure all files (`manifest.json`, `code.js`, `ui.html`) are in the same directory
- Check that the manifest.json has the correct file references
- Restart Figma if the plugin doesn't appear

### No Results Found
- Make sure you have elements selected when using "Scan Selection"
- Verify that your file contains the types of elements you're looking for
- Try scanning a larger scope (Page or File) if selection is empty

### Performance Issues
- For large files, use "Scan Selection" instead of "Scan File"
- Close other plugins to free up memory
- Consider scanning in smaller chunks

## Development

### Project Structure
```
figma-design-lint/
├── manifest.json    # Plugin configuration
├── code.js         # Main plugin logic
├── ui.html         # User interface
└── README.md       # This file
```

### Customization
You can modify the detection logic in `code.js`:
- Adjust detection criteria for different element types
- Add new types of detached elements to scan for
- Modify the scanning scope and depth

### Building for Production
1. Test thoroughly with various file types
2. Update the manifest.json with your plugin details
3. Follow Figma's plugin publishing guidelines
4. Submit to the Figma Community

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

If you encounter any issues or have questions:
1. Check the troubleshooting section above
2. Open an issue on GitHub
3. Contact the development team

---

**Happy designing! 🎨**

*This plugin helps maintain clean, consistent design systems by identifying elements that have drifted from your established patterns.* 