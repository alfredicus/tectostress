# Quick Start - Ajouter une nouvelle visualisation

## 🎯 En 5 étapes simples

### Étape 1 : Créer le composant (comme d'habitude)

```typescript
// MyNewVisuComponent.tsx
import React from 'react';
import { BaseVisualizationProps, TCompState } from './VisualizationStateSystem';

interface MyNewVisuSettings {
  color: string;
  size: number;
  showGrid: boolean;
}

interface MyNewVisuCompState extends TCompState<MyNewVisuSettings> {
  type: 'myNewVisu';
}

const MyNewVisuComponent: React.FC<BaseVisualizationProps<MyNewVisuCompState>> = ({
  files,
  width,
  height,
  state,
  onStateChange
}) => {
  // Votre implémentation ici
  return (
    <div>
      <h3>My New Visualization</h3>
      {/* Votre contenu */}
    </div>
  );
};

export default MyNewVisuComponent;
```

### Étape 2 : Définir les types

```typescript
// Dans VisualizationStateSystem.ts, ajouter :

export interface MyNewVisuSettings {
  color: string;
  size: number;
  showGrid: boolean;
}

export interface MyNewVisuCompState extends TCompState<MyNewVisuSettings> {
  type: 'myNewVisu';
}

// Ajouter au type union :
export type VisualizationCompState = 
  | RoseCompState 
  | HistogramCompState 
  | WulffCompState 
  | MohrCompState 
  | FractureMap2DCompState
  | MyNewVisuCompState; // ← AJOUTER ICI
```

### Étape 3 : Créer le descripteur

```typescript
// MyNewVisuDescriptor.ts
import { VisualizationDescriptor, VisualizationContext } from './VisualizationDescriptor';
import { MyNewVisuSettings, MyNewVisuCompState } from './VisualizationStateSystem';
import MyNewVisuComponent from './MyNewVisuComponent';
import { Sparkles } from 'lucide-react'; // Ou créer une icône custom

export const MyNewVisuDescriptor: VisualizationDescriptor<MyNewVisuSettings, MyNewVisuCompState> = {
  // ========== IDENTIFICATION ==========
  id: 'myNewVisu',
  title: 'My New Visualization',
  description: 'A brief description of what it does',
  
  // ========== CONTEXTES ==========
  // Choisir où cette visualisation apparaît
  contexts: [
    VisualizationContext.DATA_ANALYSIS,
    // VisualizationContext.STRESS_ANALYSIS,
    // VisualizationContext.SHOW_ANALYSIS,
    // VisualizationContext.GENERAL
  ],
  
  // ========== UI ==========
  icon: Sparkles, // Ou votre icône custom
  defaultLayout: { w: 6, h: 4 }, // Largeur et hauteur dans la grille (12 colonnes max)
  
  // ========== STATE & SETTINGS ==========
  stateType: 'myNewVisu',
  
  // Valeurs par défaut pour tous les paramètres
  defaultSettings: {
    color: '#3498db',
    size: 10,
    showGrid: true
  },
  
  // Factory pour créer l'état initial
  createInitialState: (width = 400, height = 400): MyNewVisuCompState => ({
    type: 'myNewVisu',
    open: false,
    settings: {
      color: '#3498db',
      size: 10,
      showGrid: true
    },
    selectedColumn: '',
    plotDimensions: { width, height }
  }),
  
  // ========== COMPOSANT ==========
  component: MyNewVisuComponent,
  
  // ========== METADATA (optionnel mais recommandé) ==========
  version: '1.0.0',
  tags: ['custom', 'analysis', 'experimental'],
  category: 'Custom Visualizations'
};
```

### Étape 4 : Enregistrer

```typescript
// Dans registerAllVisualizations.ts

import { MyNewVisuDescriptor } from './MyNewVisuDescriptor'; // ← IMPORT

export function registerAllVisualizations(): void {
  const registry = getVisualizationRegistry();
  
  console.log('📊 Registering visualizations...');
  
  // Visualisations existantes
  registry.register(RoseDiagramDescriptor);
  registry.register(WulffStereonetDescriptor);
  registry.register(HistogramDescriptor);
  registry.register(MohrCircleDescriptor);
  registry.register(FractureMap2DDescriptor);
  
  // NOUVELLE VISUALISATION
  registry.register(MyNewVisuDescriptor); // ← ENREGISTRER ICI
  
  const stats = registry.getStats();
  console.log(`✓ ${stats.total} visualizations registered`);
}
```

### Étape 5 : Tester !

1. Lancer l'application
2. Aller dans l'onglet où votre visualisation devrait apparaître (selon les `contexts`)
3. Cliquer sur "Add" → Votre visualisation devrait être dans la liste
4. L'ajouter au dashboard
5. Vérifier qu'elle s'affiche correctement

## 🎨 Créer une icône personnalisée

### Option 1 : Utiliser Lucide React

```typescript
import { Sparkles, Map, Target, Activity } from 'lucide-react';

// Dans le descripteur :
icon: Sparkles
```

[Voir toutes les icônes Lucide](https://lucide.dev/icons/)

### Option 2 : Créer une icône SVG custom

```typescript
const MyCustomIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className = ""
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    {/* Votre SVG ici */}
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="M 12 6 L 12 18" stroke="currentColor" strokeWidth="2" />
    <path d="M 6 12 L 18 12" stroke="currentColor" strokeWidth="2" />
  </svg>
);

// Dans le descripteur :
icon: MyCustomIcon
```

## 🎯 Choisir les contextes appropriés

### VisualizationContext.DATA_ANALYSIS

Utilisez ce contexte si votre visualisation :
- Analyse des données géologiques/structurales
- Visualise des distributions (orientations, mesures)
- Est utile pendant l'analyse exploratoire des données

**Exemples** : Rose Diagram, Histogram, Wulff Stereonet

### VisualizationContext.STRESS_ANALYSIS

Utilisez ce contexte si votre visualisation :
- Analyse des résultats d'inversion de contraintes
- Visualise des états de contrainte
- Montre des résultats de calculs mécaniques

**Exemples** : Mohr Circle, Principal Stress Plot

### VisualizationContext.SHOW_ANALYSIS

Utilisez ce contexte si votre visualisation :
- Est orientée présentation/rapport
- Nécessite un rendu de haute qualité
- Est destinée à l'export

**Exemples** : Rose Diagram (style présentation), Fracture Map 2D

### VisualizationContext.GENERAL

Utilisez ce contexte si votre visualisation :
- Est générique et utile partout
- N'est pas spécifique à un workflow
- Peut s'appliquer à n'importe quelles données

**Exemples** : Histogram, Line Chart, Table

### Plusieurs contextes

Une visualisation peut apparaître dans plusieurs contextes :

```typescript
contexts: [
  VisualizationContext.DATA_ANALYSIS,
  VisualizationContext.SHOW_ANALYSIS
]
```

## 📏 Choisir le layout par défaut

Le dashboard utilise une grille de **12 colonnes**.

```typescript
defaultLayout: { w: 6, h: 4 }
//               ^     ^
//               |     hauteur (en unités de 120px)
//               largeur (en colonnes sur 12)
```

**Recommandations** :
- **Petites visualisations** : `{ w: 4, h: 4 }` (Rose Diagram)
- **Moyennes** : `{ w: 6, h: 4 }` (Histogram, Mohr Circle)
- **Grandes** : `{ w: 8, h: 6 }` (Fracture Map, Tables)
- **Pleine largeur** : `{ w: 12, h: 3 }` (Tables, Résumés)

## 🏷️ Utiliser les tags et catégories

### Tags (recherche flexible)

```typescript
tags: ['spatial', 'directional', '3d', 'statistics', 'stress']
```

Les tags permettent :
- Recherche par mot-clé
- Filtrage dynamique
- Groupement logique

**Conseils** :
- Utilisez des mots-clés simples et descriptifs
- Pensez à comment un utilisateur chercherait cette visualisation
- 3-5 tags par visualisation est optimal

### Catégorie (groupement principal)

```typescript
category: 'Structural Geology'
```

Catégories courantes :
- `'Structural Geology'`
- `'Statistics'`
- `'Stress Analysis'`
- `'Spatial Analysis'`
- `'3D Visualization'`
- `'Time Series'`

## ✅ Checklist avant de commit

- [ ] Le composant s'affiche correctement
- [ ] Les settings par défaut fonctionnent
- [ ] L'icône est visible et appropriée
- [ ] Le titre est clair et descriptif
- [ ] La description explique l'objectif
- [ ] Les contextes sont appropriés
- [ ] Le layout par défaut est adapté
- [ ] Les tags sont pertinents
- [ ] La catégorie est correcte
- [ ] L'enregistrement dans `registerAllVisualizations.ts` est fait
- [ ] Le type est ajouté à `VisualizationCompState`
- [ ] Testé dans le dashboard
- [ ] Aucune erreur console

## 🐛 Problèmes courants

### "Visualization not found"

**Cause** : Oubli d'enregistrer dans `registerAllVisualizations.ts`

**Solution** : Ajouter `registry.register(MyNewVisuDescriptor);`

### L'icône ne s'affiche pas

**Cause** : Mauvaise syntaxe de l'icône

**Solution** : Vérifier que c'est un composant React valide :
```typescript
icon: MyIcon  // ✓ Correct
icon: <MyIcon />  // ✗ Incorrect
icon: 'myIcon'  // ✗ Incorrect
```

### La visualisation n'apparaît pas dans le menu

**Cause** : Mauvais contexte ou contexte non utilisé

**Solution** : Vérifier que le contexte correspond à celui du dashboard :
```typescript
// Dans le descripteur
contexts: [VisualizationContext.DATA_ANALYSIS]

// Dans le composant qui utilise le dashboard
<AnalysisDashboard context={VisualizationContext.DATA_ANALYSIS} ... />
```

### Erreur TypeScript

**Cause** : Type manquant dans `VisualizationCompState`

**Solution** : Ajouter le type au union dans `VisualizationStateSystem.ts`

## 📖 Exemples complets

Consultez les descripteurs existants pour des exemples complets :
- `RoseDiagramDescriptor.ts` - Visualisation circulaire
- `HistogramDescriptor.ts` - Visualisation statistique
- `MohrCircleDescriptor.ts` - Visualisation de contraintes
- `FractureMap2DDescriptor.ts` - Visualisation spatiale

## 🚀 Aller plus loin

### Lazy loading pour performances

```typescript
component: React.lazy(() => import('./MyHeavyComponent'))
```

### Settings dynamiques

```typescript
createInitialState: (width, height) => {
  // Adapter les settings selon les dimensions
  const adaptiveSettings = width > 600 
    ? { fontSize: 14, pointSize: 5 }
    : { fontSize: 10, pointSize: 3 };
    
  return {
    type: 'myVisu',
    settings: { ...defaultSettings, ...adaptiveSettings },
    // ...
  };
}
```

### Validation de données

```typescript
// Dans votre composant
if (!files || files.length === 0) {
  return <div>No data available</div>;
}

// Valider le type de colonne sélectionnée
const column = getSelectedColumnData();
if (column && column.dataType !== 'number') {
  return <div>This visualization requires numeric data</div>;
}
```

## 💡 Conseils

1. **Commencez simple** : Faites fonctionner la visualisation de base avant d'ajouter des features
2. **Copiez un exemple** : Partez d'un descripteur existant similaire
3. **Testez incrémentalement** : Testez après chaque étape
4. **Documentez** : Ajoutez une description claire de ce que fait la visualisation
5. **Soyez cohérent** : Suivez les conventions des visualisations existantes

Bon développement ! 🎉