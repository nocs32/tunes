import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app.tsx';
import './index.css';

// Follow the system's light or dark setting, live.
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

const applyTheme = (): void => {
  document.documentElement.classList.toggle('dark', darkQuery.matches);
};

applyTheme();
darkQuery.addEventListener('change', applyTheme);

const root = document.getElementById('root');

if (!root) {
  throw new Error('No #root element in index.html');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
