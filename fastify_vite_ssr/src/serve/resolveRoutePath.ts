export interface RouteParam {
  name: string;
  optional: boolean;
}

export type StaticParams = Record<string, string | readonly string[]>;

const PARAM_RE = /\/:([\w-]+)(\?)?/g;
const SPLAT_RE = /(^|\/)\*$/;

export function getRouteParamsInfo(routePath: string): RouteParam[] {
  const params: RouteParam[] = [...routePath.matchAll(PARAM_RE)].map((m) => ({
    name: m[1],
    optional: m[2] === '?',
  }));
  // A splat matches empty, so it is always optional
  if (SPLAT_RE.test(routePath)) params.push({ name: '*', optional: true });
  return params;
}

export const getRouteParams = (routePath: string) =>
  getRouteParamsInfo(routePath).map((p) => p.name);

const isEmpty = (v: StaticParams[string] | undefined) =>
  v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

export function resolveRoutePath(
  routePath: string,
  params: StaticParams
): string | { error: string } {
  const errors: string[] = [];

  let resolved = routePath.replace(PARAM_RE, (_, name: string, opt?: string) => {
    const value = params[name];
    if (isEmpty(value)) {
      if (!opt) errors.push(`Missing static parameter "${name}" for ${routePath}`);
      return ''; // an omitted optional param drops its whole segment
    }
    if (typeof value !== 'string') {
      errors.push(`Parameter "${name}" must be a string for ${routePath}`);
      return '';
    }
    return '/' + encodeURIComponent(value);
  });

  // Splat: params['*'] as a string ("a/b") or an array (["a", "b"])
  resolved = resolved.replace(SPLAT_RE, (_, lead: string) => {
    const value = params['*'];
    if (isEmpty(value)) return '';
    const segments = typeof value === 'string' ? value.split('/') : value!;
    const encoded = segments.filter(Boolean).map(encodeURIComponent).join('/');
    return lead + encoded;
  });

  // Static optional segments ("users?") are rendered, not dropped
  resolved = resolved.replace(/\/([^/]+)\?(?=\/|$)/g, '/$1');

  if (errors.length) return { error: errors.join('\n') };

  resolved = resolved.replace(/\/{2,}/g, '/').replace(/(.)\/$/, '$1');
  return resolved.startsWith('/') ? resolved : '/' + resolved;
}
