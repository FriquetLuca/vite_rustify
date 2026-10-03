import type { RouteObject } from 'react-router';
import { ServerPropsProvider } from './ServerPropsProvider.js';
import type { RouteData } from '../types';
import type { JSX } from 'react';

type PageModule = {
  default: () => JSX.Element;
} & Omit<
  RouteObject,
  | 'lazy'
  | 'caseSensitive'
  | 'path'
  | 'id'
  | 'index'
  | 'children'
  | 'unstable_validateParams'
  | 'middleware'
>;

const pages = import.meta.glob(
  ['/src/pages/**/*.tsx', '!/src/pages/**/*.server.tsx'],
  {
    eager: false,
  }
) as Record<string, () => Promise<PageModule>>;

function getRoutePath(file: string) {
  let name = file.match(/\/src\/pages\/(.*)\.tsx$/)?.[1] || '';
  name = name
    .replace(/\.(ssr|ssg|csr)$/, '')
    .replace(/\[([^\]]+)\]/g, ':$1')
    .replace(/\/index$/, '')
    .replace(/^index$/, '');
  return `/${name}`;
}

export function createRoutes(ssp?: RouteData): RouteObject[] {
  return Object.keys(pages).map((file) => {
    const path = getRoutePath(file);
    return {
      path,
      lazy: async () => {
        const { default: Component, ...props } = await pages[file]();
        return {
          ...props,
          element: (
            <ServerPropsProvider path={path} props={ssp}>
              <Component />
            </ServerPropsProvider>
          ),
        };
      },
    };
  });
}
