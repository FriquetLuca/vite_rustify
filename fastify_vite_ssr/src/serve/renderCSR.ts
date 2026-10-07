import type { FastifyReply, FastifyRequest } from 'fastify';

const scriptContent =
  `window.__SSR__=false;` +
  `window.__INITIAL_PROPS__={};` +
  `window.__ROUTE_DATA__={};`;

export function renderCSR({
  request: _request,
  reply,
  template,
  title,
}: {
  request: FastifyRequest;
  reply: FastifyReply;
  template: string;
  title: string;
}) {
  return reply
    .code(200)
    .type('text/html; charset=utf-8')
    .send(
      template
        .replace('<!--app-html-->', scriptContent)
        .replace('<!--app-title-->', title)
        .replace('<!--app-static-props-->', '')
    );
}
