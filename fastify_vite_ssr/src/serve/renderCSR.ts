import type { FastifyReply, FastifyRequest } from 'fastify';

export function renderCSR({
  request: _request,
  reply,
  template,
}: {
  request: FastifyRequest;
  reply: FastifyReply;
  template: string;
}) {
  return reply
    .code(200)
    .type('text/html; charset=utf-8')
    .send(
      template
        .replace('<!--app-title-->', '')
        .replace('<!--app-static-props-->', '')
    );
}
