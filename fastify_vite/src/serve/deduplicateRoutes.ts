import type { RenderMode } from '../types.js';
import type { ServerRoute } from '@router/server';

const renderModePriority: Record<RenderMode, number> = {
  csr: 0,
  ssr: 1,
  ssg: 2,
};

export function deduplicateRoutes(routes: ServerRoute[]): ServerRoute[] {
  const routesByPath = new Map<string, ServerRoute>();
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
    if (!existing.serverFile && route.serverFile) {
      routesByPath.set(route.path, route);
      continue;
    }
  }
  return [...routesByPath.values()];
}
