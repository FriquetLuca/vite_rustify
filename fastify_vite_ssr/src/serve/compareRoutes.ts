const SCORE = {
  static: 10,
  dynamic: 3,         // :id
  partialDynamic: 3.5, // :id-suffix style segments
  empty: 1,           // leading/trailing "/"
  index: 2,
  splatPenalty: -2,
} as const;

const paramRe = /^:[\w-]+$/;
const partialParamRe = /^:[\w-]+/;
const isSplat = (s: string) => s === "*";

export interface PathInfo {
  path: string;
  index?: boolean;
  /** Position of each route in its parent's children, from root to leaf (e.g. [0, 2]). */
  childrenIndexes?: number[];
}

function scorePath({ path, index }: PathInfo): number {
  const segments = path.split("/");
  let score = segments.length;

  if (segments.some(isSplat)) score += SCORE.splatPenalty;
  if (index) score += SCORE.index;

  return segments
    .filter((s) => !isSplat(s))
    .reduce((total, segment) => {
      if (paramRe.test(segment)) return total + SCORE.dynamic;
      if (partialParamRe.test(segment)) return total + SCORE.partialDynamic;
      if (segment === "") return total + SCORE.empty;
      return total + SCORE.static;
    }, score);
}

function compareIndexes(a: number[], b: number[]): number {
  const siblings =
    a.length === b.length && a.slice(0, -1).every((n, i) => n === b[i]);

  return siblings ? a[a.length - 1] - b[b.length - 1] : 0;
}

export function compareRoutes(a: PathInfo, b: PathInfo): number {
  const diff = scorePath(b) - scorePath(a);
  if (diff !== 0) return diff;

  return a.childrenIndexes && b.childrenIndexes
    ? compareIndexes(a.childrenIndexes, b.childrenIndexes)
    : a.path.localeCompare(b.path);
}
