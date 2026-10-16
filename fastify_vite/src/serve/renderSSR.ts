import { Transform } from 'node:stream';
import crypto from 'node:crypto';
import { renderToPipeableStream } from 'react-dom/server';
import { type PathMatch } from 'react-router';
import { loadRouteData } from './loadRouteData.js';
import { serverSideTranslations } from '../utils/serverSideTranslations.js';
import { IS_SSG } from './environment.js';
import { getRender } from './getRender.js';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { InitialProps, RouteData } from '../types';
import type { ServerRoute } from 'virtual:server-router';
import type { ViteDevServer } from 'vite';

const IS_SECURE = __IS_PRODUCTION__ && !IS_SSG;
const ABORT_DELAY = process.env.VITE_ABORT_DELAY
  ? Number(process.env.VITE_ABORT_DELAY)
  : 10000;

interface RenderSSRProps {
  request: FastifyRequest;
  reply: FastifyReply;
  route: ServerRoute;
  pathMatch: PathMatch<string>;
  template: string;
  title: string;
  vite?: ViteDevServer;
  serverErrorPage: string;
  appStaticProps?: string;
}

export async function renderSSR({
  request,
  reply,
  route,
  pathMatch,
  template,
  title,
  vite,
  serverErrorPage,
  appStaticProps = '',
}: RenderSSRProps) {
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
  const initialProps = {} as InitialProps;
  if (result.i18nStore && result.language) {
    initialProps.initialI18nStore = result.i18nStore as any;
    initialProps.initialLanguage = result.language;
    initialProps.initialNS = ['translations'];
  } else {
    const sst = serverSideTranslations({
      i18n: request.i18n,
      ns: ['translations'],
      host: request.headers.host,
    });
    initialProps.initialI18nStore = sst.i18nStore;
    initialProps.initialLanguage = sst.language;
    initialProps.initialNS = ['translations'];
  }
  const routeData: RouteData = {
    data: result.data,
    title: result.title,
  };
  const scriptContent =
    `window.__SSR__=true;` +
    `window.__INITIAL_PROPS__=${JSON.stringify(initialProps)};` +
    `window.__ROUTE_DATA__=${JSON.stringify({
      [route.path]: routeData,
    })};`;
  const nonce = IS_SECURE
    ? crypto.randomBytes(16).toString('base64')
    : undefined;
  let script: string;
  let scriptCsp: string | undefined;
  if (IS_SECURE) {
    script = `<script nonce="${nonce}">` + scriptContent + '</script>';
    scriptCsp = `'nonce-${nonce}'`;
  } else {
    script = '<script>' + scriptContent + '</script>';
  }
  const render = await getRender(vite);
  const element = await render({
    req: request,
    res: reply,
    i18n: request.i18n,
    props: routeData,
    nonce,
  });
  const res = reply.raw;
  const { pipe, abort } = renderToPipeableStream(element, {
    onShellError() {
      if (!reply.sent) {
        reply
          .code(500)
          .type('text/html; charset=utf-8')
          .send(serverErrorPage);
      }
    },
    onShellReady() {
      if (IS_SECURE) {
        const csp = [
          "default-src 'self'",
          `script-src 'self' ${scriptCsp}`,
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https:",
          "font-src 'self' data:",
        ].join('; ');
        res.writeHead(result.statusCode, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Security-Policy': csp,
        });
      } else {
        res.writeHead(result.statusCode, {
          'Content-Type': 'text/html; charset=utf-8',
        });
      }
      const [htmlStart, htmlEnd] = template.split('<!--app-html-->');
      res.write(
        htmlStart
          .replace('<!--app-title-->', result.title ?? title)
          .replace('<!--app-static-props-->', appStaticProps),
        'utf8'
      );
      const transform = new Transform({
        transform(chunk, _encoding, callback) {
          res.write(chunk.toString(), 'utf8');
          callback();
        },
      });
      transform.on('finish', () => {
        res.write(script + htmlEnd, 'utf8');
        res.end();
      });
      pipe(transform);
    },
    onError(error) {
      console.error('Render error:', error);
    },
  });
  setTimeout(() => abort(), ABORT_DELAY);
}
