// import React from 'react'
// import { createRoot } from 'react-dom/client'
// import Markdown from 'react-markdown'
// import remarkGfm from 'remark-gfm'

// const markdown = 'This ~is not~ strikethrough, but ~~this is~~!'

const HelpComponent = () => {

    return (
        <div className="w-full max-w-4xl p-4 space-y-4">
            <div className="p-4">
                <h2 className="text-xl font-semibold mb-4">Aide</h2>
                <div className="space-y-4">
                    <h3 className="font-medium">Guide d'utilisation</h3>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>Construction: Ajoutez et sélectionnez vos données</li>
                        <li>Run: Exécutez l'analyse sur les données sélectionnées</li>
                        <li>Analyse: Visualize your results</li>
                    </ul>
                </div>
            </div>
        </div>
    );

};

export default HelpComponent;