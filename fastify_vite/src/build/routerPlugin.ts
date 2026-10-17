import path from 'node:path';
import { globSync } from 'tinyglobby';
import { normalizePath, type Plugin, type ResolvedConfig } from 'vite';
import { createFilter, type FilterPattern } from './utils/index.js';
import {
  compareRoutes,
  getRoutePath,
  normalizeRoutePath,
} from './routes/index.js';
import { readMetadata } from './metadata/index.js';
import type { RenderMode } from '../types.js';

export interface RouterPluginOptions {
  /**
   * Root of the pages.
   *
   * @default "src/pages"
   */
  root?: string;
  /**
   * Files to use as pages.
   *
   * Patterns are resolved relative to the Vite project root.
   */
  include?: FilterPattern;
  /**
   * Files to exclude.
   *
   * Patterns are resolved relative to the Vite project root.
   */
  exclude?: FilterPattern;
  /**
   * ID of the virtual route module.
   *
   * @default "virtual:client-router"
   */
  moduleId?: string;
  /**
   * ID of the virtual server route module.
   *
   * @default "virtual:server-router"
   */
  serverModuleId?: string;
  /**
   * Properties to statically extract from page modules.
   *
   * @default []
   */
  allowProperties?: string[];
  /**
   * Include the rendering mode of the page in the route.
   *
   * @default false
   */
  includeMode?: boolean;
}

const SERVER_FILE_REGEX = /\.server\.(tsx|ts|jsx|js)$/;
const PAGE_SUFFIX_REGEX = /(\.(ssr|ssg|csr))?\.(tsx|ts|jsx|js)$/;

interface ScannedRoute {
  id: string;
  path: string;
  mode: RenderMode;
  metadata: Record<string, unknown>;
  importPath: string; // "/src/pages/about.ssr.tsx"
  serverImportPath?: string; // "/src/pages/about.server.tsx"
}

export default function routerPlugin(
  options: RouterPluginOptions = {}
): Plugin {
  let config: ResolvedConfig;
  let filter: ReturnType<typeof createFilter>;
  let cache: ScannedRoute[] | undefined;

  const root = options.root ?? 'src/pages';
  const clientModuleId = options.moduleId ?? 'virtual:client-router';
  const serverModuleId = options.serverModuleId ?? 'virtual:server-router';
  const include = options.include ?? '/src/pages/**/*.{tsx,ts,jsx,js}';
  const exclude = options.exclude ?? '/src/pages/**/*.server.{tsx,ts,jsx,js}';
  const allowProperties = options.allowProperties ?? [];
  const includeMode = options.includeMode ?? false;

  const RESOLVED_CLIENT = `\0${clientModuleId}`;
  const RESOLVED_SERVER = `\0${serverModuleId}`;

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

  const toImportPath = (file: string) =>
    normalizePath(`/${path.relative(config.root, file)}`);

  // ---- the single source of truth ----
  function scanRoutes(): ScannedRoute[] {
    if (cache) return cache;

    const pagesRoot = path.resolve(config.root, root);
    const files = globSync('**/*.{tsx,ts,jsx,js}', {
      cwd: pagesRoot,
      absolute: true,
      onlyFiles: true,
      dot: false,
    }).map(normalizePath);

    // "about" -> "/abs/src/pages/about.server.tsx"
    const serverFiles = new Map<string, string>();
    for (const file of files) {
      if (SERVER_FILE_REGEX.test(file)) {
        serverFiles.set(file.replace(SERVER_FILE_REGEX, ''), file);
      }
    }

    cache = files
      .filter((file) => filter(file)) // createFilter stays the authority
      .sort()
      .map((file) => {
        const metadata = readMetadata(file, allowProperties);
        const serverFile = serverFiles.get(file.replace(PAGE_SUFFIX_REGEX, ''));
        return {
          id: getRoutePath(pagesRoot, file, true),
          path: normalizeRoutePath(getRoutePath(pagesRoot, file)),
          mode: getRenderMode(file, metadata),
          metadata,
          importPath: toImportPath(file),
          serverImportPath: serverFile && toImportPath(serverFile),
        };
      })
      .sort((a, b) => compareRoutes({ path: a.path }, { path: b.path }));

    return cache;
  }

  function getRenderMode(
    file: string,
    metadata: Record<string, unknown>
  ): RenderMode {
    const m = metadata.mode;
    if (m === 'ssr' || m === 'ssg' || m === 'csr') return m;
    return (/\.(ssr|ssg|csr)\.[tj]sx?$/.exec(file)?.[1] as RenderMode) ?? 'ssr';
  }

  // ---- generators: same data, two shapes ----
  function generateClientModule(): string {
    const routes = scanRoutes();
    const loaders = routes
      .map(
        (r, i) =>
          `const load${i} = () => import(${JSON.stringify(r.importPath)});`
      )
      .join('\n');
    const entries = routes
      .map(
        (r, i) => `{
  id: ${JSON.stringify(r.id)},
  path: ${JSON.stringify(r.path)},
  ${includeMode ? `mode: ${JSON.stringify(r.mode)},` : ''}
  metadata: ${JSON.stringify(r.metadata)},
  load: load${i},
}`
      )
      .join(',\n');
    return `${loaders}\nexport const routes = [\n${entries}\n];\nexport default routes;\n`;
  }

  function generateServerModule(): string {
    const routes = scanRoutes();
    const imports: string[] = [];
    const entries = routes.map((r, i) => {
      if (r.serverImportPath) {
        imports.push(
          `import * as route${i} from ${JSON.stringify(r.serverImportPath)};`
        );
      }
      return `{
  path: ${JSON.stringify(r.path)},
  mode: ${JSON.stringify(r.mode)},
  filePath: ${JSON.stringify(r.importPath.slice(1))},
  ${r.serverImportPath ? `serverFile: () => route${i},` : ''}
}`;
    });
    return `${imports.join('\n')}\nexport default [\n${entries.join(',\n')}\n];\n`;
  }

  const isRouteFile = (file: string) =>
    normalizePath(file).startsWith(
      normalizePath(path.resolve(config.root, root)) + '/'
    ) &&
    (filter(file) || SERVER_FILE_REGEX.test(file));

  return {
    name: 'framework-router',
    enforce: 'pre',
    configResolved(resolved) {
      config = resolved;
      filter = createFilter(
        resolveFilterPattern(include),
        resolveFilterPattern(exclude)
      );
    },
    buildStart() {
      cache = undefined;
    },
    resolveId(id) {
      if (id === clientModuleId) return RESOLVED_CLIENT;
      if (id === serverModuleId) return RESOLVED_SERVER;
    },
    load(id) {
      if (id === RESOLVED_CLIENT) return generateClientModule();
      if (id === RESOLVED_SERVER) return generateServerModule();
    },
    hotUpdate({ type, file, modules }) {
      const normalized = normalizePath(file);
      if (!isRouteFile(normalized)) return;

      cache = undefined;
      const env = this.environment;
      const client = env.moduleGraph.getModuleById(RESOLVED_CLIENT);
      const server = env.moduleGraph.getModuleById(RESOLVED_SERVER);
      for (const mod of [client, server]) {
        if (mod) env.moduleGraph.invalidateModule(mod);
      }

      // Route set changed (file added/removed/renamed)
      if (type === 'create' || type === 'delete') {
        if (env.name === 'client') {
          env.hot.send({ type: 'full-reload' });
          return [];
        }
        // ssr: hand the virtual module on so serverReload sees a non-empty list
        return [server, client].filter((m) => m !== undefined);
      }

      // Existing page edited: only its metadata can change the client routes
      if (env.name === 'client' && client) return [...modules, client];
    },
  };
}
