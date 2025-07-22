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

// Get all available text styles with caching
let availableTextStylesCache = null;
let textStylesCacheTimestamp = 0;
const CACHE_DURATION = 30000; // 30 seconds

function getAvailableTextStyles() {
  const now = Date.now();
  
  // Return cached text styles if still valid
  if (availableTextStylesCache && (now - textStylesCacheTimestamp) < CACHE_DURATION) {
    return availableTextStylesCache;
  }
  
  console.log('Refreshing text styles cache...');
  
  let allTextStyles = [];
  
  try {
    // Get local text styles
    const localTextStyles = figma.getLocalTextStyles();
    console.log('Local text styles found:', localTextStyles.length);
    allTextStyles = allTextStyles.concat(localTextStyles);
    
    // Get remote text styles from libraries
    try {
      const remoteTextStyles = figma.getLocalTextStyles();
      allTextStyles = allTextStyles.concat(remoteTextStyles);
    } catch (error) {
      console.log('Error getting remote text styles:', error);
    }
    
  } catch (error) {
    console.log('Error getting text styles:', error);
  }
  
  // Cache the results
  availableTextStylesCache = allTextStyles;
  textStylesCacheTimestamp = now;
  
  console.log('Total available text styles:', allTextStyles.length);
  return allTextStyles;
}

// Find matching text style based on font properties
function findMatchingTextStyle(textNode) {
  const textStyles = getAvailableTextStyles();
  
  if (!textNode.fontName || !textNode.fontSize) {
    return null;
  }
  
  const nodeFontName = textNode.fontName;
  const nodeFontSize = textNode.fontSize;
  const nodeLineHeight = textNode.lineHeight;
  const nodeLetterSpacing = textNode.letterSpacing;
  
  // Try exact match first
  let match = textStyles.find(style => {
    try {
      const styleFontName = style.fontName;
      const styleFontSize = style.fontSize;
      const styleLineHeight = style.lineHeight;
      const styleLetterSpacing = style.letterSpacing;
      
      return styleFontName.family === nodeFontName.family &&
             styleFontName.style === nodeFontName.style &&
             styleFontSize === nodeFontSize &&
             (styleLineHeight === nodeLineHeight || 
              (styleLineHeight && nodeLineHeight && 
               Math.abs(styleLineHeight.value - nodeLineHeight.value) < 0.1)) &&
             (styleLetterSpacing === nodeLetterSpacing ||
              (styleLetterSpacing && nodeLetterSpacing &&
               Math.abs(styleLetterSpacing.value - nodeLetterSpacing.value) < 0.1));
    } catch (error) {
      return false;
    }
  });
  
  if (match) {
    return { style: match, matchType: 'exact' };
  }
  
  // Try partial match (same font family and size)
  match = textStyles.find(style => {
    try {
      const styleFontName = style.fontName;
      const styleFontSize = style.fontSize;
      
      return styleFontName.family === nodeFontName.family &&
             styleFontName.style === nodeFontName.style &&
             styleFontSize === nodeFontSize;
    } catch (error) {
      return false;
    }
  });
  
  if (match) {
    return { style: match, matchType: 'partial' };
  }
  
  // Try fuzzy match (same font family)
  match = textStyles.find(style => {
    try {
      const styleFontName = style.fontName;
      return styleFontName.family === nodeFontName.family;
    } catch (error) {
      return false;
    }
  });
  
  if (match) {
    return { style: match, matchType: 'fuzzy' };
  }
  
  return null;
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
function scanForDetachedElements(nodes) {
  resetResults();
  
  if (!nodes || nodes.length === 0) {
    figma.notify('No nodes selected. Please select frames or components to scan.');
    return;
  }

  console.log('Starting scan with', nodes.length, 'nodes');
  
  // Track node types we find
  const nodeTypes = {};
  
  nodes.forEach((node, index) => {
    console.log(`Processing node ${index + 1}/${nodes.length}:`, node.name, '(', node.type, ')');
    nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
    traverseNode(node);
  });

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
}

// Traverse through all nodes recursively
function traverseNode(node) {
  try {
    console.log('Traversing node:', node.name, 'Type:', node.type, 'ID:', node.id);

    // Enhanced text style detection with suggestions
    if (node.type === 'TEXT') {
      console.log('Found TEXT:', node.name, 'Text style ID:', node.textStyleId);
      // Check if text has no style applied
      if (node.textStyleId === '') {
        console.log('Detected text without style:', node.name);
        
        // Find matching text style
        const textStyleMatch = findMatchingTextStyle(node);
        
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
          letterSpacing: node.letterSpacing
        };
        
        if (textStyleMatch) {
          textStyleData.suggestedTextStyle = textStyleMatch.style.name;
          textStyleData.suggestedTextStyleId = textStyleMatch.style.id;
          textStyleData.matchType = textStyleMatch.matchType;
          textStyleData.description = `Text without applied text style • Matches "${textStyleMatch.style.name}" (${textStyleMatch.matchType} match)`;
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
      node.children.forEach((child, index) => {
        console.log(`  Traversing child ${index + 1}/${node.children.length}:`, child.name, '(', child.type, ')');
        traverseNode(child);
      });
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

// Handle messages from UI
figma.ui.onmessage = async (msg) => {
  console.log('Received message:', msg.type);
  
  if (msg.type === 'scan-selection') {
    console.log('Scanning selection...');
    const selection = figma.currentPage.selection;
    console.log('Selection count:', selection.length);
    
    // Check if nothing is selected
    if (selection.length === 0) {
      figma.ui.postMessage({ type: 'no-selection' });
      return;
    }
    
    const results = scanForDetachedElements(selection);
    figma.ui.postMessage({ type: 'scan-results', results });
  }
  
  else if (msg.type === 'scan-page') {
    console.log('Scanning page...');
    const pageNodes = figma.currentPage.children;
    console.log('Page nodes count:', pageNodes.length);
    const results = scanForDetachedElements(pageNodes);
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
    const results = scanForDetachedElements(allNodes);
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
          figma.notify(`Applied text style "${textStyle.name}" to "${node.name}"`);
          // Refresh the scan results
          const selection = figma.currentPage.selection;
          const results = scanForDetachedElements(selection);
          figma.ui.postMessage({ type: 'scan-results', results });
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
          // Refresh the scan results
          const selection = figma.currentPage.selection;
          const results = scanForDetachedElements(selection);
          figma.ui.postMessage({ type: 'scan-results', results });
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