import React from 'react';
import { hydrateRoot, createRoot } from 'react-dom/client';
import { useSSR } from 'react-i18next';
import { createBrowserRouter, matchRoutes, RouterProvider } from 'react-router';
import '../services/i18n.client.js';
import { createRoutes } from '../router/routes.js';
import Main from '../main.js';

function Render({
  router,
}: {
  router: ReturnType<typeof createBrowserRouter>;
}) {
  const initialProps = window.__INITIAL_PROPS__;
  if (initialProps) {
    useSSR(initialProps.initialI18nStore, initialProps.initialLanguage);
  }
  return (
    <React.StrictMode>
      <Main>
        <RouterProvider router={router} />
      </Main>
    </React.StrictMode>
  );
}

async function hydrate() {
  const routes = createRoutes();
  const lazyMatches = matchRoutes(routes, window.location)?.filter(
    (m) => m.route.lazy
  );
  if (lazyMatches && lazyMatches?.length > 0) {
    await Promise.all(
      lazyMatches.map(async (m) => {
        let lazy = m.route.lazy as () => Promise<Record<string, unknown>>;
        let routeModule = await lazy();
        Object.assign(m.route, { ...routeModule, lazy: undefined });
      })
    );
  }
  const router = createBrowserRouter(routes);
  const root = document.getElementById('root')!;
  if (window.__SSR__) {
    hydrateRoot(root, <Render router={router} />);
  } else {
    createRoot(root).render(<Render router={router} />);
  }
}

hydrate();
