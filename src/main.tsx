import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../portal-to-m3u/App.tsx';
import '../portal-to-m3u/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
