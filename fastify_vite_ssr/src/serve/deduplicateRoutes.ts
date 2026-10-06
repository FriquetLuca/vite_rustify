import type { RenderMode } from '../types.js';
import type { RouteDefinition } from './routes.js';

const renderModePriority: Record<RenderMode, number> = {
  csr: 0,
  ssr: 1,
  ssg: 2,
};

export function deduplicateRoutes(
  routes: RouteDefinition[]
): RouteDefinition[] {
  const routesByPath = new Map<string, RouteDefinition>();

  for (const route of routes) {
    const existing = routesByPath.get(route.path);

    if (!existing) {
      routesByPath.set(route.path, route);
      continue;
    }

    const existingPriority = renderModePriority[existing.mode];
    const routePriority = renderModePriority[route.mode];

    if (routePriority > existingPriority) {
      routesByPath.set(route.path, route);
      continue;
    }

    if (routePriority < existingPriority) {
      continue;
    }

    /*
     * Same path + same rendering mode.
     *
     * If one route has a server module and the other doesn't,
     * prefer the one with the server module. This prevents an
     * index route from accidentally hiding server-side props.
     */
    if (!existing.serverFilePath && route.serverFilePath) {
      routesByPath.set(route.path, route);
      continue;
    }

    /*
     * Both have serverFilePath, or neither does.
     *
     * At this point these are genuine same-priority duplicates.
     * Keep the first one for now.
     */
  }

  return [...routesByPath.values()];
}
