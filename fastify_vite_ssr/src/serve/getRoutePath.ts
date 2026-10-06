import path from 'node:path';

export function getRoutePath(
  rootPath: string,
  file: string,
  keepIndex = false
): string {
  let route = path.relative(rootPath, file).split(path.sep).join('/');
  route = route.replace(/\.(tsx|ts|jsx|js)$/, '');
  /*
   * Rendering-mode suffixes are not part of the URL.
   *
   * blog/[slug].ssg.tsx
   * -> blog/[slug]
   */
  route = route.replace(/\.(ssr|ssg|csr)$/, '');
  /*
   * Optional catch-all:
   *
   * [[...slug]] -> *slug
   */
  //route = route.replace(/\[\[\.\.\.([^\]]+)\]\]/g, '*$1');
  /*
   * Catch-all:
   *
   * [...slug] -> *slug
   */
  //route = route.replace(/\[\.\.\.([^\]]+)\]/g, '*$1');
  /*
   * Dynamic segment:
   *
   * [slug] -> :slug
   */
  route = route.replace(/\[([^\]]+)\]/g, ':$1');
  if (!keepIndex) {
    route = route.replace(/(^|\/)index$/, '$1');
  }
  route = route.replace(/^\/+/, '');
  if (!route) {
    return '/';
  }
  return `/${route}`;
}
