import './index.css';
import { createRoot } from 'react-dom/client';
import Router from './components/Router.js';
import React, { Suspense } from 'react';
import './services/i18n.js';
import Loading from './components/Loading.js';
import { BrowserRouter } from 'react-router';

// eslint-disable-next-line react-refresh/only-export-components
function App() {
  return (
    <React.StrictMode>
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
          <Router />
        </Suspense>
      </BrowserRouter>
    </React.StrictMode>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
