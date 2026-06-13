// main.jsx — React application entry point
//
// This is the file Vite uses as its root module.  It mounts the React app
// into the <div id="root"> element in index.html.
//
// StrictMode renders every component twice in development to help catch
// side-effects and bugs early.  It has no effect in production.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
    <App />
);
