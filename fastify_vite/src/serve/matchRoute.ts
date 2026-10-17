import { matchPath, type PathMatch } from 'react-router';
import type { ServerRoute } from '@router/server';

export function matchRoute(
  path: string,
  routes: ServerRoute[]
):
  | [route: ServerRoute, pathMatch: PathMatch<string>]
  | [route: undefined, pathMatch: undefined] {
  for (const route of routes) {
    const match = matchPath(
      {
        path: route.path,
        end: true,
      },
      path
    );
    if (match) {
      return [route, match];
    }
  }
  return [undefined, undefined];
}
