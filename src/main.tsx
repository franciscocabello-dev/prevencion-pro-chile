import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { aplicarTema, leerTema } from './services/theme';

// Aplica el tema guardado antes del primer render (sin parpadeo)
aplicarTema(leerTema());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service worker: habilita instalación PWA y uso offline en terreno
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('SW no registrado', err));
  });
}
