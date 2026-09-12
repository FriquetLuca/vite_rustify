import Fastify from 'fastify';
import middie from '@fastify/middie';
import cookie from '@fastify/cookie';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { renderToPipeableStream } from 'react-dom/server';
import { Transform } from 'node:stream';
import i18next from 'i18next';
import i18nextBackend from 'i18next-fs-backend';
import * as i18nextMiddleware from 'i18next-http-middleware';
import { matchPath } from 'react-router';
import type { InitialProps, StaticProps } from './types';
import { serverSideTranslations } from './utils/serverSideTranslations.js';
import { i18nOptions, languages } from './services/i18n.shared.js';
import crypto from 'crypto';
import fg from 'fast-glob';
import type { ViteDevServer } from 'vite';
import os from 'os';
import dotenv from 'dotenv';

dotenv.config({
  path: path.resolve(process.cwd(), '../.env'),
});

const interfaces = os.networkInterfaces();

const getIP = (family: 'IPv4' | 'IPv6'): string[] => {
  const result = [];
  for (const k in interfaces) {
    for (const k2 in interfaces[k]) {
      const intr = interfaces[k];
      if (intr) {
        const address: os.NetworkInterfaceInfo = intr[Number(k2)];
        if (address && address.family === family) {
          result.push(address.address);
        }
      }
    }
  }
  return result;
};

const isProduction = process.env.NODE_ENV === 'production';
const TITLE = process.env?.VITE_APP_NAME ?? 'Fastify Vite SSR';
const HOST = process.env?.VITE_HOST ?? '0.0.0.0';
const BASE = process.env?.VITE_BASE_PATH ?? '/';
const PORT = process.env?.VITE_PORT ? Number(process.env.VITE_PORT) : 5173;

const ABORT_DELAY = process.env?.VITE_ABORT_DELAY
  ? Number(process.env.VITE_ABORT_DELAY)
  : 10000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

i18next
  .use(i18nextBackend)
  .use(i18nextMiddleware.LanguageDetector)
  .init({
    initAsync: false,
    preload: languages,
    detection: {
      // order and from where user language should be detected
      order: ['cookie', 'header'], // Look at cookies first, then headers
      caches: ['cookie'],
      lookupCookie: 'i18next',
    },
    backend: {
      loadPath: isProduction
        ? 'dist/client/locales/{{ns}}/{{lng}}.json'
        : 'public/locales/{{ns}}/{{lng}}.json',
    },
    ...i18nOptions,
  });

const templateHtml = isProduction
  ? fs.readFileSync('./dist/client/index.html', 'utf-8')
  : '';

const routeFiles = await (isProduction
  ? fg('dist/pages/**/*.server.js')
  : fg('src/pages/**/*.server.tsx'));
const routes = routeFiles.map((file) => {
  let name =
    file.match(
      isProduction
        ? /^dist\/pages\/(.*)\.server\.js$/
        : /^src\/pages\/(.*)\.server\.tsx$/
    )?.[1] || '';
  name = name
    .replace(/\[([^\]]+)\]/g, ':$1')
    .replace(/\/index$/, '')
    .replace(/^index$/, '');
  const routePath = `/${name}`;
  return {
    path: routePath,
    filePath: path.resolve(file),
  };
});

const app = Fastify();
await app.register(middie);
await app.register(cookie);
await app.register(i18nextMiddleware.plugin, {
  i18next,
});

let vite: ViteDevServer;

if (isProduction) {
  const sirv = (await import('sirv')).default;
  await app.register(import('@fastify/compress'), { global: false });
  app.use(
    BASE,
    sirv('./dist/client', { extensions: [], gzip: true, brotli: true })
  );
} else {
  const { createServer } = await import('vite');
  vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    base: BASE,
  });
  app.use(vite.middlewares);
}

if (!isProduction) {
  const uuid = crypto
    .createHash('md5')
    .update(process.cwd())
    .digest('hex')
    .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
  app.get('/.well-known/*', async () => {
    return {
      workspace: {
        root: process.cwd(),
        uuid,
      },
    };
  });
} else {
  app.get('/.well-known/*', (_, reply) => {
    reply.code(404).send();
  });
}

app.get('/__data/*', async (request, reply) => {
  const routePath = request.url.replace('/__data', '');
  const route = routes.find((r) => r.path === routePath);

  if (!route) {
    return {};
  }

  const pageModule = await import(route.filePath);

  if (!pageModule.default) {
    return {};
  }

  const fullUrl = new URL(
    request.raw.url ?? '/',
    `http://${request.raw.headers.host}`
  );

  const queryParams = Object.fromEntries(fullUrl.searchParams.entries());
  const data = await (pageModule.default({
    ...request,
    routePath,
    queryParams,
    i18n: null,
    setCookie: reply.setCookie,
  }) as StaticProps);
  if (data?.removeHeaders) {
    data.removeHeaders.forEach((h) => reply.removeHeader(h));
  }
  if (data?.redirect) {
    return reply.redirect(data.redirect.url, data.redirect?.statusCode || 301);
  }
  return {
    data: data?.data,
    title: data?.title ?? TITLE,
  };
});

// Catch-all route
app.all('*', async (request, reply) => {
  const req = request.raw;
  const res = reply.raw;
  try {
    /** @type {string} */
    let template;
    /** @type {import('./renderer/entry-server.tsx').render} */
    let render;

    if (!isProduction) {
      template = fs.readFileSync(
        path.resolve(__dirname, '../index.html'),
        'utf-8'
      );
      template = await vite.transformIndexHtml(request.url, template);
      render = (await vite.ssrLoadModule('/src/renderer/entry-server.tsx'))
        .render;
    } else {
      template = templateHtml;
      // @ts-expect-error - built file exists only in production
      render = (await import('./server/entry-server.js')).render;
    }
    const props = {} as InitialProps;
    let data: unknown = {};

    let routePath = req.url ?? '/';
    let title = TITLE;
    let matchedStaticProps = false;

    for (const route of routes) {
      const match = matchPath({ path: route.path, end: true }, request.url);

      if (!match) continue;

      routePath = route.path;

      const pageModule = await import(
        /* @vite-ignore */
        route.filePath
      );

      if (pageModule.default) {
        const fullUrl = new URL(request.url, `http://${req.headers.host}`);

        const queryParams = Object.fromEntries(fullUrl.searchParams.entries());

        const result = await (pageModule.default({
          ...request,
          routePath: match.params,
          queryParams,
          setCookie: reply.setCookie,
        }) as StaticProps);
        if (result?.removeHeaders) {
          result.removeHeaders.forEach((h) => reply.removeHeader(h));
        }
        if (result?.redirect) {
          return reply.redirect(
            result.redirect.url,
            result.redirect?.statusCode || 301
          );
        }

        data = result?.data || data;
        title = result?.title ?? title;
        if (result?.i18nStore && result?.language) {
          props.initialI18nStore = result.i18nStore;
          props.initialLanguage = result.language;
          matchedStaticProps = true;
        }
      }
      break;
    }
    if (!matchedStaticProps) {
      const sst = serverSideTranslations({
        i18n: request.i18n,
        ns: ['translations'],
      });
      props.initialI18nStore = sst.i18nStore;
      props.initialLanguage = sst.language;
    }
    const propData = { data, title };
    const { pipe, abort } = renderToPipeableStream(
      await render({ req, i18n: request.i18n, props: propData }),
      {
        onShellError() {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          reply.send('<h1>Something went wrong</h1>');
        },
        onShellReady() {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          const [htmlStart, htmlEnd] = template.split(`<!--app-html-->`);
          res.write(
            htmlStart
              .replace('<!--app-title-->', title)
              .replace('<!--app-static-props-->', ''),
            'utf-8'
          );

          const transformStream = new Transform({
            transform(chunk, _, callback) {
              chunk = chunk.toString();
              res.write(chunk, 'utf-8');
              callback();
            },
          });

          transformStream.on('finish', () => {
            const serializedLang = `<script>window.__INITIAL_PROPS__ = ${JSON.stringify(props)};window.__ROUTE_DATA__ = {"${routePath}":${JSON.stringify(propData)}};</script>`;
            res.write(serializedLang + htmlEnd, 'utf-8');
            res.end();
          });

          pipe(transformStream);
        },
        onError(err) {
          console.error('Render error:', err);
          reply.code(500).send('Server error');
        },
      }
    );
    setTimeout(() => abort(), ABORT_DELAY);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    vite?.ssrFixStacktrace?.(e);
    console.error(e.stack);
    reply.code(500).send(e.stack);
  }
});

app.listen({ port: PORT, host: HOST });

console.log(
  'Server running at either:',
  [...getIP('IPv4').filter((h) => h !== HOST), HOST]
    .map((h) => `http://${h}:${PORT}`)
    .join(', ')
);
