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

// Get all available color variables with caching
let availableColorVariablesCache = null;
let colorVariablesCacheTimestamp = 0;
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
    // Add timeout to prevent hanging - increased from 10 to 30 seconds
    const styleDiscoveryPromise = discoverTextStyles(allTextStyles, seenStyleIds);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Text style discovery timeout')), 30000) // 30 second timeout
    );
    
    await Promise.race([styleDiscoveryPromise, timeoutPromise]);
    
  } catch (error) {
    console.log('Error getting text styles (using fallback):', error);
    // Fallback to just local styles
    try {
      const localTextStyles = figma.getLocalTextStyles();
      localTextStyles.forEach(style => {
        if (!seenStyleIds.has(style.id)) {
          allTextStyles.push(style);
          seenStyleIds.add(style.id);
        }
      });
    } catch (fallbackError) {
      console.log('Even fallback failed:', fallbackError);
    }
  }
  
  // Sort text styles: local first, then remote, alphabetically within each group
  allTextStyles.sort((a, b) => {
    if (a.remote !== b.remote) {
      return a.remote ? 1 : -1; // Local styles first
    }
    return a.name.localeCompare(b.name);
  });
  
  // Cache the results
  availableTextStylesCache = allTextStyles;
  textStylesCacheTimestamp = now;
  
  console.log('=== TEXT STYLE DISCOVERY SUMMARY ===');
  console.log('Total available text styles:', allTextStyles.length);
  console.log('Local text styles:', allTextStyles.filter(s => !s.remote).length);
  console.log('Remote/Library text styles:', allTextStyles.filter(s => s.remote).length);
  
  return allTextStyles;
}

// Separate function for text style discovery with simplified logic
async function discoverTextStyles(allTextStyles, seenStyleIds) {
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
  
  // Method 1: Traverse document for currently used styles (simplified)
  const traverseForStyles = (node) => {
    if (node.type === 'TEXT' && node.textStyleId) {
      try {
        const style = figma.getStyleById(node.textStyleId);
        if (style && style.type === 'TEXT' && style.id && !seenStyleIds.has(style.id)) {
          allTextStyles.push(style);
          seenStyleIds.add(style.id);
          console.log('Found used text style:', style.name, style.remote ? '(Library)' : '(Local)');
        }
      } catch (error) {
        // Style might not be available or has been detached, skip it
        console.log('Could not access text style:', node.textStyleId, error.message);
      }
    }
    
    if ('children' in node && node.children) {
      node.children.forEach(traverseForStyles);
    }
  };
  
  // Traverse all pages (this also helps find styles used in non-visible pages)
  figma.root.children.forEach(page => {
    try {
      page.children.forEach(traverseForStyles);
    } catch (error) {
      console.log('Error traversing page:', page.name, error);
    }
  });
  
  // Simplified library detection - only check existing instances, don't import
  try {
    const allInstances = figma.root.findAll(node => node.type === 'INSTANCE');
    console.log('Checking', allInstances.length, 'component instances for library styles...');
    
    // Limit to prevent hanging on large files - increased limit but still capped
    const instancesToCheck = allInstances.slice(0, 100); // Only check first 100 instances
    
    for (const instance of instancesToCheck) {
      try {
        if (instance.mainComponent && instance.mainComponent.remote) {
          // Just traverse the instance as-is to find currently used text styles
          // Do NOT import or reset - just check what's already there
          traverseForStyles(instance);
        }
      } catch (error) {
        // Skip this instance
        continue;
      }
    }
  } catch (error) {
    console.log('Error checking instances:', error);
  }
}

// Get all available color variables with caching
async function getAvailableColorVariables() {
  const now = Date.now();
  
  // Return cached color variables if still valid
  if (availableColorVariablesCache && (now - colorVariablesCacheTimestamp) < CACHE_DURATION) {
    return availableColorVariablesCache;
  }
  
  console.log('Refreshing color variables cache...');
  
  let allColorVariables = [];
  const seenVariableIds = new Set();
  
  try {
    // Add timeout to prevent hanging - increased from 5 to 20 seconds
    const variableDiscoveryPromise = discoverColorVariables(allColorVariables, seenVariableIds);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Color variable discovery timeout')), 20000) // 20 second timeout
    );
    
    await Promise.race([variableDiscoveryPromise, timeoutPromise]);
    
  } catch (error) {
    console.log('Error getting color variables (using fallback):', error);
    // Fallback to just local variables
    try {
      const localVariables = figma.variables.getLocalVariables();
      const localColorVariables = localVariables.filter(v => v.resolvedType === 'COLOR');
      
      localColorVariables.forEach(variable => {
        if (!seenVariableIds.has(variable.id)) {
          try {
            const resolvedValue = variable.resolveForConsumer();
            if (resolvedValue && resolvedValue.type === 'SOLID') {
              allColorVariables.push({
                id: variable.id,
                name: variable.name,
                remote: variable.remote,
                resolvedType: variable.resolvedType,
                resolvedColor: resolvedValue.color,
                isLocal: true
              });
              seenVariableIds.add(variable.id);
            }
          } catch (resolveError) {
            console.log('Could not resolve local color variable:', variable.name, resolveError);
          }
        }
      });
    } catch (fallbackError) {
      console.log('Even fallback failed:', fallbackError);
    }
  }
  
  // Sort color variables: local first, then remote, alphabetically within each group
  allColorVariables.sort((a, b) => {
    if (a.remote !== b.remote) {
      return a.remote ? 1 : -1; // Local variables first
    }
    return a.name.localeCompare(b.name);
  });
  
  // Cache the results
  availableColorVariablesCache = allColorVariables;
  colorVariablesCacheTimestamp = now;
  
  console.log('=== COLOR VARIABLE DISCOVERY SUMMARY ===');
  console.log('Total available color variables:', allColorVariables.length);
  console.log('Local color variables:', allColorVariables.filter(v => !v.remote).length);
  console.log('Remote/Library color variables:', allColorVariables.filter(v => v.remote).length);
  
  return allColorVariables;
}

// Separate function for color variable discovery with simplified logic
async function discoverColorVariables(allColorVariables, seenVariableIds) {
  // Get local color variables first
  const localVariables = figma.variables.getLocalVariables();
  const localColorVariables = localVariables.filter(v => v.resolvedType === 'COLOR');
  console.log('Local color variables found:', localColorVariables.length);
  
  localColorVariables.forEach(variable => {
    if (!seenVariableIds.has(variable.id)) {
      try {
        // Resolve the variable to get its color value
        const resolvedValue = variable.resolveForConsumer();
        if (resolvedValue && resolvedValue.type === 'SOLID') {
          allColorVariables.push({
            id: variable.id,
            name: variable.name,
            remote: variable.remote,
            resolvedType: variable.resolvedType,
            resolvedColor: resolvedValue.color,
            isLocal: true
          });
          seenVariableIds.add(variable.id);
        }
      } catch (error) {
        console.log('Could not resolve local color variable:', variable.name, error);
      }
    }
  });
  
  // Try to find library color variables by looking at currently used variables (simplified)
  console.log('Searching for library color variables...');
  
  const traverseForColorVariables = (node) => {
    try {
      // Check fill variables
      if (node.boundVariables && node.boundVariables.fills) {
        Object.values(node.boundVariables.fills).forEach(variableAlias => {
          if (variableAlias && variableAlias.id) {
            try {
              const variable = figma.variables.getVariableById(variableAlias.id);
              if (variable && variable.id && variable.resolvedType === 'COLOR' && !seenVariableIds.has(variable.id)) {
                const resolvedValue = variable.resolveForConsumer();
                if (resolvedValue && resolvedValue.type === 'SOLID' && resolvedValue.color) {
                  allColorVariables.push({
                    id: variable.id,
                    name: variable.name,
                    remote: variable.remote,
                    resolvedType: variable.resolvedType,
                    resolvedColor: resolvedValue.color,
                    isLocal: !variable.remote
                  });
                  seenVariableIds.add(variable.id);
                  console.log('Found color variable from fills:', variable.name, variable.remote ? '(Library)' : '(Local)');
                }
              }
            } catch (error) {
              // Variable might not be available or has been detached
              console.log('Could not access color variable from fills:', variableAlias.id, error.message);
            }
          }
        });
      }
      
      // Check stroke variables
      if (node.boundVariables && node.boundVariables.strokes) {
        Object.values(node.boundVariables.strokes).forEach(variableAlias => {
          if (variableAlias && variableAlias.id) {
            try {
              const variable = figma.variables.getVariableById(variableAlias.id);
              if (variable && variable.resolvedType === 'COLOR' && !seenVariableIds.has(variable.id)) {
                const resolvedValue = variable.resolveForConsumer();
                if (resolvedValue && resolvedValue.type === 'SOLID') {
                  allColorVariables.push({
                    id: variable.id,
                    name: variable.name,
                    remote: variable.remote,
                    resolvedType: variable.resolvedType,
                    resolvedColor: resolvedValue.color,
                    isLocal: !variable.remote
                  });
                  seenVariableIds.add(variable.id);
                  console.log('Found color variable from strokes:', variable.name, variable.remote ? '(Library)' : '(Local)');
                }
              }
            } catch (error) {
              // Variable might not be available
            }
          }
        });
      }
    } catch (error) {
      // Skip this node
    }
    
    if ('children' in node && node.children) {
      node.children.forEach(traverseForColorVariables);
    }
  };
  
  // Traverse all pages to find used color variables (with limits)
  try {
    figma.root.children.forEach(page => {
      try {
        page.children.forEach(traverseForColorVariables);
      } catch (error) {
        console.log('Error traversing page for color variables:', page.name, error);
      }
    });
  } catch (error) {
    console.log('Error traversing pages for color variables:', error);
  }
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

// Find matching color variables based on color properties - returns multiple matches
async function findMatchingColorVariables(color) {
  const colorVariables = await getAvailableColorVariables();
  
  if (!color) {
    return { matches: [], allVariables: colorVariables };
  }
  
  const matches = [];
  
  // Find exact matches first
  colorVariables.forEach(variable => {
    try {
      if (variable.resolvedColor) {
        const varColor = variable.resolvedColor;
        
        // Check for exact RGB match (within 1/255 tolerance for rounding)
        const rDiff = Math.abs(varColor.r - color.r);
        const gDiff = Math.abs(varColor.g - color.g);
        const bDiff = Math.abs(varColor.b - color.b);
        
        if (rDiff < 0.004 && gDiff < 0.004 && bDiff < 0.004) { // ~1/255 tolerance
          matches.push({
            variable: variable,
            matchType: 'exact',
            isFromLibrary: variable.remote || false,
            colorDistance: rDiff + gDiff + bDiff
          });
        }
      }
    } catch (error) {
      // Skip this variable
    }
  });
  
  // If no exact matches, try similar matches (within reasonable tolerance)
  if (matches.length === 0) {
    const tolerance = 0.1; // 10% tolerance
    
    colorVariables.forEach(variable => {
      try {
        if (variable.resolvedColor) {
          const varColor = variable.resolvedColor;
          
          const rDiff = Math.abs(varColor.r - color.r);
          const gDiff = Math.abs(varColor.g - color.g);
          const bDiff = Math.abs(varColor.b - color.b);
          
          if (rDiff <= tolerance && gDiff <= tolerance && bDiff <= tolerance) {
            const distance = rDiff + gDiff + bDiff;
            matches.push({
              variable: variable,
              matchType: 'similar',
              isFromLibrary: variable.remote || false,
              colorDistance: distance
            });
          }
        }
      } catch (error) {
        // Skip this variable
      }
    });
    
    // Sort similar matches by distance (closest first)
    matches.sort((a, b) => a.colorDistance - b.colorDistance);
  }
  
  return { matches, allVariables: colorVariables };
}

// Legacy function for backward compatibility
function findMatchingColorVariable(color) {
  // This function is kept for backward compatibility but now uses the async version
  // In practice, we should use findMatchingColorVariables instead
  try {
    const variables = figma.variables.getLocalVariables();
    const colorVariables = variables.filter(v => v.resolvedType === 'COLOR');
    
    // Try to find exact match
    for (const variable of colorVariables) {
      try {
        const resolvedValue = variable.resolveForConsumer();
        if (resolvedValue && resolvedValue.type === 'SOLID') {
          const varColor = resolvedValue.color;
          
          const rDiff = Math.abs(varColor.r - color.r);
          const gDiff = Math.abs(varColor.g - color.g);
          const bDiff = Math.abs(varColor.b - color.b);
          
          if (rDiff < 0.004 && gDiff < 0.004 && bDiff < 0.004) {
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
    console.log('scanForDetachedElements: No nodes to scan, returning empty results');
    figma.notify('No elements found to scan. This appears to be empty.');
    return {
      detachedTextStyles: [],
      detachedVariables: [],
      detachedLayers: [],
      summary: {
        totalDetached: 0,
        textStyles: 0,
        variables: 0,
        layers: 0,
        isEmpty: true  // Flag to indicate this is an empty scan
      }
    };
  }

  console.log('Starting scan with', nodes.length, 'nodes');
  
  // Warn about large scans
  if (nodes.length > 50) {
    console.log('Warning: Large scan detected with', nodes.length, 'top-level nodes');
    figma.notify('Scanning large number of elements - this may take a while...');
  }
  
  try {
    // Add timeout to prevent hanging - increased to 60 seconds for large files
    const scanPromise = performScan(nodes);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Scan timeout - try scanning smaller sections')), 60000) // 60 second timeout
    );
    
    await Promise.race([scanPromise, timeoutPromise]);
    
  } catch (error) {
    console.error('Scan error:', error);
    let errorMessage = 'Scan failed: ' + error.message;
    
    if (error.message.includes('timeout')) {
      errorMessage = 'Scan timed out. Try scanning smaller sections or individual pages.';
    } else if (error.message.includes('memory')) {
      errorMessage = 'File too large to scan completely. Try scanning individual pages.';
    }
    
    figma.notify(errorMessage);
    figma.ui.postMessage({ type: 'scan-error', error: errorMessage });
    
    // Return empty results to prevent UI from hanging
    return {
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
  }

  console.log('Scan complete. Results:', scanResults);
  updateSummary();
  return scanResults;
}

// Separate function for the actual scanning logic
async function performScan(nodes) {
  // Track node types we find
  const nodeTypes = {};
  
  // Process nodes in batches to prevent hanging
  const batchSize = 10;
  const totalNodes = nodes.length;
  
  for (let i = 0; i < totalNodes; i += batchSize) {
    const batch = nodes.slice(i, Math.min(i + batchSize, totalNodes));
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(totalNodes / batchSize)} (nodes ${i + 1}-${Math.min(i + batchSize, totalNodes)} of ${totalNodes})`);
    
    for (let j = 0; j < batch.length; j++) {
      const node = batch[j];
      const nodeIndex = i + j;
      console.log(`Processing node ${nodeIndex + 1}/${totalNodes}:`, node.name, '(', node.type, ')');
      nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
      
      try {
        await traverseNode(node);
      } catch (error) {
        console.error(`Error processing node ${node.name}:`, error);
        // Continue with next node instead of failing completely
        continue;
      }
    }
    
    // Add a small delay between batches to prevent UI freezing
    if (i + batchSize < totalNodes) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  console.log('Node types found:', nodeTypes);
  console.log('Scan results after traversal:');
  console.log('- Text styles:', scanResults.detachedTextStyles.length);
  console.log('- Variables:', scanResults.detachedVariables.length); 
  console.log('- Layers:', scanResults.detachedLayers.length);
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
  
  // Force refresh of caches to capture any newly connected libraries
  availableTextStylesCache = null;
  textStylesCacheTimestamp = 0;
  availableColorVariablesCache = null;
  colorVariablesCacheTimestamp = 0;
}

// Traverse through all nodes recursively with depth limit
async function traverseNode(node, depth = 0) {
  // Limit recursion depth to prevent stack overflow
  if (depth > 20) {
    console.log('Max depth reached for node:', node.name);
    return;
  }
  
  try {
    console.log('Traversing node:', node.name, 'Type:', node.type, 'ID:', node.id, 'Depth:', depth);

    // Enhanced text style detection with suggestions
    if (node.type === 'TEXT') {
      console.log('Found TEXT:', node.name, 'Text style ID:', node.textStyleId, 'Characters:', node.characters.substring(0, 20));
      // Check if text has no style applied or is using mixed styling
      if (node.textStyleId === '' || node.textStyleId === figma.mixed) {
        console.log('Detected text without style or with mixed styling:', node.name);
        
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
          type: 'TEXT STYLE',
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
        console.log('Checking fills for node:', node.name, 'Fills count:', node.fills.length);
        for (let index = 0; index < node.fills.length; index++) {
          const fill = node.fills[index];
          console.log(`  Fill ${index}:`, fill.type, fill.visible !== false ? 'visible' : 'hidden');
          if (fill.type === 'SOLID' && fill.color && fill.visible !== false) {
            // Check if this fill is already using a variable
            const isUsingVariable = node.boundVariables && 
                                   node.boundVariables.fills && 
                                   node.boundVariables.fills[index];
            
            console.log(`  Fill ${index} using variable:`, !!isUsingVariable);
            if (!isUsingVariable) {
              // Create color string with proper hex formatting
              const r = Math.round(fill.color.r * 255);
              const g = Math.round(fill.color.g * 255);
              const b = Math.round(fill.color.b * 255);
              const colorString = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
              
              // Find matching color variables
              const colorMatches = await findMatchingColorVariables(fill.color);
              
              // Get all available color variables and format them for the dropdown
              const allAvailableVariables = colorMatches.allVariables.map(variable => ({
                id: variable.id,
                name: variable.name,
                isFromLibrary: variable.remote || false,
                resolvedColor: variable.resolvedColor,
                colorString: variable.resolvedColor ? 
                  `#${Math.round(variable.resolvedColor.r * 255).toString(16).padStart(2, '0')}${Math.round(variable.resolvedColor.g * 255).toString(16).padStart(2, '0')}${Math.round(variable.resolvedColor.b * 255).toString(16).padStart(2, '0')}` 
                  : ''
              }));
              
              const variableData = {
                id: node.id,
                name: node.name,
                type: 'FILL COLOR',
                path: getNodePath(node),
                value: colorString,
                color: fill.color,
                opacity: fill.opacity !== undefined ? fill.opacity : (fill.color.a !== undefined ? fill.color.a : 1),
                property: `fills[${index}]`,
                description: 'Solid color fill that could be a variable',
                // Include ALL available color variables in the dropdown
                availableColorVariables: allAvailableVariables
              };
              
              console.log('Created fill color data:', variableData);
              
              if (colorMatches.matches.length > 0) {
                const bestMatch = colorMatches.matches[0];
                variableData.suggestedVariable = bestMatch.variable.name;
                variableData.suggestedVariableId = bestMatch.variable.id;
                variableData.matchType = bestMatch.matchType;
                variableData.isFromLibrary = bestMatch.isFromLibrary;
                variableData.colorMatches = colorMatches.matches;
                
                variableData.description = `Solid color fill that could use variable "${bestMatch.variable.name}" (${bestMatch.matchType} match)`;
              }
              
              scanResults.detachedVariables.push(variableData);
            }
          }
        }
      }

      // Check strokes
      if (node.strokes && Array.isArray(node.strokes)) {
        console.log('Checking strokes for node:', node.name, 'Strokes:', node.strokes);
        for (let index = 0; index < node.strokes.length; index++) {
          const stroke = node.strokes[index];
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
              
              // Find matching color variables
              const colorMatches = await findMatchingColorVariables(stroke.color);
              
              // Get all available color variables and format them for the dropdown
              const allAvailableVariables = colorMatches.allVariables.map(variable => ({
                id: variable.id,
                name: variable.name,
                isFromLibrary: variable.remote || false,
                resolvedColor: variable.resolvedColor,
                colorString: variable.resolvedColor ? 
                  `#${Math.round(variable.resolvedColor.r * 255).toString(16).padStart(2, '0')}${Math.round(variable.resolvedColor.g * 255).toString(16).padStart(2, '0')}${Math.round(variable.resolvedColor.b * 255).toString(16).padStart(2, '0')}` 
                  : ''
              }));
              
              const variableData = {
                id: node.id,
                name: node.name,
                type: 'STROKE COLOR',
                path: getNodePath(node),
                value: colorString,
                color: stroke.color,
                opacity: stroke.opacity !== undefined ? stroke.opacity : (stroke.color.a !== undefined ? stroke.color.a : 1),
                property: `strokes[${index}]`,
                description: 'Solid color stroke that could be a variable',
                // Include ALL available color variables in the dropdown
                availableColorVariables: allAvailableVariables
              };
              
              console.log('Created stroke color data:', variableData);
              
              if (colorMatches.matches.length > 0) {
                const bestMatch = colorMatches.matches[0];
                variableData.suggestedVariable = bestMatch.variable.name;
                variableData.suggestedVariableId = bestMatch.variable.id;
                variableData.matchType = bestMatch.matchType;
                variableData.isFromLibrary = bestMatch.isFromLibrary;
                variableData.colorMatches = colorMatches.matches;
                
                variableData.description = `Solid color stroke that could use variable "${bestMatch.variable.name}" (${bestMatch.matchType} match)`;
              }
              
              scanResults.detachedVariables.push(variableData);
            }
          }
        }
      }

      // Check effects (shadows, blurs)
      if (node.effects && Array.isArray(node.effects)) {
        for (let index = 0; index < node.effects.length; index++) {
          const effect = node.effects[index];
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
        }
      }
    }

    // Check for layers that might be detached (custom shapes, etc.)
    // Only flag elements that are NOT inside components
    if (node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION' || node.type === 'LINE') {
      console.log('Found custom shape:', node.name, 'Type:', node.type, 'Is inside component:', isInsideComponent(node));
      // Be less restrictive - show custom shapes that aren't in components regardless of other criteria
      if (!isInsideComponent(node)) {
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
      
      // Limit children processing for very large groups
      const maxChildren = 100;
      const childrenToProcess = node.children.length > maxChildren ? 
        node.children.slice(0, maxChildren) : node.children;
      
      if (node.children.length > maxChildren) {
        console.log(`Limiting children processing to first ${maxChildren} of ${node.children.length} children for performance`);
      }
      
      for (let index = 0; index < childrenToProcess.length; index++) {
        const child = childrenToProcess[index];
        console.log(`  Traversing child ${index + 1}/${childrenToProcess.length}:`, child.name, '(', child.type, ')');
        await traverseNode(child, depth + 1);
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
    
    figma.ui.postMessage({ type: 'scan-results', results: serializeScanResults(results) });
  } catch (error) {
    console.error('Error refreshing scan:', error);
    figma.notify('Error refreshing scan results');
  }
}

// Handle messages from UI
figma.ui.onmessage = async (msg) => {
  try {
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
      
      try {
        const results = await scanForDetachedElements(selection);
        figma.ui.postMessage({ type: 'scan-results', results: serializeScanResults(results) });
      } catch (error) {
        console.error('Selection scan failed:', error);
        figma.notify('Selection scan failed: ' + error.message);
        figma.ui.postMessage({ type: 'scan-results', results: getEmptyResults() });
      }
    }
    
    else if (msg.type === 'scan-page') {
      console.log('Scanning page...');
      const pageNodes = figma.currentPage.children;
      console.log('Page nodes count:', pageNodes.length);
      console.log('Page node types:', pageNodes.map(n => `${n.name} (${n.type})`));
      
      // Update current scan scope
      currentScanScope = 'page';
      
      try {
        const results = await scanForDetachedElements(pageNodes);
        console.log('Page scan results:', results);
        figma.ui.postMessage({ type: 'scan-results', results: serializeScanResults(results) });
      } catch (error) {
        console.error('Page scan failed:', error);
        figma.notify('Page scan failed: ' + error.message);
        figma.ui.postMessage({ type: 'scan-results', results: getEmptyResults() });
      }
    }
    
    else if (msg.type === 'scan-file') {
      console.log('Scanning file...');
      const allPages = figma.root.children;
      let allNodes = [];
      
      allPages.forEach(page => {
        console.log(`Page: ${page.name} has ${page.children.length} children`);
        allNodes = allNodes.concat(page.children);
      });
      
      console.log('Total nodes count:', allNodes.length);
      console.log('File node types:', allNodes.map(n => `${n.name} (${n.type})`));
      
      // Update current scan scope
      currentScanScope = 'file';
      
      try {
        const results = await scanForDetachedElements(allNodes);
        console.log('File scan results:', results);
        figma.ui.postMessage({ type: 'scan-results', results: serializeScanResults(results) });
      } catch (error) {
        console.error('File scan failed:', error);
        figma.notify('File scan failed: ' + error.message);
        figma.ui.postMessage({ type: 'scan-results', results: getEmptyResults() });
      }
    }
    
    else if (msg.type === 'select-node') {
      try {
        const node = figma.getNodeById(msg.nodeId);
        if (node) {
          // Find which page the node is on
          let targetPage = null;
          let current = node;
          
          // Traverse up the node tree to find the page
          while (current && current.type !== 'PAGE') {
            current = current.parent;
          }
          
          if (current && current.type === 'PAGE') {
            targetPage = current;
          }
          
          // If we found the target page and it's different from current page, navigate to it
          if (targetPage && targetPage.id !== figma.currentPage.id) {
            figma.currentPage = targetPage;
            figma.notify(`Navigated to page: ${targetPage.name}`);
            // Small delay to ensure page navigation completes
            setTimeout(() => {
              try {
                figma.currentPage.selection = [node];
                figma.viewport.scrollAndZoomIntoView([node]);
                figma.notify(`Selected: ${node.name}`);
              } catch (error) {
                figma.notify('Could not select node after navigation');
              }
            }, 100);
          } else {
            // Node is on current page, select it directly
            figma.currentPage.selection = [node];
            figma.viewport.scrollAndZoomIntoView([node]);
            figma.notify(`Selected: ${node.name}`);
          }
        } else {
          figma.notify('Node not found');
        }
      } catch (error) {
        console.error('Error selecting node:', error);
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
            const styleSource = '';
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
    
  } catch (error) {
    console.error('Error handling message:', error);
    figma.notify('An error occurred. Please try again.');
    // Send empty results to prevent UI from hanging
    if (msg.type === 'scan-selection' || msg.type === 'scan-page' || msg.type === 'scan-file') {
      figma.ui.postMessage({ type: 'scan-results', results: getEmptyResults() });
    }
  }
};

// Helper function to get empty results
function getEmptyResults() {
  return {
    detachedTextStyles: [],
    detachedVariables: [],
    detachedLayers: [],
    summary: {
      totalDetached: 0,
      textStyles: 0,
      variables: 0,
      layers: 0,
      isEmpty: false  // Default to false since this is used for errors, not empty pages
    }
  };
}

// Helper function to serialize scan results for postMessage
function serializeScanResults(results) {
  // Handle case where results is undefined/null (e.g., from empty page scan)
  if (!results) {
    console.log('serializeScanResults: results is undefined, returning empty results');
    return getEmptyResults();
  }
  
  // Ensure all required properties exist with defaults
  const safeResults = {
    detachedTextStyles: results.detachedTextStyles || [],
    detachedVariables: results.detachedVariables || [],
    detachedLayers: results.detachedLayers || [],
    summary: results.summary || { totalDetached: 0, textStyles: 0, variables: 0, layers: 0, isEmpty: false }
  };
  
  return {
    detachedTextStyles: safeResults.detachedTextStyles.map(item => serializeTextStyleItem(item)),
    detachedVariables: safeResults.detachedVariables.map(item => serializeVariableItem(item)),
    detachedLayers: safeResults.detachedLayers.map(item => serializeLayerItem(item)),
    summary: safeResults.summary
  };
}

// Serialize text style items to remove non-serializable objects
function serializeTextStyleItem(item) {
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    path: item.path,
    characters: item.characters,
    description: item.description,
    // Convert Figma objects to plain objects
    fontName: item.fontName ? {
      family: item.fontName.family,
      style: item.fontName.style
    } : null,
    fontSize: item.fontSize,
    lineHeight: item.lineHeight ? {
      value: item.lineHeight.value,
      unit: item.lineHeight.unit
    } : null,
    letterSpacing: item.letterSpacing ? {
      value: item.letterSpacing.value,
      unit: item.letterSpacing.unit
    } : null,
    availableTextStyles: item.availableTextStyles || [],
    suggestedTextStyle: item.suggestedTextStyle,
    suggestedTextStyleId: item.suggestedTextStyleId,
    matchType: item.matchType,
    isFromLibrary: item.isFromLibrary,
    libraryName: item.libraryName
  };
}

// Serialize variable items to remove non-serializable objects
function serializeVariableItem(item) {
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    path: item.path,
    value: item.value,
    // Convert color object to plain object
    color: item.color ? {
      r: item.color.r,
      g: item.color.g,
      b: item.color.b,
      a: item.color.a || 1
    } : null,
    opacity: item.opacity,
    property: item.property,
    description: item.description,
    availableColorVariables: item.availableColorVariables || [],
    suggestedVariable: item.suggestedVariable,
    suggestedVariableId: item.suggestedVariableId,
    matchType: item.matchType,
    isFromLibrary: item.isFromLibrary
  };
}

// Serialize layer items to remove non-serializable objects
function serializeLayerItem(item) {
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    path: item.path,
    description: item.description
  };
}

// Helper function to create test results for debugging
function getTestResults() {
  return {
    detachedTextStyles: [
      {
        id: 'test-text-1',
        name: 'Test Text Element',
        type: 'TEXT STYLE',
        path: 'Test Page > Test Frame',
        characters: 'Sample text without style',
        description: 'Text without applied text style',
        availableTextStyles: []
      }
    ],
    detachedVariables: [
      {
        id: 'test-var-1',
        name: 'Test Rectangle',
        type: 'FILL COLOR',
        path: 'Test Page > Test Frame',
        value: '#FF0000',
        color: { r: 1, g: 0, b: 0 },
        opacity: 1,
        property: 'fills[0]',
        description: 'Solid color fill that could be a variable',
        availableColorVariables: []
      }
    ],
    detachedLayers: [
      {
        id: 'test-layer-1',
        name: 'Test Vector',
        type: 'VECTOR',
        path: 'Test Page > Test Frame',
        description: 'Custom shape that could be a component'
      }
    ],
    summary: {
      totalDetached: 3,
      textStyles: 1,
      variables: 1,
      layers: 1
    }
  };
}

// Send initial data to UI
figma.ui.postMessage({ 
  type: 'init', 
  selectionCount: figma.currentPage.selection.length,
  pageName: figma.currentPage.name
}); 