import { Transform } from 'node:stream';
import { renderToPipeableStream } from 'react-dom/server';
import { type PathMatch } from 'react-router';
import { loadRouteData } from './loadRouteData.js';
import { defaultLanguage } from '../services/i18n.shared.js';
import { serverSideTranslations } from './serverSideTranslations.js';
import { getRender } from './getRender.js';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { InitialProps, RouteData } from '../types';
import type { ServerRoute } from '@router/server';
import type { ViteDevServer } from 'vite';
import { contentSecurityPolicy } from './contentSecurityPolicy.js';

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
  const sst = serverSideTranslations({
    i18n: request.i18n,
    ns: result.i18nNS ?? ['translations'],
    host: request.headers.host,
  });
  initialProps.initialI18nStore = sst.i18nStore ?? {};
  initialProps.initialLanguage = sst.language ?? defaultLanguage;
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
  const csp = contentSecurityPolicy(scriptContent);
  const render = await getRender(vite);
  const element = await render({
    req: request,
    res: reply,
    i18n: request.i18n,
    props: routeData,
    nonce: csp.nonce,
  });
  const res = reply.raw;
  const { pipe, abort } = renderToPipeableStream(element, {
    onShellError() {
      if (!reply.sent) {
        reply.code(500).type('text/html; charset=utf-8').send(serverErrorPage);
      }
    },
    onShellReady() {
      res.writeHead(result.statusCode, {
        'Content-Type': 'text/html; charset=utf-8',
        ...(csp.isSecure && {
          'Content-Security-Policy': csp.cspHeader,
        }),
      });
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
        res.write(csp.script + htmlEnd, 'utf8');
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
