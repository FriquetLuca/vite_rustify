import { Routes, Route } from 'react-router';
import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import type { RouteData, StaticProps } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PageComponent = ComponentType<any>;

interface PageModule {
  default: PageComponent;
}

const pages = import.meta.glob(
  ['/src/pages/**/*.tsx', '!/src/pages/**/*.server.tsx'],
  {
    eager: false,
  }
) as Record<string, () => Promise<PageModule>>;

const routes = Object.keys(pages).map((path) => {
  let name = path.match(/\/src\/pages\/(.*)\.tsx$/)?.[1] || '';
  name = name
    .replace(/\[([^\]]+)\]/g, ':$1')
    .replace(/\/index$/, '')
    .replace(/^index$/, '');
  const routePath = `/${name}`;
  return {
    path: routePath,
    component: lazy(pages[path]),
  };
});

function RouteWrapper({
  component: Component,
  props,
  path,
}: {
  component: PageComponent;
  props?: RouteData;
  path: string;
}) {
  const [data, setData] = useState<RouteData | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    return window.__ROUTE_DATA__?.[path] ?? null;
  });
  useEffect(() => {
    const cached = window.__ROUTE_DATA__?.[path] as RouteData | null;

    if (cached) {
      document.title = cached?.title || document.title;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(cached);
      return;
    }
    fetch(`/__data${path}`)
      .then((r) => r.json() as StaticProps)
      .then((result) => {
        window.__ROUTE_DATA__[path] = result;
        document.title = result?.title || document.title;
        setData(result);
      });
  }, [path]);
  return <Component {...(data || props)} />;
}

export default function Router({ props }: { props?: RouteData }) {
  return (
    <Routes>
      {routes.map((route) => (
        <Route
          key={route.path}
          path={route.path}
          element={
            <Suspense fallback={<div>Loading...</div>}>
              <RouteWrapper
                component={route.component}
                path={route.path}
                props={props}
              />
            </Suspense>
          }
        />
      ))}
    </Routes>
  );
}
