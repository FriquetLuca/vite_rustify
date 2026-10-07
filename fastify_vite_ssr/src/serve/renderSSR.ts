import crypto from 'node:crypto';
import { Transform } from 'node:stream';
import { renderToPipeableStream } from 'react-dom/server';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { InitialProps, RouteData } from '../types';
import type { RouteDefinition } from './routes';
import { loadRouteData } from './loadRouteData.js';
import { serverSideTranslations } from '../utils/serverSideTranslations.js';
import { matchPath } from 'react-router';

const ABORT_DELAY = process.env.VITE_ABORT_DELAY
  ? Number(process.env.VITE_ABORT_DELAY)
  : 10000;

export async function renderSSR({
  request,
  reply,
  route,
  render,
  template,
  title,
  mode,
}: {
  request: FastifyRequest;
  reply: FastifyReply;
  route: RouteDefinition;
  render: Function;
  template: string;
  title: string;
  mode: 'ssg' | 'ssr';
}) {
  const pathname = request.url.split('?')[0];
  const match = matchPath(
    {
      path: route.path,
      end: true,
    },
    pathname
  );

  if (!match) {
    return reply.code(404).send('Not Found');
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

  const nonce =
    mode === 'ssr' ? crypto.randomBytes(16).toString('base64') : undefined;
  let script: string;
  let scriptCsp: string;
  if (mode === 'ssr') {
    script = `<script nonce="${nonce}">` + scriptContent + `</script>`;
    scriptCsp = ` 'nonce-${nonce}'`;
  } else {
    script = `<script>` + scriptContent + `</script>`;
    scriptCsp = '';
  }
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
          .type('text/html')
          .send('<h1>Error 500: Something went wrong</h1>');
      }
    },
    onShellReady() {
      const csp = [
        "default-src 'self'",
        `script-src 'self'${scriptCsp}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self' data:",
      ].join('; ');

      res.writeHead(result.statusCode, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': csp,
      });
      const [htmlStart, htmlEnd] = template.split('<!--app-html-->');
      res.write(
        htmlStart
          .replace('<!--app-title-->', result.title ?? title)
          .replace('<!--app-static-props-->', ''),
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
