// App.tsx
// Point d'entrée de l'application
// C'EST ICI qu'on enregistre toutes les visualisations au démarrage

import React, { useEffect } from 'react';
import { registerAllVisualizations } from './components/registerAllVisualizations';
import MainInterface from './components/MainInterface';
// ... autres imports

function App() {
    // Enregistrer toutes les visualisations au montage de l'app
    useEffect(() => {
        registerAllVisualizations();
    }, []);

    return (
        <div className="App">
            <MainInterface />
        </div>
    );
}

export default App;