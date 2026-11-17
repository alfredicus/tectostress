import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { installSandboxStorage } from './workflow/browserStore';

// `?sandbox`: a page with its own storage, for checks that must not touch the user's data
installSandboxStorage();

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
}