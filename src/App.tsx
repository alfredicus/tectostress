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
            {/* Temporary test container - will appear at top of page */}
            <div style={{ 
                padding: '20px', 
                backgroundColor: '#f0f0f0',
                borderBottom: '2px solid #333'
            }}>
                <h2>🧪 Wulff Geometry Test (Temporary)</h2>
                <div id="wulff-test-container"></div>
            </div>
            
            <MainInterface />
        </div>
    );
}

export default App;