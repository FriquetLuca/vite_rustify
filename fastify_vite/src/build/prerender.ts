import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { Agent, fetch, Response } from 'undici';
import serverRoutes from '@router/server';
import { resolveRoutePath, getRouteParams } from './routes/index.js';
import {
  ansi,
  createSsgCsp,
  formatBytes,
  type CspResult,
} from './utils/index.js';
import { languages } from '../services/i18n.shared.js';
import type { StaticParams } from '../types';
import type ServerFN from '../server.js';

const ssgDispatcher = new Agent({
  connect: {
    rejectUnauthorized: false,
  },
});
const RAW_DIST = 'dist';
const DIST = path.resolve(RAW_DIST);
const DIST_SERVER = path.join(DIST, 'server/server.js');
const RAW_DIST_SSG = path.join(RAW_DIST, '.ssg');
const DIST_SSG = path.resolve(RAW_DIST_SSG);

const LOG_RAW_DIST_SSG = ansi.blackBright(`${RAW_DIST_SSG}/`);
const LOG_SUCCESS_OP = ansi.green('✓');
const LOG_FAIL_OP = ansi.green('✗');
const LOG_FAIL_PRERENDER = ansi.red('Failed to prerender');

function outputPath(routePath: string, locale: string) {
  if (routePath === '/') {
    return path.join(DIST_SSG, locale, 'index.html');
  }
  return path.join(DIST_SSG, locale, `${routePath.replace(/^\/+/, '')}.html`);
}
function outputRoute(routePath: string, locale: string) {
  if (routePath === '/') {
    return path.join(locale, 'index');
  }
  return path.join(locale, `${routePath.replace(/^\/+/, '')}`);
}
type PageModule = { generateStaticParams?: () => Promise<StaticParams[]> };
type ModuleMessage =
  | {
      type: 'gen';
      output: string;
      location: string;
    }
  | {
      type: 'error';
      message: string;
    };

export default async function main() {
  const routes = serverRoutes;
  const ssgRoutes = routes.filter((route) => route.mode === 'ssg');
  if (!ssgRoutes.length) {
    return;
  }
  const {
    default: Server,
    HOST,
    PORT,
  } = await import(/* @vite-ignore */ pathToFileURL(DIST_SERVER).href);
  const PUBLIC_HOST = process.env.HOST ?? HOST;
  const PUBLIC_PORT = process.env.HTTP_PORT ?? PORT;
  const IS_BINARY_BYTES = process.env.BINARY_BYTES === 'true';
  const BINARY_BYTES_FORMAT = IS_BINARY_BYTES ? 'binary' : 'decimal';
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
  const ssglnk = new Map<
    string,
    { generateStaticParams: (() => Promise<StaticParams[]>) | undefined }
  >();
  for (const route of ssgRoutes) {
    if (ssglnk.has(route.path)) {
      const lnk = ssglnk.get(route.path)!;
      if (!lnk?.generateStaticParams) {
        const pageModule: PageModule = await import(
          /* @vite-ignore */ pathToFileURL(route.filePath).href
        );
        if (pageModule.generateStaticParams) {
          ssglnk.set(route.path, {
            generateStaticParams: pageModule.generateStaticParams,
          });
        }
      }
    } else {
      const pageModule: PageModule = await import(
        /* @vite-ignore */ pathToFileURL(route.filePath).href
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
    `\n${ansi.blue('SSG v1.0.0')} ${ansi.green('building ssg for production...')}`
  );
  const moduleMessages: ModuleMessage[] = [];
  const scriptHashes: ({ path: string } & CspResult)[] = [];
  const startTime = Date.now();
  for (const route of ssgLinks) {
    const errorGen = new Set<string>();
    if (route.params.length === 0) {
      for (const locale of languages) {
        const response = await fetchRoute(route.path, locale);
        if (!response.ok) {
          errorGen.add(
            `${LOG_FAIL_PRERENDER} ${ansi.blackBright(route.path)}: ${response.status} ${response.statusText}`
          );
          continue;
        }
        const html = await response.text();
        const output = outputPath(route.path, locale);
        await fs.mkdir(path.dirname(output), {
          recursive: true,
        });
        await fs.writeFile(output, html, 'utf8');
        scriptHashes.push({
          ...createSsgCsp(html),
          path: outputRoute(route.path, locale),
        });
        moduleMessages.push({
          type: 'gen',
          location: path.relative(DIST_SSG, output),
          output,
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
            `${LOG_FAIL_PRERENDER} ${ansi.blackBright(routePath)}: ${response.status} ${response.statusText}`
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
        scriptHashes.push({
          ...createSsgCsp(html),
          path: outputRoute(routePath, locale),
        });
        moduleMessages.push({
          type: 'gen',
          location: path.relative(DIST_SSG, output),
          output,
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
        message: `${ansi.green(params.length - missingCount)} out of ${ansi.red(params.length)} path${params.length > 1 ? 's' : ''} on ${ansi.blackBright(route.path)} has been generated`,
      });
    }
  }
  await fs.writeFile(
    path.join(DIST, '.ssg.json'),
    JSON.stringify(scriptHashes),
    'utf8'
  );
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
    `${LOG_SUCCESS_OP} ${genCount} module${genCount > 1 ? 's' : ''} transformed.`
  );
  if (errCount > 0) {
    console.log(
      `${LOG_FAIL_OP} ${errCount} module${errCount > 1 ? 's' : ''} failed.`
    );
  }
  console.log('computing gzip size...');
  const generated = moduleMessages.filter((m) => m.type === 'gen');
  for (const modMsg of generated) {
    const html = await fs.readFile(modMsg.output, 'utf8');
    const size = Buffer.byteLength(html, 'utf8');
    const gzipSize = gzipSync(html).byteLength;
    console.log(
      LOG_RAW_DIST_SSG +
        ansi.green(modMsg.location.padEnd(offset)) +
        ' ' +
        ansi.bold.blackBright(formatBytes(size, BINARY_BYTES_FORMAT)) +
        ' ' +
        ansi.blackBright(
          `│ gzip: ${formatBytes(gzipSize, BINARY_BYTES_FORMAT)}`
        )
    );
  }
  moduleMessages
    .filter((m) => m.type === 'error')
    .forEach((modMsg) => console.log(modMsg.message));
  console.log(`\n${ansi.green(`✓ built in ${endTime - startTime}ms`)}\n`);
  await app.close();
  process.exit(errCount > 0 ? 1 : 0);
}
