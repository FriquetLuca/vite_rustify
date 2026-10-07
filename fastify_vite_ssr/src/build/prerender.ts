import { Agent, fetch, Response } from 'undici';
import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { discoverRoutes } from '../serve/routes.js';
import { languages } from '../services/i18n.shared.js';
import type { StaticParams } from '../types';
import { resolveRoutePath, getRouteParams } from '../serve/resolveRoutePath.js';
import type ServerFN from '../server.js';

const ssgDispatcher = new Agent({
  connect: {
    rejectUnauthorized: false,
  },
});
const RAW_DIST_SSG = 'dist/.ssg/';
const DIST_SSG = path.resolve(RAW_DIST_SSG);
const DIST_SERVER = path.resolve('dist/server.js');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
};

function formatBytes(bytes: number) {
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(2)} kB`;
  }
  return `${(kb / 1024).toFixed(2)} MB`;
}

function outputPath(routePath: string, locale: string) {
  if (routePath === '/') {
    return path.join(DIST_SSG, locale, 'index.html');
  }
  return path.join(DIST_SSG, locale, `${routePath.replace(/^\/+/, '')}.html`);
}
type PageModule = { generateStaticParams?: () => Promise<StaticParams[]> };
type ModuleMessage =
  | {
      type: 'gen';
      location: string;
      size: number;
      gzipSize: number;
    }
  | {
      type: 'error';
      message: string;
    };

async function main() {
  const {
    default: Server,
    HOST,
    PORT,
  } = await import(pathToFileURL(DIST_SERVER).href);
  const PUBLIC_HOST = process.env.HOST ?? HOST;
  const PUBLIC_PORT = process.env.HTTP_PORT ?? PORT;
  const LOCATION = `http://${PUBLIC_HOST}:${PUBLIC_PORT}`;
  const fetchRoute = async (url: string, locale: string) => {
    try {
      return await fetch(`${LOCATION}${url}`, {
        dispatcher: ssgDispatcher,
        headers: {
          'accept-language': locale,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return new Response(
        `SSG request failed for ${url} (${locale}): ${message}`,
        {
          status: 502,
          statusText: 'Bad Gateway',
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        }
      );
    }
  };
  const app = await (Server as typeof ServerFN)();
  const routes = await discoverRoutes();
  const ssgRoutes = routes.filter((route) => route.mode === 'ssg');
  if (!ssgRoutes.length) {
    return;
  }
  const ssglnk = new Map<
    string,
    { generateStaticParams: (() => Promise<StaticParams[]>) | undefined }
  >();
  for (const route of ssgRoutes) {
    if (ssglnk.has(route.path)) {
      const lnk = ssglnk.get(route.path)!;
      if (!lnk?.generateStaticParams) {
        const pageModule: PageModule = await import(
          pathToFileURL(route.filePath).href
        );
        if (pageModule.generateStaticParams) {
          ssglnk.set(route.path, {
            generateStaticParams: pageModule.generateStaticParams,
          });
        }
      }
    } else {
      const pageModule: PageModule = await import(
        pathToFileURL(route.filePath).href
      );
      if (pageModule.generateStaticParams) {
        ssglnk.set(route.path, {
          generateStaticParams: pageModule.generateStaticParams,
        });
      } else {
        ssglnk.set(route.path, { generateStaticParams: undefined });
      }
    }
  }
  const ssgLinks = [...ssglnk].map(([path, { generateStaticParams }]) => ({
    path,
    params: getRouteParams(path),
    generateStaticParams,
  }));

  console.log(
    `\n${colors.blue}SSG v1.0.0${colors.reset} ${colors.green}building ssg for production...${colors.reset}`
  );
  const moduleMessages: ModuleMessage[] = [];
  const startTime = Date.now();
  for (const route of ssgLinks) {
    const errorGen = new Set<string>();
    if (route.params.length === 0) {
      for (const locale of languages) {
        const response = await fetchRoute(route.path, locale);
        if (!response.ok) {
          errorGen.add(
            `${colors.red}Failed to prerender${colors.reset} ${colors.gray}${route.path}${colors.reset}: ${response.status} ${response.statusText}`
          );
          continue;
        }
        const html = await response.text();
        const output = outputPath(route.path, locale);
        await fs.mkdir(path.dirname(output), {
          recursive: true,
        });
        await fs.writeFile(output, html, 'utf8');
        const size = Buffer.byteLength(html, 'utf8');
        const gzipSize = gzipSync(html).byteLength;
        moduleMessages.push({
          type: 'gen',
          location: path.relative(DIST_SSG, output),
          size,
          gzipSize,
        });
      }
      continue;
    }
    if (route.params.length > 0 && !route.generateStaticParams) {
      errorGen.add(
        `No "generateStaticParams" function has been found for the route ${route.path} but it requires parameters.`
      );
      continue;
    }
    let missingCount = 0;
    const params = await route.generateStaticParams!();
    for (const entry of params) {
      const routePath = resolveRoutePath(route.path, entry);
      if (typeof routePath !== 'string') {
        errorGen.add(routePath.error);
        missingCount++;
        continue;
      }
      let hasMissed = false;
      for (const locale of languages) {
        const response = await fetchRoute(routePath, locale);
        if (!response.ok) {
          errorGen.add(
            `${colors.red}Failed to prerender${colors.reset} ${colors.gray}${routePath}${colors.reset}: ${response.status} ${response.statusText}`
          );
          hasMissed = true;
          continue;
        }
        const html = await response.text();
        const output = outputPath(routePath, locale);
        await fs.mkdir(path.dirname(output), {
          recursive: true,
        });
        await fs.writeFile(output, html, 'utf8');
        const size = Buffer.byteLength(html, 'utf8');
        const gzipSize = gzipSync(html).byteLength;
        moduleMessages.push({
          type: 'gen',
          location: path.relative(DIST_SSG, output),
          size,
          gzipSize,
        });
      }
      if (hasMissed) {
        missingCount++;
      }
    }
    if (errorGen.size > 0) {
      errorGen.forEach((e) =>
        moduleMessages.push({
          type: 'error',
          message: e,
        })
      );
      moduleMessages.push({
        type: 'error',
        message: `${colors.green}${params.length - missingCount}${colors.reset} out of ${colors.red}${params.length}${colors.reset} path${params.length > 1 ? 's' : ''} on ${colors.gray}${route.path}${colors.reset} has been generated`,
      });
    }
  }
  const endTime = Date.now();
  const genCount = moduleMessages.reduce(
    (prev, curr) => (curr.type !== 'error' ? prev + 1 : prev),
    0
  );
  const genLen =
    moduleMessages.reduce(
      (prev, curr) =>
        curr.type !== 'error' ? Math.max(curr.location.length, prev) : prev,
      0
    ) + RAW_DIST_SSG.length;
  const offset = genLen + Math.min(5, 10 - (genLen % 10));
  const errCount = moduleMessages.reduce(
    (prev, curr) => (curr.type === 'error' ? prev + 1 : prev),
    0
  );
  console.log(
    `${colors.green}✓${colors.reset} ${genCount} module${genCount > 1 ? 's' : ''} transformed.`
  );
  if (errCount > 0) {
    console.log(
      `${colors.red}✗${colors.reset} ${errCount} module${errCount > 1 ? 's' : ''} failed.`
    );
  }
  moduleMessages
    .filter((m) => m.type === 'gen')
    .forEach((modMsg) =>
      console.log(
        `${colors.gray}${RAW_DIST_SSG}${colors.reset}` +
          `${colors.green}${modMsg.location.padEnd(offset)}${colors.reset} ` +
          `${colors.gray}${colors.bold}${formatBytes(modMsg.size)}${colors.reset} ${colors.gray}│ gzip: ${formatBytes(modMsg.gzipSize)}${colors.reset}`
      )
    );
  moduleMessages
    .filter((m) => m.type === 'error')
    .forEach((modMsg) => console.log(modMsg.message));
  console.log(
    `\n${colors.green}✓ built in ${endTime - startTime}ms${colors.reset}\n`
  );
  await app.close();
  process.exit(1);
}

main().catch((error) => {
  console.error('SSG build failed:', error);
  process.exit(1);
});
