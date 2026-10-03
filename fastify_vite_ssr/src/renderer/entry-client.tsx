import React from 'react';
import { hydrateRoot, createRoot } from 'react-dom/client';
import { useSSR } from 'react-i18next';
import { BrowserRouter } from 'react-router';
import App from '../App.js';

import '../services/i18n.client';

function Render() {
  const initialProps = window.__INITIAL_PROPS__;

  if (initialProps) {
    useSSR(initialProps.initialI18nStore, initialProps.initialLanguage);
  }

  return (
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
}

const root = document.getElementById('root')!;

if (window.__SSR__) {
  hydrateRoot(root, <Render />);
} else {
  createRoot(root).render(<Render />);
}
