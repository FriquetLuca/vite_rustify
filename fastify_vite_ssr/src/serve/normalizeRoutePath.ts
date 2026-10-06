export function normalizeRoutePath(routePath: string): string {
  if (routePath === '/') {
    return '/';
  }
  return routePath.replace(/\/+$/, '') || '/';
}
