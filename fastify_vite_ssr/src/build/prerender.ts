import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { PassThrough } from 'node:stream';
import { renderToPipeableStream } from 'react-dom/server';
import i18next from 'i18next';
import i18nextBackend from 'i18next-fs-backend';
import { discoverRoutes } from '../serve/routes.js';
import { loadRouteData } from '../serve/loadRouteData.js';
import { serverSideTranslations } from '../utils/serverSideTranslations.js';
import { i18nOptions, languages } from '../services/i18n.shared.js';
import type { InitialProps, RouteData, StaticParams } from '../types';
import dotenv from 'dotenv';

dotenv.config({
  path: path.resolve(process.cwd(), '../.env'),
});

const TITLE = process.env.VITE_APP_NAME ?? 'Fastify Vite';
const RAW_DIST_CLIENT = 'dist/client/';
const RAW_DIST_SSG = 'dist/.ssg/';
const RAW_DIST_SERVER = 'dist/server/';
const DIST_CLIENT = path.resolve(RAW_DIST_CLIENT);
const DIST_SSG = path.resolve(RAW_DIST_SSG);
const DIST_SERVER = path.resolve(RAW_DIST_SERVER);

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

async function createI18n(locale: string) {
  const instance = i18next.createInstance();
  await instance.use(i18nextBackend).init({
    ...i18nOptions,
    initAsync: false,
    preload: languages,
    lng: locale,
    backend: {
      loadPath: 'dist/client/locales/{{ns}}/{{lng}}.json',
    },
  });

  return instance;
}

function formatBytes(bytes: number) {
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(2)} kB`;
  }
  return `${(kb / 1024).toFixed(2)} MB`;
}

function renderToString(element: React.ReactElement) {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const output = new PassThrough();
    output.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    output.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    output.on('error', reject);
    let didError = false;
    const { pipe } = renderToPipeableStream(element, {
      onAllReady() {
        if (!didError) {
          pipe(output);
        }
      },
      onShellError(error) {
        reject(error);
      },
      onError(error) {
        didError = true;
        console.error('SSG render error:', error);
        reject(error);
      },
    });
  });
}

function outputPath(routePath: string, locale: string) {
  if (routePath === '/') {
    return path.join(DIST_SSG, locale, 'index.html');
  }
  return path.join(DIST_SSG, locale, `${routePath.replace(/^\/+/, '')}.html`);
}

function resolveRoutePath(routePath: string, params: Record<string, string>) {
  try {
    return routePath.replace(/:([^/]+)/g, (_, name) => {
      const value = params[name];
      if (value === undefined) {
        throw new Error(
          `${colors.red}/!\\${colors.reset} Missing static parameter ${colors.red}${name}${colors.reset} for ${colors.gray}${routePath}${colors.reset}`
        );
      }
      return encodeURIComponent(value);
    });
  } catch (e) {
    return { error: (e as Error).message };
  }
}

function getRouteParams(routePath: string): string[] {
  return [...routePath.matchAll(/:([^/]+)/g)].map((match) => match[1]);
}

async function renderRoute({
  route,
  routePath,
  render,
  template,
  i18n,
}: {
  route: Awaited<ReturnType<typeof discoverRoutes>>[number];
  routePath: string;
  render: Function;
  template: string;
  i18n: any;
}) {
  const fakeRequest: any = {
    raw: {
      url: routePath,
      headers: {
        host: 'localhost',
      },
    },
    url: routePath,
    i18n,
    cookies: {},
    headers: {},
    method: 'GET',
    setCookie: () => {},
  };
  const fakeReply: any = {
    setCookie: () => fakeReply,
    removeHeader: () => {},
  };
  const match = (await import('react-router')).matchPath(
    {
      path: route.path,
      end: true,
    },
    routePath
  );
  if (!match) {
    throw new Error(`Could not match ${routePath} against ${route.path}`);
  }
  const result = await loadRouteData({
    route,
    request: fakeRequest,
    reply: fakeReply,
    params: match.params,
  });

  if (result.redirect) {
    throw new Error(
      `SSG route ${routePath} attempted to redirect to ${result.redirect.url}. ` +
        `Static redirects should be handled separately.`
    );
  }

  const initialProps = {} as InitialProps;
  if (result.i18nStore && result.language) {
    initialProps.initialI18nStore = result.i18nStore as any;
    initialProps.initialLanguage = result.language;
    initialProps.initialNS = ['translations'];
  } else {
    const sst = serverSideTranslations({
      i18n,
      ns: ['translations'],
    });
    initialProps.initialI18nStore = sst.i18nStore;
    initialProps.initialLanguage = sst.language;
    initialProps.initialNS = ['translations'];
  }

  const routeData: RouteData = {
    data: result.data,
    title: result.title,
  };
  const element = await render({
    req: {
      url: routePath,
    },
    i18n,
    props: routeData,
  });
  const html = await renderToString(element);
  const [htmlStart, htmlEnd] = template.split('<!--app-html-->');

  const script =
    `<script>` +
    `window.__SSR__=true;` +
    `window.__INITIAL_PROPS__=${JSON.stringify(initialProps)};` +
    `window.__ROUTE_DATA__=${JSON.stringify({
      [route.path]: routeData,
    })};` +
    `</script>`;

  return (
    htmlStart
      .replace('<!--app-title-->', result.title ?? TITLE)
      .replace('<!--app-static-props-->', '') +
    html +
    script +
    htmlEnd
  );
}

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
  const routes = await discoverRoutes();
  const ssgRoutes = routes.filter((route) => route.mode === 'ssg');
  if (!ssgRoutes.length) {
    return;
  }
  console.log(
    `\n${colors.blue}SSG${colors.reset} ${colors.green}building ssg for production...${colors.reset}`
  );
  const moduleMessages: ModuleMessage[] = [];
  const startTime = Date.now();
  const template = await fs.readFile(
    path.join(DIST_CLIENT, 'index.html'),
    'utf8'
  );
  const { render } = await import(
    pathToFileURL(path.join(DIST_SERVER, 'entry-server.js')).href
  );
  for (const route of ssgRoutes) {
    const pageModule = await import(pathToFileURL(route.filePath).href);
    const paramNames = getRouteParams(route.path);
    if (paramNames.length === 0) {
      for (const locale of languages) {
        const i18n = await createI18n(locale);
        const html = await renderRoute({
          route,
          routePath: route.path,
          render,
          template,
          i18n,
        });
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

    let staticParams: StaticParams[] = [];
    if (pageModule.generateStaticParams) {
      staticParams = await pageModule.generateStaticParams();
    }
    const errorGen = new Set<string>();
    let missingCount = 0;
    for (const entry of staticParams) {
      const routePath = resolveRoutePath(route.path, entry);
      if (typeof routePath !== 'string') {
        errorGen.add(routePath.error);
        missingCount++;
        continue;
      }
      for (const locale of languages) {
        const i18n = await createI18n(locale);
        const html = await renderRoute({
          route,
          routePath,
          render,
          template,
          i18n,
        });
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
        message: `${colors.green}${staticParams.length - missingCount}${colors.reset} out of ${colors.red}${staticParams.length}${colors.reset} path${staticParams.length > 1 ? 's' : ''} on ${colors.gray}${route.path}${colors.reset} has been generated`,
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
  for (const modMsg of moduleMessages) {
    if (modMsg.type === 'error') {
      console.log(modMsg.message);
    } else {
      console.log(
        `${colors.gray}${RAW_DIST_SSG}${colors.reset}` +
          `${colors.green}${modMsg.location.padEnd(offset)}${colors.reset} ` +
          `${colors.gray}${colors.bold}${formatBytes(modMsg.size)}${colors.reset} ${colors.gray}│ gzip: ${formatBytes(modMsg.gzipSize)}${colors.reset}`
      );
    }
  }
  console.log(
    `\n${colors.green}✓ built in ${endTime - startTime}ms${colors.reset}\n`
  );
}

main().catch((error) => {
  console.error('SSG build failed:', error);
  process.exit(1);
});
