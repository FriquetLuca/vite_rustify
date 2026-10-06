import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import Fastify from 'fastify';
import middie from '@fastify/middie';
import cookie from '@fastify/cookie';
import i18next from 'i18next';
import i18nextBackend from 'i18next-fs-backend';
import * as i18nextMiddleware from 'i18next-http-middleware';
import { matchPath } from 'react-router';
import dotenv from 'dotenv';
import type { ViteDevServer } from 'vite';
import { i18nOptions, languages } from './services/i18n.shared.js';
import { discoverRoutes } from './serve/routes.js';
import { loadRouteData } from './serve/loadRouteData.js';
import { renderSSR } from './serve/renderSSR.js';
import { renderCSR } from './serve/renderCSR.js';
import { resolveLocale } from './serve/locale.js';
import { getIPs } from './serve/getIPs.js';
import { deduplicateRoutes } from './serve/deduplicateRoutes.js';

dotenv.config({
  path: path.resolve(process.cwd(), '../.env'),
});

const isSSG = process.env.SSG_GEN === 'true';
const isProduction = process.env.NODE_ENV === 'production';
const TITLE = process.env.VITE_APP_NAME ?? 'Fastify Vite';
const BASE = process.env.VITE_BASE_PATH ?? '/';
export const HOST = process.env.VITE_HOST ?? '0.0.0.0';
export const PORT = process.env.VITE_PORT
  ? Number(process.env.VITE_PORT)
  : 5173;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FS_CLIENT = path.join(__dirname, 'client/index.html');
const FS_TEMPLATE = path.join(__dirname, '../index.html');

export default async function Server() {
  i18next
    .use(i18nextBackend)
    .use(i18nextMiddleware.LanguageDetector)
    .init({
      ...i18nOptions,
      initAsync: false,
      preload: languages,
      detection: {
        order: ['subdomain', 'cookie', 'header'],
        caches: ['cookie'],
        lookupCookie: 'i18next',
      },
      backend: {
        loadPath: isProduction
          ? 'dist/client/locales/{{ns}}/{{lng}}.json'
          : 'public/locales/{{ns}}/{{lng}}.json',
      },
    });

  const app = Fastify();

  await app.register(middie);
  await app.register(cookie);
  await app.register(i18nextMiddleware.plugin, {
    i18next,
  });

  const routes = deduplicateRoutes(await discoverRoutes());
  console.log(routes);
  let vite: ViteDevServer | undefined;

  if (isProduction) {
    const sirv = (await import('sirv')).default;
    await app.register(import('@fastify/compress'), {
      global: false,
    });
    app.use(
      BASE,
      sirv(path.join(__dirname, 'client'), {
        extensions: [],
        gzip: true,
        brotli: true,
      })
    );
  } else {
    const { createServer } = await import('vite');
    vite = await createServer({
      server: {
        middlewareMode: true,
      },
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
    app.get('/.well-known/*', async () => ({
      workspace: {
        root: process.cwd(),
        uuid,
      },
    }));
  } else {
    app.get('/.well-known/*', (_, reply) => {
      reply.code(404).send();
    });
  }

  app.get('/__data/*', async (request, reply) => {
    const routePath = request.url.replace('/__data', '').split('?')[0];
    const route = routes.find((candidate) => candidate.path === routePath);
    if (!route?.serverFilePath) {
      return {};
    }
    const match = matchPath(
      {
        path: route.path,
        end: true,
      },
      routePath
    );
    if (!match) {
      return {};
    }
    const result = await loadRouteData({
      route,
      request,
      reply,
      params: match.params,
    });
    if (result.redirect) {
      return reply.redirect(
        result.redirect.url,
        result.redirect.statusCode ?? 301
      );
    }
    return {
      data: result.data,
      title: result.title ?? TITLE,
    };
  });

  app.all('*', async (request, reply) => {
    try {
      const pathname = request.url.split('?')[0];
      if (isProduction) {
        const locale = resolveLocale(request.headers.host ?? '', request.i18n);
        const reqURL = pathname === '/' ? '/index' : pathname;
        const staticLocation = path.join(
          __dirname,
          `.ssg/${locale}${reqURL}.html`
        );
        if (fs.existsSync(staticLocation)) {
          const html = fs.readFileSync(staticLocation, 'utf8');
          return reply.code(200).type('text/html; charset=utf-8').send(html);
        }
      }

      const route = routes.find((candidate) =>
        matchPath(
          {
            path: candidate.path,
            end: true,
          },
          pathname
        )
      );

      if (!route) {
        return reply
          .code(404)
          .type('text/html')
          .send('<h1>404 - Not Found</h1>');
      }

      const mode = !isProduction && route.mode === 'ssg' ? 'ssr' : route.mode;

      if (mode === 'csr' || mode === 'ssg') {
        let template: string;
        if (!isProduction) {
          template = fs.readFileSync(FS_TEMPLATE, 'utf8');
          template = await vite!.transformIndexHtml(request.url, template);
        } else {
          template = fs.readFileSync(FS_CLIENT, 'utf8');
        }
        return renderCSR({
          request,
          reply,
          template,
        });
      }

      let template: string;
      let render: Function;

      if (!isProduction) {
        template = fs.readFileSync(FS_TEMPLATE, 'utf8');
        template = await vite!.transformIndexHtml(request.url, template);
        render = (await vite!.ssrLoadModule('/src/renderer/entry-server.tsx'))
          .render;
      } else {
        template = fs.readFileSync(FS_CLIENT, 'utf8');
        // @ts-expect-error - built file exists only in production
        render = (await import('./render/entry-server.js')).render;
      }

      return renderSSR({
        request,
        reply,
        route,
        render,
        template,
      });
    } catch (error) {
      if (vite) {
        vite.ssrFixStacktrace(error as Error);
      }
      if (
        error instanceof Response &&
        error.status >= 300 &&
        error.status <= 399
      ) {
        const location = error.headers.get('Location');
        error.headers.forEach((value, key) => {
          reply.header(key, value);
        });
        if (!location) {
          return reply.code(error.status).send();
        }
        return reply.redirect(location, error.status);
      }
      console.error(error);
      if (!reply.sent) {
        return reply
          .code(500)
          .send(isProduction ? 'Server error' : String(error));
      }
    }
  });

  await app.listen({
    port: PORT,
    host: HOST,
  });

  return app;
}

if (!isSSG) {
  Server();

  console.log(
    'Server running at either:',
    [...getIPs('IPv4').filter((host) => host !== HOST), HOST]
      .map((host) => `http://${host}:${PORT}`)
      .join(', ')
  );
}
