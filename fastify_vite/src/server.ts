import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import Fastify from 'fastify';
import middie from '@fastify/middie';
import cookie from '@fastify/cookie';
import i18next from 'i18next';
import i18nextBackend from 'i18next-fs-backend';
import * as i18nextMiddleware from 'i18next-http-middleware';
import { i18nOptions, languages } from './services/i18n.shared.js';
import { loadSSGManifest } from './serve/loadSSGManifest.js';
import { loadRouteData } from './serve/loadRouteData.js';
import { renderSSR } from './serve/renderSSR.js';
import { resolveLocale } from './serve/resolveLocale.js';
import { getIPs } from './serve/getIPs.js';
import { deduplicateRoutes } from './serve/deduplicateRoutes.js';
import {
  BASE,
  HOST,
  IS_SSG,
  PORT,
  TITLE,
} from './serve/environment.js';
import type { ViteDevServer } from 'vite';
import { FileCache } from './serve/fileCache.js';
import serverRoutes from 'virtual:server-router';
import { loadHTMLTemplate } from './serve/loadHTMLTemplate.js';
import { matchRoute } from './serve/matchRoute.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FS_CLIENT = path.join(__dirname, '../client/index.html');
const FS_TEMPLATE = path.join(__dirname, '../index.html');
const SSG_MANIFEST = path.join(__dirname, '../.ssg.json');
const ssgManifest = loadSSGManifest(SSG_MANIFEST);
const ssgCache = new FileCache();

interface ServerProps {
  vite?: ViteDevServer;
}

export default async function Server({ vite }: ServerProps = {}) {
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
        loadPath: __IS_PRODUCTION__
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

  const routes = deduplicateRoutes(serverRoutes);
  if (__IS_PRODUCTION__) {
    const sirv = (await import('sirv')).default;
    await app.register(import('@fastify/compress'), {
      global: false,
    });
    app.use(
      BASE,
      sirv(path.join(__dirname, '../client'), {
        extensions: [],
        gzip: true,
        brotli: true,
      })
    );
  } else {
    if (vite?.middlewares) {
      app.use(vite.middlewares);
    }
  }

  if (!__IS_PRODUCTION__) {
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
    const [route, pathMatch] = matchRoute(
      routePath,
      routes
    );
    if (!route || !pathMatch || !route?.serverFile) {
      return {};
    }
    const result = await loadRouteData({
      route,
      request,
      reply,
      params: pathMatch.params,
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

  const serverErrorPage = '<h1>Error 500: Something went wrong</h1>';

  app.all('*', async (request, reply) => {
    try {
      const pathname = request.url.split('?')[0];
      if (__IS_PRODUCTION__ && !IS_SSG) {
        const locale = resolveLocale(request.headers.host ?? '', request.i18n);
        const reqURL = pathname === '/' ? '/index' : pathname;
        const ssrPath = `${locale}${reqURL}`;
        const manifest = ssgManifest.find((m) => m.path === ssrPath);
        const staticLocation = path.join(__dirname, `.ssg/${ssrPath}.html`);
        const html = await ssgCache.get(staticLocation);
        if (html !== undefined) {
          return reply
            .code(200)
            .type('text/html; charset=utf-8')
            .header('Content-Security-Policy', manifest?.header)
            .send(html);
        }
      }
      const [route, pathMatch] = matchRoute(pathname, routes);
      const template = await loadHTMLTemplate({
        location: __IS_PRODUCTION__ ? FS_CLIENT : FS_TEMPLATE,
        request,
        vite,
      });
      const noRoute = !route || !pathMatch;
      if (noRoute || route.mode === 'csr') {
        return reply
          .code(noRoute ? 404 : 200)
          .type('text/html; charset=utf-8')
          .send(
            template
              .replace('<!--app-html-->', '')
              .replace('<!--app-title-->', TITLE)
              .replace('<!--app-static-props-->', '')
          );
      }      
      return renderSSR({
        request,
        reply,
        route,
        pathMatch,
        vite,
        template,
        title: TITLE,
        serverErrorPage,
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
          .type('text/html; charset=utf-8')
          .send(__IS_PRODUCTION__ ? serverErrorPage : String(error));
      }
    }
  });

  await app.listen({
    port: PORT,
    host: HOST,
  });

  return app;
}

if (!IS_SSG) {
  Server();

  if(!__IS_PRODUCTION__) {
    console.log(
      'Server running at either:',
      [...getIPs('IPv4').filter((host) => host !== HOST), HOST]
        .map((host) => `http://${host}:${PORT}`)
        .join(', ')
    );
  }
}
