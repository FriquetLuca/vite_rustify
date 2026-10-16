import path from 'node:path';
import { glob } from 'tinyglobby';
import type { Plugin, ResolvedConfig } from 'vite';

import { getRoutePath } from './getRoutePath.js';
import { normalizeRoutePath } from './normalizeRoutePath.js';
import { compareRoutes } from './compareRoutes.js';
import type { RenderMode } from '../types.js';

const VIRTUAL_MODULE_ID = 'virtual:server-router';
const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`;

const ROUTE_FILE_REGEX = /\.(ssr|ssg|csr)\.(tsx|ts|jsx|js)$/;
const SERVER_FILE_REGEX = /\.server\.(tsx|ts|jsx|js)$/;

interface DiscoveredRoute {
  path: string;
  filePath: string;
  mode: RenderMode;
  serverFilePath?: string;
}

function getMode(file: string): DiscoveredRoute['mode'] {
  const match = file.match(ROUTE_FILE_REGEX);

  return match?.[1] === 'ssg' || match?.[1] === 'csr' ? match[1] : 'ssr';
}

export default function serverRouterPlugin(): Plugin {
  let config: ResolvedConfig;
  let routes: DiscoveredRoute[] = [];

  async function discoverRoutes() {
    const pagesDir = path.resolve(config.root, 'src/pages');

    const files = await glob('**/*.{tsx,ts,jsx,js}', {
      cwd: pagesDir,
      onlyFiles: true,
      dot: false,
    });

    const pageFiles = files.filter((file) => ROUTE_FILE_REGEX.test(file));

    const serverFiles = new Map(
      files
        .filter((file) => SERVER_FILE_REGEX.test(file))
        .map((file) => [
          file.replace(SERVER_FILE_REGEX, ''),
          path.resolve(pagesDir, file),
        ])
    );

    routes = pageFiles
      .map((file) => {
        const pageKey = file.replace(ROUTE_FILE_REGEX, '');
        const absoluteFilePath = path.resolve(pagesDir, file);

        return {
          path: normalizeRoutePath(getRoutePath(pagesDir, absoluteFilePath)),
          filePath: path
            .relative(config.root, absoluteFilePath)
            .split(path.sep)
            .join('/'),
          mode: getMode(file),
          serverFilePath: serverFiles.get(pageKey),
        };
      })
      .sort((a, b) => compareRoutes({ path: a.path }, { path: b.path }));
  }

  function generateModule() {
    const imports: string[] = [];
    const entries: string[] = [];

    routes.forEach((route, index) => {
      let serverFileProperty = '';

      if (route.serverFilePath) {
        imports.push(
          `import * as route${index} from ${JSON.stringify(route.serverFilePath)};`
        );

        serverFileProperty = `serverFile: () => route${index},`;
      }

      entries.push(`{
        path: ${JSON.stringify(route.path)},
        mode: ${JSON.stringify(route.mode)},
        filePath: ${JSON.stringify(route.filePath)},
        ${serverFileProperty}
      }`);
    });

    return `
      ${imports.join('\n')}

      export default [
        ${entries.join(',\n')}
      ];
    `;
  }

  function isRouteRelatedFile(file: string): boolean {
    const normalized = file.replaceAll('\\', '/');

    return (
      normalized.includes('/src/pages/') &&
      /\.(ssr|ssg|csr|server)\.(tsx|ts|jsx|js)$/.test(normalized)
    );
  }

  return {
    name: 'server-router',
    enforce: 'pre',
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    async buildStart() {
      await discoverRoutes();
    },
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID;
      }
    },
    load(id) {
      if (id === RESOLVED_VIRTUAL_MODULE_ID) {
        return generateModule();
      }
    },
    hotUpdate: {
      async handler({ file }) {
        if (!isRouteRelatedFile(file)) {
          return;
        }

        await discoverRoutes();

        const module = this.environment.moduleGraph.getModuleById(
          RESOLVED_VIRTUAL_MODULE_ID
        );

        if (module) {
          this.environment.moduleGraph.invalidateModule(module);
        }

        this.environment.hot.send({
          type: 'full-reload',
        });

        return [];
      },
    },
  };
}
