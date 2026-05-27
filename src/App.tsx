// App.tsx
// Point d'entrée de l'application
// C'EST ICI qu'on enregistre toutes les visualisations au démarrage

import React, { useEffect } from 'react';
import { registerAllVisualizations } from './components/registerAllVisualizations';
import MainInterface from './components/MainInterface';
// import { testWulffGeometry } from './components/Wulff/testWulffGeometry';  // ← ADD THIS

function App() {
    // Enregistrer toutes les visualisations au montage de l'app
    useEffect(() => {
        registerAllVisualizations();
        
        // TEMPORARY: Test new Wulff geometry
        // console.log('🔧 Running Wulff geometry test...');
        // setTimeout(() => {
        //     testWulffGeometry();
        // }, 2000); // Wait 2 seconds for app to load
    }, []);

    return (
        <div className="App">
            <MainInterface />
        </div>
    );
}

export default App;