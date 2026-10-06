import { isAbsolute, posix, resolve } from 'node:path';
import picomatch from 'picomatch';

export type FilterPattern =
  ReadonlyArray<string | RegExp> | string | RegExp | null | undefined;

export interface CreateFilterOptions {
  /** Base directory for relative globs. `false` disables resolving. Defaults to process.cwd(). */
  resolve?: string | false | null;
}

const normalizePath = (p: string) => p.replace(/\\/g, '/');

const ensureArray = <T>(
  thing: T | readonly T[] | null | undefined
): readonly T[] => {
  if (Array.isArray(thing)) return thing;
  if (thing == null) return [];
  return [thing as T];
};

function getMatcherString(
  glob: string,
  base: string | false | null | undefined
): string {
  if (base === false || isAbsolute(glob) || glob.startsWith('**')) {
    return normalizePath(glob);
  }
  // Escape the base so characters in the path aren't read as glob syntax
  const basePath = normalizePath(resolve(base || '')).replace(
    /[-^$*+?.()|[\]{}]/g,
    '\\$&'
  );
  return posix.join(basePath, normalizePath(glob));
}

type Matcher = (id: string) => boolean;

function toMatcher(
  pattern: string | RegExp,
  base: CreateFilterOptions['resolve']
): Matcher {
  if (pattern instanceof RegExp) {
    return (id) => {
      pattern.lastIndex = 0; // g/y flags make test() stateful
      return pattern.test(id);
    };
  }
  return picomatch(getMatcherString(pattern, base), { dot: true });
}

export function createFilter(
  include?: FilterPattern,
  exclude?: FilterPattern,
  options?: CreateFilterOptions
): (id: string | unknown) => boolean {
  const base = options?.resolve;
  const includeMatchers = ensureArray(include).map((p) => toMatcher(p, base));
  const excludeMatchers = ensureArray(exclude).map((p) => toMatcher(p, base));

  return (id) => {
    if (typeof id !== 'string') return false;
    if (id.includes('\0')) return false; // virtual modules

    const pathId = normalizePath(id);

    if (excludeMatchers.some((m) => m(pathId))) return false;
    if (includeMatchers.some((m) => m(pathId))) return true;

    return includeMatchers.length === 0;
  };
}
