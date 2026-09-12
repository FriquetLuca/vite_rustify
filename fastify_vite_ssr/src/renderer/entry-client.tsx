import { hydrateRoot } from 'react-dom/client';
import App from '../App.js';
import React, { Suspense } from 'react';
import { useSSR } from 'react-i18next';
import '../services/i18n.client';
import Loading from '../components/Loading.js';
import { BrowserRouter } from 'react-router';

// eslint-disable-next-line react-refresh/only-export-components
function Render() {
  useSSR(
    window.__INITIAL_PROPS__.initialI18nStore,
    window.__INITIAL_PROPS__.initialLanguage
  );
  return (
    <React.StrictMode>
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
          <App />
        </Suspense>
      </BrowserRouter>
    </React.StrictMode>
  );
}

hydrateRoot(document.getElementById('root')!, <Render />);
