import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// 1. Fonts first — so no flash of unstyled text
import '@fontsource-variable/inter';
import '@fontsource-variable/fraunces';

// 2. Leaflet CSS — must come BEFORE leaflet-fix.js
import 'leaflet/dist/leaflet.css';

// 3. Leaflet marker fix — must come AFTER the CSS import and BEFORE any component uses L.*
import './lib/leaflet-fix';

// 4. App CSS last — so Tailwind overrides take effect
import './index.css';

import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
