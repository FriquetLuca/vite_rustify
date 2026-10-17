import * as fsp from 'node:fs/promises';
import { getStaticHtml } from './getStaticHtml.js';
import type { ViteDevServer } from 'vite';
import type { FastifyRequest } from 'fastify';

interface LoadHTMLTemplateProps {
  location: string;
  request: FastifyRequest;
  vite?: ViteDevServer;
}

export async function loadHTMLTemplate({
  location,
  request,
  vite,
}: LoadHTMLTemplateProps) {
  if (!__IS_PRODUCTION__) {
    const html = await fsp.readFile(location, 'utf8');
    return await vite!.transformIndexHtml(request.url, html);
  } else {
    return (await getStaticHtml(location))!;
  }
}
