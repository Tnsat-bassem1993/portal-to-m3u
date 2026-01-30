import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from 'https://tnsat-bassem1993.github.io/portal-to-m3u/src/App.tsx';
import 'https://tnsat-bassem1993.github.io/portal-to-m3u/src/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
