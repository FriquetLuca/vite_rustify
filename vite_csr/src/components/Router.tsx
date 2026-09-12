import { Routes, Route } from 'react-router';
import { lazy, Suspense, useEffect, type ComponentType } from 'react';
import Loading from './Loading';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PageComponent = ComponentType<any>;

interface PageModule {
  default: PageComponent;
  title?: string | undefined;
}

const pages = import.meta.glob(['/src/pages/**/*.tsx'], {
  eager: false,
}) as Record<string, () => Promise<PageModule>>;

function PageRoute({
  loader,
  Component,
}: {
  loader: () => Promise<PageModule>;
  Component: PageComponent;
}) {
  useEffect(() => {
    loader().then((mod) => {
      document.title = mod?.title ?? import.meta.env.VITE_APP_NAME;
    });
  }, [loader]);

  return <Component />;
}

const routes = Object.keys(pages).map((path) => {
  let name = path.match(/\/src\/pages\/(.*)\.tsx$/)?.[1] || '';
  name = name
    .replace(/\[([^\]]+)\]/g, ':$1')
    .replace(/\/index$/, '')
    .replace(/^index$/, '');
  const loader = pages[path];
  return {
    path: `/${name}`,
    loader,
    component: lazy(loader),
  };
});

export default function Router() {
  return (
    <Routes>
      {routes.map((route) => {
        const Component = route.component;
        return (
          <Route
            key={route.path}
            path={route.path}
            element={
              <Suspense fallback={<Loading />}>
                <PageRoute loader={route.loader} Component={Component} />
              </Suspense>
            }
          />
        );
      })}
    </Routes>
  );
}
