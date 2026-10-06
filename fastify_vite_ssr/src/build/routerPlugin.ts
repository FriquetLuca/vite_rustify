import path from 'node:path';
import { globSync } from 'tinyglobby';
import { normalizePath, type Plugin, type ResolvedConfig } from 'vite';
import { createFilter, type FilterPattern } from './createFilter.js';
import { normalizeRoutePath } from '../serve/normalizeRoutePath.js';
import { getRoutePath } from '../serve/getRoutePath.js';
import { readMetadata } from './readMetadata.js';

export type RenderMode = 'ssr' | 'ssg' | 'csr';

export interface RouterPluginOptions {
  /**
   * Files to use as pages.   *
   * Patterns are resolved relative to the Vite project root.
   */
  include?: string | string[];

  /**
   * Files to exclude.   *
   * Patterns are resolved relative to the Vite project root.
   */
  exclude?: FilterPattern;

  /**
   * ID of the virtual route module.
   *
   * @default "framework-router"
   */
  moduleId?: string;

  /**
   * Properties to statically extract from page modules.
   *
   * @default []
   */
  allowProperties?: string[];
  includeMode?: boolean;
}

export interface RouteDefinition {
  id: string;
  path: string;
  mode: RenderMode;
  metadata: Record<string, unknown>;
}

interface InternalRouteDefinition extends RouteDefinition {
  importPath: string;
}

export default function routerPlugin(
  options: RouterPluginOptions = {}
): Plugin {
  let config: ResolvedConfig;

  const moduleId = options.moduleId ?? 'framework-router';

  const virtualModuleId = `virtual:${moduleId}`;
  const resolvedVirtualModuleId = `\0${virtualModuleId}`;

  const include = normalizePatterns(
    options.include ?? '/src/pages/**/*.{tsx,ts,jsx,js}'
  );

  const exclude = options.exclude ?? '/src/pages/**/*.server.{tsx,ts,jsx,js}';

  const allowProperties = options.allowProperties ?? [];
  const includeMode = options.includeMode ?? false;

  let filter: ReturnType<typeof createFilter>;

  function resolveFilterPattern(pattern: FilterPattern): FilterPattern {
    if (typeof pattern === 'string') {
      return resolveFilterString(pattern);
    }

    if (Array.isArray(pattern)) {
      return pattern.map((value) =>
        typeof value === 'string' ? resolveFilterString(value) : value
      );
    }

    return pattern;
  }

  function resolveFilterString(pattern: string): string {
    if (pattern.startsWith('/')) {
      return normalizePath(path.resolve(config.root, pattern.slice(1)));
    }
    return normalizePath(pattern);
  }

  return {
    name: 'framework-router',

    configResolved(resolvedConfig) {
      config = resolvedConfig;

      filter = createFilter(
        resolveFilterPattern(include),
        resolveFilterPattern(exclude)
      );
    },

    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }

      return undefined;
    },

    load(id) {
      if (id !== resolvedVirtualModuleId) {
        return undefined;
      }

      return generateRouterModule();
    },

    hotUpdate({ type, file }) {
      const normalizedFile = normalizePath(file);

      if (!filter(normalizedFile)) {
        return;
      }

      /*
       * Creating or deleting a matching page changes the route
       * collection itself, so the safest behaviour is a full reload.
       */
      if (type === 'create' || type === 'delete') {
        this.environment.hot.send({
          type: 'full-reload',
        });

        return [];
      }

      /*
       * An existing page changed. The generated virtual module may
       * have different metadata or route information.
       */
      const module = this.environment.moduleGraph.getModuleById(
        resolvedVirtualModuleId
      );

      if (!module) {
        return;
      }

      this.environment.moduleGraph.invalidateModule(module);

      return [module];
    },
  };

  function generateRouterModule(): string {
    const routes = discoverRoutes();

    const imports = routes
      .map((route, index) => {
        return `const load${index} = () => import(${JSON.stringify(
          route.importPath
        )});`;
      })
      .join('\n');

    const routeEntries = routes
      .map((route, index) => {
        return `{
  id: ${JSON.stringify(route.id)},
  path: ${JSON.stringify(route.path)},
  ${includeMode ? `mode: ${JSON.stringify(route.mode)},` : ''}
  metadata: ${JSON.stringify(route.metadata)},
  load: load${index},
}`;
      })
      .join(',\n');

    return [
      imports,
      '',
      'export const routes = [',
      routeEntries,
      '];',
      '',
      'export default routes;',
      '',
    ].join('\n');
  }

  function discoverRoutes(): InternalRouteDefinition[] {
    const files = discoverFiles();
    const pagesRoot = path.resolve(config.root, 'src/pages');
    return files
      .map((file) => {
        const importPath = getModulePath(file);
        const id = getRoutePath(pagesRoot, file, true);
        const path = normalizeRoutePath(getRoutePath(pagesRoot, file));
        const metadata = readMetadata(file, allowProperties);

        return {
          id,
          path,
          mode: getRenderMode(file, metadata),
          metadata,
          importPath,
        };
      })
      .sort((a, b) => compareRoutes(a.path, b.path));
  }

  function discoverFiles(): string[] {
    const patterns = include.map(normalizeGlobPattern);

    const files = globSync(patterns, {
      cwd: config.root,
      absolute: true,
      onlyFiles: true,
      dot: false,
    });

    /*
     * createFilter remains the final authority for filtering.
     *
     * This is useful because FilterPattern supports more than glob
     * strings, including regular expressions.
     */
    return files
      .map(normalizePath)
      .filter((file) => filter(file))
      .sort();
  }

  function getRenderMode(
    file: string,
    metadata: Record<string, unknown>
  ): RenderMode {
    if (
      metadata.mode === 'ssr' ||
      metadata.mode === 'ssg' ||
      metadata.mode === 'csr'
    ) {
      return metadata.mode;
    }

    if (file.endsWith('.ssr.tsx')) {
      return 'ssr';
    }

    if (file.endsWith('.ssg.tsx')) {
      return 'ssg';
    }

    if (file.endsWith('.csr.tsx')) {
      return 'csr';
    }

    return 'ssr';
  }

  function getModulePath(file: string): string {
    const relative = path.relative(config.root, file);

    return normalizePath(`/${relative}`);
  }

  function compareRoutes(a: string, b: string): number {
    if (a === b) {
      return 0;
    }

    const aSegments = a.split('/').filter(Boolean);

    const bSegments = b.split('/').filter(Boolean);

    const length = Math.min(aSegments.length, bSegments.length);

    for (let index = 0; index < length; index++) {
      const aSegment = aSegments[index];
      const bSegment = bSegments[index];

      const aDynamic = aSegment.startsWith(':') || aSegment.startsWith('*');

      const bDynamic = bSegment.startsWith(':') || bSegment.startsWith('*');

      /*
       * Static segments take precedence over dynamic
       * segments.
       *
       * /blog/new
       * /blog/:slug
       */
      if (aDynamic !== bDynamic) {
        return aDynamic ? 1 : -1;
      }

      if (aSegment !== bSegment) {
        return aSegment.localeCompare(bSegment);
      }
    }

    /*
     * A shorter route comes first.
     */
    return aSegments.length - bSegments.length;
  }
}

function normalizePatterns(patterns: string | string[]): string[] {
  return Array.isArray(patterns) ? patterns : [patterns];
}

function normalizeGlobPattern(pattern: string): string {
  if (pattern.startsWith('!/')) {
    return `!${pattern.slice(2)}`;
  }

  if (pattern.startsWith('/')) {
    return pattern.slice(1);
  }

  if (pattern.startsWith('./')) {
    return pattern.slice(2);
  }

  return pattern;
}
