import { Routes, Route, useParams } from 'react-router';
import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import Loading from './Loading.js';
import type { RouteData, StaticProps } from '../types';

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

type RenderMode = 'ssr' | 'ssg' | 'csr';

interface RouteDefinition {
  path: string;
  mode: RenderMode;
  component: PageComponent;
}

function getRouteMode(file: string): RenderMode {
  if (file.endsWith('.ssg.tsx')) {
    return 'ssg';
  }
  if (file.endsWith('.csr.tsx')) {
    return 'csr';
  }
  return 'ssr';
}

function getRoutePath(file: string) {
  let name = file.match(/\/src\/pages\/(.*)\.tsx$/)?.[1] || '';
  name = name
    .replace(/\.(ssr|ssg|csr)$/, '')
    .replace(/\[([^\]]+)\]/g, ':$1')
    .replace(/\/index$/, '')
    .replace(/^index$/, '');
  return `/${name}`;
}

const routes: RouteDefinition[] = Object.keys(pages).map((file) => ({
  path: getRoutePath(file),
  mode: getRouteMode(file),
  component: lazy(pages[file]),
}));

function RouteWrapper({
  component: Component,
  props,
  path,
  mode,
}: {
  component: PageComponent;
  props?: RouteData;
  path: string;
  mode: RenderMode;
}) {
  const params = useParams();
  const [data, setData] = useState<RouteData | null>(() => {
    if (typeof window === 'undefined') {
      return props ?? null;
    }
    return window.__ROUTE_DATA__?.[path] ?? props ?? null;
  });
  useEffect(() => {
    const cached = window.__ROUTE_DATA__?.[path];
    if (cached) {
      document.title = cached.title || document.title;
      setData(cached);
      return;
    }
    fetch(`/__data${path}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load route data: ${response.status}`);
        }
        return response.json() as Promise<StaticProps>;
      })
      .then((result) => {
        window.__ROUTE_DATA__ ??= {};
        window.__ROUTE_DATA__[path] = result;
        document.title = result?.title || document.title;
        setData(result);
      })
      .catch((error) => {
        console.error(`Failed to load data for ${path}`, error);
      });
  }, [path, mode]);

  return <Component {...(data || props)} params={params} />;
}

export default function Router({ props }: { props?: RouteData }) {
  return (
    <Routes>
      {routes.map((route) => (
        <Route
          key={route.path}
          path={route.path}
          element={
            <Suspense fallback={<Loading />}>
              <RouteWrapper
                component={route.component}
                path={route.path}
                mode={route.mode}
                props={props}
              />
            </Suspense>
          }
        />
      ))}
    </Routes>
  );
}
