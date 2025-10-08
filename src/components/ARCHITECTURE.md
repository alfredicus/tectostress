# Enhanced Visualization System Guide

## Overview

The new parameterized visualization system provides a flexible, reusable framework for integrating visualizations into any component of the Tectostress application. The system eliminates the need for the separate "Analyse" tab by integrating visualizations directly into relevant components.

## Key Features

### 🎯 **Context-Aware Visualizations**
- Different components show only relevant visualization types
- Data analysis components show geological visualizations (rose diagrams, stereonets)
- Stress analysis components show stress-specific visualizations (Mohr circles, results)
- General components show basic charts and tables

### 🔧 **Parameterized System**
- Easy to add new visualization types
- Simple to create custom contexts for specific workflows
- Reusable across different components

### 📊 **Integrated Workflow**
- Visualizations appear directly below data tables
- No need to switch tabs
- Results from computations automatically enhance available visualizations

## System Architecture

### Core Components

1. **VisualizationTypeRegistry** - Central registry for all visualization types
2. **VisualizationEnabledComponent** - Wrapper that adds visualization capabilities
3. **Context-Specific Hooks** - Specialized hooks for different use cases
4. **Migration Utilities** - Tools to help upgrade existing components

### Visualization Contexts

```typescript
enum VisualizationContext {
    DATA_ANALYSIS = 'data_analysis',      // Rose diagrams, histograms, stereonets
    RUN_ANALYSIS = 'run_analysis',   // Mohr circles, results, solutions
    CUSTOM = 'custom'                      // User-defined contexts
}
```

## Usage Examples

### 1. Basic Data Component with Visualizations

```typescript
import { DataAnalysisComponent, VisualizationContext } from './VisualizationTypeRegistry';

const MyDataComponent = ({ files, onFileLoaded, onFileRemoved }) => {
    return (
        <DataAnalysisComponent
            files={files}
            containerWidth={1200}
            gridCols={12}
            rowHeight={120}
        >
            {/* Your existing data component content */}
            <DataUploader onFileLoaded={onFileLoaded} />
            <DataTable files={files} onFileRemoved={onFileRemoved} />
        </DataAnalysisComponent>
    );
};
```

### 2. Custom Component with Specific Visualizations

```typescript
import { useParameterizedVisualizationManager, VisualizationContext } from './VisualizationTypeRegistry';

const CustomAnalysisComponent = ({ files }) => {
    const {
        visualizations,
        isDialogOpen,
        openAddDialog,
        closeAddDialog,
        createVisualization,
        // ... other methods
    } = useParameterizedVisualizationManager({
        files,
        context: VisualizationContext.RUN_ANALYSIS
    });

    return (
        <div>
            {/* Your component content */}
            <button onClick={() => openAddDialog()}>
                Add Stress Visualization
            </button>
            
            {/* Visualizations will appear here */}
            <VisualizationGrid visualizations={visualizations} files={files} />
        </div>
    );
};
```

### 3. Creating Custom Visualization Contexts

```typescript
import { VisualizationRegistry, VisualizationMigrationHelper } from './VisualizationTypeRegistry';

// Method 1: Register completely custom types
const myCustomTypes = [
    {
        id: 'special_analysis',
        title: 'Special Analysis',
        icon: MyCustomIcon,
        defaultLayout: { w: 6, h: 4 }
    }
];

VisualizationRegistry.registerCustomContext('my_workflow', myCustomTypes);

// Method 2: Combine existing contexts
VisualizationMigrationHelper.createCombinedContext(
    'comprehensive_geology',
    [VisualizationContext.DATA_ANALYSIS, VisualizationContext.RUN_ANALYSIS]
);

// Method 3: Extend existing contexts
VisualizationRegistry.extendContext(
    VisualizationContext.DATA_ANALYSIS,
    [{ id: 'new_type', title: 'New Type', icon: NewIcon, defaultLayout: { w: 4, h: 3 } }]
);
```

## Component-Specific Implementation

### DataComponent Enhancement

The `DataComponent` now includes:
- Integrated file upload and management
- Direct "Add View" buttons on each file
- Visualization grid below data tables
- Context-aware visualization types (DATA_ANALYSIS)

### RunComponent Enhancement

The `RunComponent` now includes:
- Stress inversion execution
- Automatic results visualization integration
- Enhanced files with solution data
- Context-aware visualizations (RUN_ANALYSIS)

### MainInterface Simplification

The `MainInterface` now:
- Only has 'data', 'run', and 'documentation' tabs
- No separate 'analyze' tab needed
- Each tab has integrated visualization capabilities
- Shows system status and available contexts

## Best Practices

### 1. Choose the Right Context
```typescript
// For geological data analysis
useDataVisualizationManager(props)

// For stress inversion results
useStressVisualizationManager(props)

// For general purpose charts
useGeneralVisualizationManager(props)

// For custom workflows
useParameterizedVisualizationManager({ context: 'my_custom_context', ...props })
```

### 2. Organize Custom Contexts
```typescript
// Group related visualizations
const FRACTURE_ANALYSIS = [
    ...DATA_ANALYSIS_VISUALIZATIONS,
    { id: 'fracture_density', title: 'Fracture Density', icon: FractureIcon, defaultLayout: { w: 6, h: 4 } }
];

VisualizationRegistry.registerCustomContext('fracture_analysis', FRACTURE_ANALYSIS);
```

### 3. Extend Rather Than Replace
```typescript
// Good: Extend existing context
VisualizationRegistry.extendContext(VisualizationContext.DATA_ANALYSIS, newTypes);

// Avoid: Creating completely separate contexts for minor additions
```

### 4. Use Appropriate Grid Settings
```typescript
// For data exploration (many small visualizations)
<DataAnalysisComponent gridCols={12} rowHeight={100} />

// For result presentation (fewer, larger visualizations)
<StressAnalysisComponent gridCols={8} rowHeight={150} />
```

## Advanced Features

### Custom Visualization Icons

```typescript
const MyCustomIcon: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
        {/* Your custom SVG content */}
    </svg>
);
```

### Dynamic Context Selection

```typescript
const getContextForWorkflow = (workflowType: string) => {
    switch (workflowType) {
        case 'structural_analysis':
            return VisualizationContext.DATA_ANALYSIS;
        case 'stress_inversion':
            return VisualizationContext.RUN_ANALYSIS;
        default:
            return VisualizationContext.DATA_ANALYSIS;
    }
};
```

### State Management Integration

```typescript
// External state management (optional)
const MyComponent = () => {
    const [externalVisualizations, setExternalVisualizations] = useState([]);
    
    return (
        <VisualizationEnabledComponent
            files={files}
            visualizationContext={VisualizationContext.DATA_ANALYSIS}
            externalVisualizations={externalVisualizations}
            onVisualizationAdded={(viz) => setExternalVisualizations(prev => [...prev, viz])}
            // ... other external handlers
        >
            {/* Component content */}
        </VisualizationEnabledComponent>
    );
};
```

## Troubleshooting

### Common Issues

1. **Visualizations not appearing**: Check that the correct context is being used
2. **Wrong visualization types**: Ensure you're using the appropriate context for your component
3. **State not persisting**: Verify external state management setup if needed
4. **Icons not displaying**: Check that icon components are properly imported

### Debugging

```typescript
// Check available contexts
console.log('Available contexts:', VisualizationRegistry.getAllContexts());

// Check types for a context
console.log('Data analysis types:', VisualizationRegistry.getVisualizationTypes(VisualizationContext.DATA_ANALYSIS));

// Find which contexts contain a specific type
console.log('Contexts with rose diagrams:', VisualizationRegistry.findContextsForType('rose'));
```

## Future Enhancements

The system is designed to be extensible. Future additions might include:

- **Dynamic context loading** from configuration files
- **Plugin system** for third-party visualizations
- **Workflow templates** with pre-configured visualization sets
- **Advanced state management** with persistence layers
- **Collaborative features** for sharing visualization configurations

## Conclusion

This enhanced visualization system provides a robust, flexible foundation for integrating visualizations throughout the Tectostress application. By eliminating the separate "Analyse" tab and providing context-aware visualization types, users get a more streamlined and intuitive experience while developers benefit from a more maintainable and extensible codebase.