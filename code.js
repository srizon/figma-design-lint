figma.showUI(__html__, { 
  width: 375, 
  height: 600,
  themeColors: true
});

// Types for detached elements
const DETACHED_TYPES = {
  TEXT_STYLE: 'text_style',
  VARIABLE: 'variable',
  LAYER: 'layer'
};

// Scan results interface
let scanResults = {
  detachedTextStyles: [],
  detachedVariables: [],
  detachedLayers: [],
  summary: {
    totalDetached: 0,
    textStyles: 0,
    variables: 0,
    layers: 0
  }
};

// Track current scan scope for refreshing after fixes
let currentScanScope = 'page'; // 'selection', 'page', or 'file'
let lastScannedNodes = [];

// Get all available text styles with caching
let availableTextStylesCache = null;
let textStylesCacheTimestamp = 0;
const CACHE_DURATION = 30000; // 30 seconds

async function getAvailableTextStyles() {
  const now = Date.now();
  
  // Return cached text styles if still valid
  if (availableTextStylesCache && (now - textStylesCacheTimestamp) < CACHE_DURATION) {
    return availableTextStylesCache;
  }
  
  console.log('Refreshing text styles cache...');
  
  // IMPORTANT: This function should NEVER modify the document during scanning.
  // It should only read and discover available text styles without changing anything.
  
  let allTextStyles = [];
  const seenStyleIds = new Set();
  
  try {
    // Get local text styles first
    const localTextStyles = figma.getLocalTextStyles();
    console.log('Local text styles found:', localTextStyles.length);
    localTextStyles.forEach(style => {
      if (!seenStyleIds.has(style.id)) {
        allTextStyles.push(style);
        seenStyleIds.add(style.id);
      }
    });
    
    // Enhanced approach to find ALL library text styles
    console.log('Searching for library text styles...');
    
    // Method 1: Traverse document for currently used styles
    const traverseForStyles = (node) => {
      if (node.type === 'TEXT' && node.textStyleId) {
        try {
          const style = figma.getStyleById(node.textStyleId);
          if (style && style.type === 'TEXT' && !seenStyleIds.has(style.id)) {
            allTextStyles.push(style);
            seenStyleIds.add(style.id);
            console.log('Found used text style:', style.name, style.remote ? '(Library)' : '(Local)');
          }
        } catch (error) {
          // Style might not be available, skip it
        }
      }
      
      if ('children' in node && node.children) {
        node.children.forEach(traverseForStyles);
      }
    };
    
    // Traverse all pages (this also helps find styles used in non-visible pages)
    figma.root.children.forEach(page => {
      page.children.forEach(traverseForStyles);
    });
    
    // Try to access team library styles through the teamLibrary API if available
    try {
      if (figma.teamLibrary && figma.teamLibrary.getAvailableLibraryTextStylesAsync) {
        console.log('Attempting to access team library text styles...');
        const libraryStyles = await figma.teamLibrary.getAvailableLibraryTextStylesAsync();
        libraryStyles.forEach(style => {
          if (!seenStyleIds.has(style.id)) {
            allTextStyles.push(style);
            seenStyleIds.add(style.id);
            console.log('Found team library text style:', style.name);
          }
        });
      }
    } catch (error) {
      console.log('Team library API not available or failed:', error.message);
    }
    
    // Method 2: Try to load library components to discover their text styles
    try {
      // Find all component instances and try to access their main components
      const allInstances = figma.root.findAll(node => node.type === 'INSTANCE');
      console.log('Checking', allInstances.length, 'component instances for library styles...');
      
      // Use Set to track processed component keys to avoid duplicates
      const processedComponentKeys = new Set();
      
      for (const instance of allInstances) {
        try {
          // Check if this instance has a remote main component
          if (instance.mainComponent && instance.mainComponent.remote) {
            const componentKey = instance.mainComponent.key;
            
            // Skip if we've already processed this component
            if (!processedComponentKeys.has(componentKey)) {
              processedComponentKeys.add(componentKey);
              console.log('Found library component instance:', instance.name);
              
              // Traverse the instance to find text styles
              traverseForStyles(instance);
              
              // Also try to access the main component if possible
              try {
                if (componentKey) {
                  // Try to import the component to access all its styles
                  const importedComponent = await figma.importComponentByKeyAsync(componentKey);
                  if (importedComponent) {
                    console.log('Successfully imported library component:', importedComponent.name);
                    traverseForStyles(importedComponent);
                    
                    // Create a temporary instance to ensure we get all default styles
                    try {
                      const tempInstance = importedComponent.createInstance();
                      traverseForStyles(tempInstance);
                      tempInstance.remove(); // Clean up the temporary instance
                    } catch (tempError) {
                      console.log('Could not create temporary instance:', tempError.message);
                    }
                  }
                }
              } catch (importError) {
                console.log('Could not import component:', importError.message);
              }
            }
          }
        } catch (error) {
          // Skip this instance
        }
      }
    } catch (error) {
      console.log('Error accessing library components:', error);
    }
    
    // Method 3: Try to discover styles through style overrides
    const findStylesInOverrides = (node) => {
      if (node.type === 'INSTANCE') {
        try {
          // Check text style overrides
          const textChildren = node.findAll(child => child.type === 'TEXT');
          textChildren.forEach(textNode => {
            if (textNode.textStyleId) {
              try {
                const style = figma.getStyleById(textNode.textStyleId);
                if (style && style.type === 'TEXT' && !seenStyleIds.has(style.id)) {
                  allTextStyles.push(style);
                  seenStyleIds.add(style.id);
                  console.log('Found text style from instance:', style.name, style.remote ? '(Library)' : '(Local)');
                }
              } catch (error) {
                // Skip if style is not accessible
              }
            }
          });
        } catch (error) {
          // Skip this instance
        }
      }
      
      if ('children' in node && node.children) {
        node.children.forEach(findStylesInOverrides);
      }
    };
    
    figma.root.children.forEach(page => {
      page.children.forEach(findStylesInOverrides);
    });
    
    // Method 4: Try to access styles through team library (experimental)
    try {
      // Check if we can access any additional library information
      // Unfortunately, the Figma API doesn't provide direct access to all library styles
      // that aren't currently used in the document
      
      console.log('Attempting to discover unused library styles...');
      
      // Try to access styles through different means
      // This is a workaround since there's no direct API
      const tryAccessLibraryStyles = async () => {
        // Method 4a: Look for library components that might contain text styles
        const libraryInstances = figma.root.findAll(node => 
          node.type === 'INSTANCE' && 
          node.mainComponent && 
          node.mainComponent.remote
        );
        
        for (const instance of libraryInstances) {
          try {
            // Just traverse the instance as-is to find currently used text styles
            // CRITICAL: DO NOT reset overrides as this modifies the document during scanning!
            // Previously this code called instance.resetOverrides() which caused auto-fixing
            // during scanning, which is unacceptable user experience.
            traverseForStyles(instance);
          } catch (error) {
            // Skip this instance
          }
        }
        
        // Method 4b: Try to trigger style loading by accessing component sets
        const componentSets = figma.root.findAll(node => node.type === 'COMPONENT_SET');
        console.log('Checking', componentSets.length, 'component sets for library styles...');
        for (const componentSet of componentSets) {
          try {
            if (componentSet.remote) {
              console.log('Found remote component set:', componentSet.name);
              traverseForStyles(componentSet);
              
              // Also try to import the component set to access more styles
              try {
                if (componentSet.key) {
                  const importedComponentSet = await figma.importComponentSetByKeyAsync(componentSet.key);
                  if (importedComponentSet) {
                    console.log('Successfully imported component set:', importedComponentSet.name);
                    traverseForStyles(importedComponentSet);
                    
                    // Traverse all variants in the component set
                    importedComponentSet.children.forEach(variant => {
                      traverseForStyles(variant);
                    });
                  }
                }
              } catch (importError) {
                console.log('Could not import component set:', importError.message);
              }
            }
          } catch (error) {
            // Skip this component set
          }
        }
        
        // Method 4c: Check if there are any team library styles by looking at import history
        try {
          // Try to access any recently used styles that might still be in memory
          // This is a bit of a hack, but might help discover some library styles
          const allTextNodes = figma.root.findAll(node => node.type === 'TEXT');
          
          // Check if any text nodes have been recently changed and might have library styles
          for (const textNode of allTextNodes) {
            try {
              // Check if there are any style references in the node's history
              if (textNode.textStyleId && textNode.textStyleId !== '') {
                const style = figma.getStyleById(textNode.textStyleId);
                if (style && style.remote && !seenStyleIds.has(style.id)) {
                  allTextStyles.push(style);
                  seenStyleIds.add(style.id);
                  console.log('Found library style from text node:', style.name);
                }
              }
            } catch (error) {
              // Skip this text node
            }
          }
        } catch (error) {
          console.log('Error in additional style discovery:', error);
        }
      };
      
      await tryAccessLibraryStyles();
      
    } catch (error) {
      console.log('Library style discovery error:', error);
    }
    
    // Sort text styles: local first, then remote, alphabetically within each group
    allTextStyles.sort((a, b) => {
      if (a.remote !== b.remote) {
        return a.remote ? 1 : -1; // Local styles first
      }
      return a.name.localeCompare(b.name);
    });
    
  } catch (error) {
    console.log('Error getting text styles:', error);
  }
  
  // Cache the results
  availableTextStylesCache = allTextStyles;
  textStylesCacheTimestamp = now;
  
  console.log('=== TEXT STYLE DISCOVERY SUMMARY ===');
  console.log('Total available text styles:', allTextStyles.length);
  console.log('Local text styles:', allTextStyles.filter(s => !s.remote).length);
  console.log('Remote/Library text styles:', allTextStyles.filter(s => s.remote).length);
  
  if (allTextStyles.filter(s => s.remote).length > 0) {
    console.log('Library styles found:');
    allTextStyles.filter(s => s.remote).forEach(style => {
      console.log('  -', style.name);
    });
  } else {
    console.log('ℹ️ No library text styles found. This could mean:');
    console.log('  - No libraries are connected to this file');
    console.log('  - Library styles haven\'t been used in this document yet');
    console.log('  - The plugin can only discover library styles that are currently used in the document due to Figma API limitations');
  }
  
  return allTextStyles;
}

// Find matching text styles based on font properties - returns multiple matches
async function findMatchingTextStyles(textNode) {
  const textStyles = await getAvailableTextStyles();
  
  if (!textNode.fontName || !textNode.fontSize) {
    return { matches: [], allStyles: textStyles };
  }
  
  const nodeFontName = textNode.fontName;
  const nodeFontSize = textNode.fontSize;
  const nodeLineHeight = textNode.lineHeight;
  const nodeLetterSpacing = textNode.letterSpacing;
  
  const matches = [];
  
  // Find exact matches first
  textStyles.forEach(style => {
    try {
      const styleFontName = style.fontName;
      const styleFontSize = style.fontSize;
      const styleLineHeight = style.lineHeight;
      const styleLetterSpacing = style.letterSpacing;
      
      if (styleFontName.family === nodeFontName.family &&
          styleFontName.style === nodeFontName.style &&
          styleFontSize === nodeFontSize &&
          (styleLineHeight === nodeLineHeight || 
           (styleLineHeight && nodeLineHeight && 
            Math.abs(styleLineHeight.value - nodeLineHeight.value) < 0.1)) &&
          (styleLetterSpacing === nodeLetterSpacing ||
           (styleLetterSpacing && nodeLetterSpacing &&
            Math.abs(styleLetterSpacing.value - nodeLetterSpacing.value) < 0.1))) {
        
        matches.push({
          style: style,
          matchType: 'exact',
          isFromLibrary: style.remote || false,
          libraryName: style.remote ? (style.description || 'Connected Library') : null
        });
      }
    } catch (error) {
      // Skip this style
    }
  });
  
  // If no exact matches, try partial matches (same font family and size)
  if (matches.length === 0) {
    textStyles.forEach(style => {
      try {
        const styleFontName = style.fontName;
        const styleFontSize = style.fontSize;
        
        if (styleFontName.family === nodeFontName.family &&
            styleFontName.style === nodeFontName.style &&
            styleFontSize === nodeFontSize) {
          
          matches.push({
            style: style,
            matchType: 'partial',
            isFromLibrary: style.remote || false,
            libraryName: style.remote ? (style.description || 'Connected Library') : null
          });
        }
      } catch (error) {
        // Skip this style
      }
    });
  }
  
  // If still no matches, try fuzzy matches (same font family)
  if (matches.length === 0) {
    textStyles.forEach(style => {
      try {
        const styleFontName = style.fontName;
        
        if (styleFontName.family === nodeFontName.family) {
          matches.push({
            style: style,
            matchType: 'fuzzy',
            isFromLibrary: style.remote || false,
            libraryName: style.remote ? (style.description || 'Connected Library') : null
          });
        }
      } catch (error) {
        // Skip this style
      }
    });
  }
  
  return { matches, allStyles: textStyles };
}

// Find matching color variable
function findMatchingColorVariable(color) {
  try {
    const variables = figma.variables.getLocalVariables();
    const colorVariables = variables.filter(v => v.resolvedType === 'COLOR');
    
    // Convert color to RGB string for comparison
    const colorString = `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`;
    
    // Try to find exact match
    for (const variable of colorVariables) {
      try {
        const resolvedValue = variable.resolveForConsumer();
        if (resolvedValue && resolvedValue.type === 'SOLID') {
          const varColor = resolvedValue.color;
          const varColorString = `rgb(${Math.round(varColor.r * 255)}, ${Math.round(varColor.g * 255)}, ${Math.round(varColor.b * 255)})`;
          
          if (varColorString === colorString) {
            return { variable, matchType: 'exact' };
          }
        }
      } catch (error) {
        continue;
      }
    }
    
    // Try to find similar colors (within tolerance)
    const tolerance = 0.1; // 10% tolerance
    for (const variable of colorVariables) {
      try {
        const resolvedValue = variable.resolveForConsumer();
        if (resolvedValue && resolvedValue.type === 'SOLID') {
          const varColor = resolvedValue.color;
          
          const rDiff = Math.abs(varColor.r - color.r);
          const gDiff = Math.abs(varColor.g - color.g);
          const bDiff = Math.abs(varColor.b - color.b);
          
          if (rDiff <= tolerance && gDiff <= tolerance && bDiff <= tolerance) {
            return { variable, matchType: 'similar' };
          }
        }
      } catch (error) {
        continue;
      }
    }
    
  } catch (error) {
    console.log('Error finding color variables:', error);
  }
  
  return null;
}

// Apply text style to a text node
function applyTextStyle(textNode, textStyle) {
  try {
    textNode.textStyleId = textStyle.id;
    return true;
  } catch (error) {
    console.log('Error applying text style:', error);
    return false;
  }
}

// Apply color variable to a node
function applyColorVariable(node, variable, propertyPath) {
  try {
    const [property, index] = propertyPath.split('[');
    const arrayIndex = parseInt(index.replace(']', ''));
    
    if (property === 'fills' && node.fills) {
      node.setBoundVariables('fills', { [arrayIndex]: variable.id });
      return true;
    } else if (property === 'strokes' && node.strokes) {
      node.setBoundVariables('strokes', { [arrayIndex]: variable.id });
      return true;
    }
  } catch (error) {
    console.log('Error applying color variable:', error);
  }
  return false;
}

// Main scanning function
async function scanForDetachedElements(nodes) {
  resetResults();
  
  if (!nodes || nodes.length === 0) {
    figma.notify('No nodes selected. Please select frames or components to scan.');
    return;
  }

  console.log('Starting scan with', nodes.length, 'nodes');
  
  // Track node types we find
  const nodeTypes = {};
  
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    console.log(`Processing node ${index + 1}/${nodes.length}:`, node.name, '(', node.type, ')');
    nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
    await traverseNode(node);
  }

  console.log('Node types found:', nodeTypes);
  console.log('Scan complete. Results:', scanResults);
  updateSummary();
  return scanResults;
}

// Reset scan results
function resetResults() {
  scanResults = {
    detachedTextStyles: [],
    detachedVariables: [],
    detachedLayers: [],
    summary: {
      totalDetached: 0,
      textStyles: 0,
      variables: 0,
      layers: 0
    }
  };
  
  // Force refresh of text styles cache to capture any newly connected libraries
  availableTextStylesCache = null;
  textStylesCacheTimestamp = 0;
}

// Traverse through all nodes recursively
async function traverseNode(node) {
  try {
    console.log('Traversing node:', node.name, 'Type:', node.type, 'ID:', node.id);

    // Enhanced text style detection with suggestions
    if (node.type === 'TEXT') {
      console.log('Found TEXT:', node.name, 'Text style ID:', node.textStyleId);
      // Check if text has no style applied
      if (node.textStyleId === '') {
        console.log('Detected text without style:', node.name);
        
        // Find matching text styles
        const textStyleMatches = await findMatchingTextStyles(node);
        
        // Get all available text styles and ensure they're properly formatted
        const allAvailableStyles = textStyleMatches.allStyles.map(style => ({
          id: style.id,
          name: style.name,
          isFromLibrary: style.remote || false,
          libraryName: style.remote ? (style.description || 'Connected Library') : null,
          fontFamily: style.fontName ? style.fontName.family : '',
          fontStyle: style.fontName ? style.fontName.style : '',
          fontSize: style.fontSize || 0
        }));
        
        const textStyleData = {
          id: node.id,
          name: node.name,
          type: 'TEXT_NO_STYLE',
          path: getNodePath(node),
          characters: node.characters.substring(0, 50) + (node.characters.length > 50 ? '...' : ''),
          description: 'Text without applied text style',
          fontName: node.fontName,
          fontSize: node.fontSize,
          lineHeight: node.lineHeight,
          letterSpacing: node.letterSpacing,
          // Include ALL available text styles in the dropdown, not just matches
          availableTextStyles: allAvailableStyles
        };
        
        if (textStyleMatches.matches.length > 0) {
          const bestMatch = textStyleMatches.matches[0];
          textStyleData.suggestedTextStyle = bestMatch.style.name;
          textStyleData.suggestedTextStyleId = bestMatch.style.id;
          textStyleData.matchType = bestMatch.matchType;
          textStyleData.isFromLibrary = bestMatch.isFromLibrary;
          textStyleData.libraryName = bestMatch.libraryName;
          textStyleData.textStyleMatches = textStyleMatches.matches;
          
          let libraryIndicator = '';
          if (bestMatch.isFromLibrary) {
            libraryIndicator = ` (Library: ${bestMatch.libraryName || 'Connected Library'})`;
          }
          
          textStyleData.description = `Text without text style`;
        }
        
        scanResults.detachedTextStyles.push(textStyleData);
      }
      
      // Check for mixed text styles (partial styling)
      if (node.textStyleId !== '' && node.characters) {
        const style = figma.getStyleById(node.textStyleId);
        
        if (style && style.type === 'TEXT') {
          // For now, let's disable the text override detection since it's causing false positives
          // We'll focus on detecting text without styles instead
          
          // TODO: Implement proper text override detection
          // The current approach seems to have issues with Figma's text style system
        }
      }
    }

    // Enhanced variable detection with suggestions
    if (node.type === 'RECTANGLE' || node.type === 'ELLIPSE' || node.type === 'POLYGON' || 
        node.type === 'STAR' || node.type === 'FRAME' || node.type === 'GROUP' || 
        node.type === 'COMPONENT' || node.type === 'INSTANCE' || node.type === 'TEXT' || 
        node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION' || node.type === 'LINE') {
      console.log('Checking variables for:', node.name, 'Type:', node.type);
      
      // Check fills
      if (node.fills && Array.isArray(node.fills)) {
        console.log('Checking fills for node:', node.name, 'Fills:', node.fills);
        node.fills.forEach((fill, index) => {
          if (fill.type === 'SOLID' && fill.color) {
            // Check if this fill is already using a variable
            const isUsingVariable = node.boundVariables && 
                                   node.boundVariables.fills && 
                                   node.boundVariables.fills[index];
            
            if (!isUsingVariable) {
              // Create color string with proper hex formatting
              const r = Math.round(fill.color.r * 255);
              const g = Math.round(fill.color.g * 255);
              const b = Math.round(fill.color.b * 255);
              const colorString = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
              
              // Find matching color variable
              const colorMatch = findMatchingColorVariable(fill.color);
              
              const variableData = {
                id: node.id,
                name: node.name,
                type: 'COLOR_FILL',
                path: getNodePath(node),
                value: colorString,
                color: fill.color,
                opacity: fill.opacity !== undefined ? fill.opacity : (fill.color.a !== undefined ? fill.color.a : 1),
                property: `fills[${index}]`,
                description: 'Solid color fill that could be a variable'
              };
              
              console.log('Created fill color data:', variableData);
              
              if (colorMatch) {
                variableData.suggestedVariable = colorMatch.variable.name;
                variableData.suggestedVariableId = colorMatch.variable.id;
                variableData.matchType = colorMatch.matchType;
                variableData.description = `Solid color fill that could use variable "${colorMatch.variable.name}" (${colorMatch.matchType} match)`;
              }
              
              scanResults.detachedVariables.push(variableData);
            }
          }
        });
      }

      // Check strokes
      if (node.strokes && Array.isArray(node.strokes)) {
        console.log('Checking strokes for node:', node.name, 'Strokes:', node.strokes);
        node.strokes.forEach((stroke, index) => {
          if (stroke.type === 'SOLID' && stroke.color) {
            // Check if this stroke is already using a variable
            const isUsingVariable = node.boundVariables && 
                                   node.boundVariables.strokes && 
                                   node.boundVariables.strokes[index];
            
            if (!isUsingVariable) {
              // Create color string with proper hex formatting
              const r = Math.round(stroke.color.r * 255);
              const g = Math.round(stroke.color.g * 255);
              const b = Math.round(stroke.color.b * 255);
              const colorString = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
              
              // Find matching color variable
              const colorMatch = findMatchingColorVariable(stroke.color);
              
              const variableData = {
                id: node.id,
                name: node.name,
                type: 'COLOR_STROKE',
                path: getNodePath(node),
                value: colorString,
                color: stroke.color,
                opacity: stroke.opacity !== undefined ? stroke.opacity : (stroke.color.a !== undefined ? stroke.color.a : 1),
                property: `strokes[${index}]`,
                description: 'Solid color stroke that could be a variable'
              };
              
              console.log('Created stroke color data:', variableData);
              
              if (colorMatch) {
                variableData.suggestedVariable = colorMatch.variable.name;
                variableData.suggestedVariableId = colorMatch.variable.id;
                variableData.matchType = colorMatch.matchType;
                variableData.description = `Solid color stroke that could use variable "${colorMatch.variable.name}" (${colorMatch.matchType} match)`;
              }
              
              scanResults.detachedVariables.push(variableData);
            }
          }
        });
      }

      // Check effects (shadows, blurs)
      if (node.effects && Array.isArray(node.effects)) {
        node.effects.forEach((effect, index) => {
          if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
            // Check if this effect is already using a variable
            const isUsingVariable = node.boundVariables && 
                                   node.boundVariables.effects && 
                                   node.boundVariables.effects[index];
            
            if (!isUsingVariable) {
              scanResults.detachedVariables.push({
                id: node.id,
                name: node.name,
                type: 'EFFECT',
                path: getNodePath(node),
                value: `${effect.type}: ${effect.radius}px`,
                property: `effect[${index}]`,
                description: 'Effect that could be a variable'
              });
            }
          }
        });
      }
    }

    // Check for layers that might be detached (custom shapes, etc.)
    // Only flag elements that are NOT inside components
    if (node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION' || node.type === 'LINE') {
      console.log('Found custom shape:', node.name, 'Type:', node.type, 'Is inside component:', isInsideComponent(node));
      if (!isInsideComponent(node) && couldBeComponent(node)) {
        console.log('Detected custom shape outside component:', node.name);
        scanResults.detachedLayers.push({
          id: node.id,
          name: node.name,
          type: node.type,
          path: getNodePath(node),
          description: 'Custom shape that could be a component'
        });
      }
    }

    // Check for images and other media that aren't inside components
    if (node.type === 'RECTANGLE' && node.fills && node.fills.length > 0) {
      const hasImageFill = node.fills.some(fill => fill.type === 'IMAGE');
      if (hasImageFill && !isInsideComponent(node) && couldBeComponent(node)) {
        // Only add if not already in another category
        const isInVariables = scanResults.detachedVariables.some(item => item.id === node.id);
        const isInLayers = scanResults.detachedLayers.some(item => item.id === node.id);
        
        if (!isInVariables && !isInLayers) {
          scanResults.detachedLayers.push({
            id: node.id,
            name: node.name,
            type: 'IMAGE',
            path: getNodePath(node),
            description: 'Image that could be part of a component'
          });
        }
      }
    }

    // Check for other layer types that aren't inside components
    if (node.type === 'RECTANGLE' || node.type === 'ELLIPSE' || node.type === 'POLYGON' || 
        node.type === 'STAR' || node.type === 'TEXT') {
      if (!isInsideComponent(node) && couldBeComponent(node)) {
        // Only add if it's not already in another category
        const isInTextStyles = scanResults.detachedTextStyles.some(item => item.id === node.id);
        const isInVariables = scanResults.detachedVariables.some(item => item.id === node.id);
        const isInLayers = scanResults.detachedLayers.some(item => item.id === node.id);
        
        if (!isInTextStyles && !isInVariables && !isInLayers) {
          let description = `${node.type} that could be organized into a component`;
          
          // Provide more specific descriptions based on layer type
          if (node.type === 'RECTANGLE') {
            description = 'Rectangle that could be converted to a component';
          } else if (node.type === 'ELLIPSE') {
            description = 'Ellipse that could be converted to a component';
          } else if (node.type === 'TEXT') {
            description = 'Text element that could be part of a component';
          } else if (node.type === 'POLYGON' || node.type === 'STAR') {
            description = 'Shape that could be converted to a component';
          }
          
          scanResults.detachedLayers.push({
            id: node.id,
            name: node.name,
            type: node.type,
            path: getNodePath(node),
            description: description
          });
        }
      }
    }

    // Check for groups that might need attention
    // Only flag groups that are NOT inside components
    if (node.type === 'GROUP' && node.children.length > 0) {
      console.log('Found GROUP:', node.name, 'Children count:', node.children.length, 'Is inside component:', isInsideComponent(node));
      if (!isInsideComponent(node)) {
        const hasComponents = node.children.some(child => child.type === 'INSTANCE');
        const hasCustomShapes = node.children.some(child => 
          child.type === 'VECTOR' || child.type === 'BOOLEAN_OPERATION'
        );
        
        console.log('Group analysis:', node.name, 'Has components:', hasComponents, 'Has custom shapes:', hasCustomShapes);
        
        if (hasComponents || hasCustomShapes) {
          console.log('Detected group with components/shapes:', node.name);
          scanResults.detachedLayers.push({
            id: node.id,
            name: node.name,
            type: 'GROUP',
            path: getNodePath(node),
            description: 'Group containing components or custom shapes'
          });
        }
      }
    }

    // Recursively check children
    console.log('Checking children for node:', node.name, 'Type:', node.type, 'Has children property:', 'children' in node);
    if ('children' in node && node.children && node.children.length > 0) {
      console.log('Node', node.name, 'has', node.children.length, 'children, traversing...');
      for (let index = 0; index < node.children.length; index++) {
        const child = node.children[index];
        console.log(`  Traversing child ${index + 1}/${node.children.length}:`, child.name, '(', child.type, ')');
        await traverseNode(child);
      }
    } else {
      console.log('Node', node.name, 'has no children or children property. Children:', node.children);
    }
  } catch (error) {
    console.error(`Error processing node ${node.name}:`, error);
  }
}

// Get the path to a node for better identification
function getNodePath(node) {
  const path = [];
  let current = node;
  
  while (current && current.parent) {
    if (current.parent.type === 'PAGE') {
      path.unshift(current.parent.name);
      break;
    }
    path.unshift(current.name);
    current = current.parent;
  }
  
  return path.join(' > ');
}

// Check if a node is inside a component (either a COMPONENT or INSTANCE)
function isInsideComponent(node) {
  let current = node.parent;
  let depth = 0;
  
  while (current && depth < 10) { // Limit depth to prevent infinite loops
    if (current.type === 'COMPONENT' || current.type === 'INSTANCE') {
      console.log('Node', node.name, 'is inside component:', current.name, 'at depth', depth);
      return true;
    }
    current = current.parent;
    depth++;
  }
  
  console.log('Node', node.name, 'is NOT inside any component');
  return false;
}

// Check if a node could be part of a component based on its properties
function couldBeComponent(node) {
  // Check if node has children (could be a container)
  if ('children' in node && node.children && node.children.length > 0) {
    return true;
  }
  
  // Check if node has specific properties that suggest it's a UI element
  if (node.type === 'RECTANGLE' || node.type === 'FRAME' || node.type === 'GROUP') {
    return true;
  }
  
  // Check if node has text content
  if (node.type === 'TEXT' && node.characters && node.characters.trim().length > 0) {
    return true;
  }
  
  // Check if node has fills or strokes (visual elements)
  if ((node.fills && node.fills.length > 0) || (node.strokes && node.strokes.length > 0)) {
    return true;
  }
  
  return false;
}

// Update summary counts
function updateSummary() {
  scanResults.summary.textStyles = scanResults.detachedTextStyles.length;
  scanResults.summary.variables = scanResults.detachedVariables.length;
  scanResults.summary.layers = scanResults.detachedLayers.length;
  scanResults.summary.totalDetached = 
    scanResults.summary.textStyles + 
    scanResults.summary.variables + 
    scanResults.summary.layers;
}

// Refresh current scan to update results after fixes
async function refreshCurrentScan() {
  console.log('Refreshing current scan scope:', currentScanScope);
  
  try {
    let results;
    
    switch (currentScanScope) {
      case 'selection':
        const selection = figma.currentPage.selection;
        if (selection.length === 0) {
          figma.ui.postMessage({ type: 'no-selection' });
          return;
        }
        results = await scanForDetachedElements(selection);
        break;
        
      case 'page':
        const pageNodes = figma.currentPage.children;
        results = await scanForDetachedElements(pageNodes);
        break;
        
      case 'file':
        const allPages = figma.root.children;
        let allNodes = [];
        allPages.forEach(page => {
          allNodes = allNodes.concat(page.children);
        });
        results = await scanForDetachedElements(allNodes);
        break;
        
      default:
        console.log('Unknown scan scope:', currentScanScope);
        return;
    }
    
    figma.ui.postMessage({ type: 'scan-results', results });
  } catch (error) {
    console.error('Error refreshing scan:', error);
    figma.notify('Error refreshing scan results');
  }
}

// Handle messages from UI
figma.ui.onmessage = async (msg) => {
  console.log('Received message:', msg.type);
  
  if (msg.type === 'scan-selection') {
    console.log('Scanning selection...');
    const selection = figma.currentPage.selection;
    console.log('Selection count:', selection.length);
    
    // Update current scan scope
    currentScanScope = 'selection';
    
    // Check if nothing is selected
    if (selection.length === 0) {
      figma.ui.postMessage({ type: 'no-selection' });
      return;
    }
    
    const results = await scanForDetachedElements(selection);
    figma.ui.postMessage({ type: 'scan-results', results });
  }
  
  else if (msg.type === 'scan-page') {
    console.log('Scanning page...');
    const pageNodes = figma.currentPage.children;
    console.log('Page nodes count:', pageNodes.length);
    
    // Update current scan scope
    currentScanScope = 'page';
    
    const results = await scanForDetachedElements(pageNodes);
    figma.ui.postMessage({ type: 'scan-results', results });
  }
  
  else if (msg.type === 'scan-file') {
    console.log('Scanning file...');
    const allPages = figma.root.children;
    let allNodes = [];
    
    allPages.forEach(page => {
      allNodes = allNodes.concat(page.children);
    });
    
    console.log('Total nodes count:', allNodes.length);
    
    // Update current scan scope
    currentScanScope = 'file';
    
    const results = await scanForDetachedElements(allNodes);
    figma.ui.postMessage({ type: 'scan-results', results });
  }
  
  else if (msg.type === 'select-node') {
    try {
      const node = figma.getNodeById(msg.nodeId);
      if (node) {
        figma.currentPage.selection = [node];
        figma.viewport.scrollAndZoomIntoView([node]);
        figma.notify(`Selected: ${node.name}`);
      }
    } catch (error) {
      figma.notify('Could not select node');
    }
  }
  
  else if (msg.type === 'apply-text-style') {
    try {
      const node = figma.getNodeById(msg.nodeId);
      const textStyle = figma.getStyleById(msg.textStyleId);
      
      if (node && textStyle && node.type === 'TEXT') {
        const success = applyTextStyle(node, textStyle);
        if (success) {
          const styleSource = textStyle.remote ? ' (from connected library)' : '';
          figma.notify(`Applied text style "${textStyle.name}"${styleSource} to "${node.name}"`);
          // Refresh the scan results using the current scan scope
          await refreshCurrentScan();
        } else {
          figma.notify('Failed to apply text style');
        }
      }
    } catch (error) {
      figma.notify('Error applying text style');
    }
  }
  
  else if (msg.type === 'apply-color-variable') {
    try {
      const node = figma.getNodeById(msg.nodeId);
      const variable = figma.variables.getVariableById(msg.variableId);
      
      if (node && variable) {
        const success = applyColorVariable(node, variable, msg.propertyPath);
        if (success) {
          figma.notify(`Applied color variable "${variable.name}" to "${node.name}"`);
          // Refresh the scan results using the current scan scope
          await refreshCurrentScan();
        } else {
          figma.notify('Failed to apply color variable');
        }
      }
    } catch (error) {
      figma.notify('Error applying color variable');
    }
  }
  
  else if (msg.type === 'resize-window') {
    try {
      // Resize the plugin window
      figma.ui.resize(msg.width, msg.height);
    } catch (error) {
      console.error('Error resizing window:', error);
    }
  }
  
  else if (msg.type === 'export-results') {
    try {
      // Create a simple export of results
      const exportData = {
        timestamp: new Date().toISOString(),
        pageName: figma.currentPage.name,
        results: msg.results
      };
      
      // In a real implementation, you might want to save this to a file
      // For now, we'll just notify the user
      figma.notify('Export functionality would save results to a file');
      console.log('Export data:', exportData);
    } catch (error) {
      figma.notify('Export failed');
    }
  }
  
  else if (msg.type === 'fix-all-issues') {
    try {
      // In a real implementation, this would attempt to fix the issues
      // For now, we'll just notify the user
      figma.notify('Fix All functionality would attempt to resolve detached elements');
      console.log('Fix all issues:', msg.results);
    } catch (error) {
      figma.notify('Fix All failed');
    }
  }
  
  else if (msg.type === 'close') {
    figma.closePlugin();
  }
};

// Send initial data to UI
figma.ui.postMessage({ 
  type: 'init', 
  selectionCount: figma.currentPage.selection.length,
  pageName: figma.currentPage.name
}); 