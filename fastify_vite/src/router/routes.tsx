import type { RouteObject } from 'react-router';
import { ServerPropsProvider } from './ServerPropsProvider.js';
import type { RouteData } from '../types';
import pageRoutes from '@router';

export function createRoutes(ssp?: RouteData): RouteObject[] {
  return pageRoutes.map(({ path, load }) => ({
    path,
    lazy: async () => {
      const { default: Component, ...props } = await load();
      return {
        ...props,
        element: (
          <ServerPropsProvider path={path} props={ssp}>
            <Component />
          </ServerPropsProvider>
        ),
      };
    },
  }));
}
