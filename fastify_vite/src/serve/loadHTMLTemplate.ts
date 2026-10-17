import * as fsp from 'node:fs/promises';
import type { ViteDevServer } from 'vite';
import type { FastifyRequest } from 'fastify';

interface LoadHTMLTemplateProps {
  location: string;
  request: FastifyRequest;
  vite?: ViteDevServer;
}

const templateCache = new Map<string, string>();

export async function loadHTMLTemplate({
  location,
  request,
  vite,
}: LoadHTMLTemplateProps) {
  if (!__IS_PRODUCTION__) {
    const html = await fsp.readFile(location, 'utf8');
    return await vite!.transformIndexHtml(request.url, html);
  } else {
    const cached = templateCache.get(location);
    if (cached !== undefined) {
      return cached;
    }
    try {
      const html = await fsp.readFile(location, 'utf8');
      templateCache.set(location, html);
      return html;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return '';
      }
      throw error;
    }
  }
}
