import '../index.css';
import React from 'react';
import { I18nextProvider } from 'react-i18next';
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
} from 'react-router';

import type { RouteData } from '../types';
import type { i18n } from 'i18next';
import { createRoutes } from '../router/routes.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const HOST = process.env.VITE_HOST ?? '0.0.0.0';
const PORT = process.env.VITE_PORT ? Number(process.env.VITE_PORT) : 5173;

export async function render({
  req,
  res,
  i18n,
  props,
}: {
  req: FastifyRequest;
  res: FastifyReply;
  i18n: i18n;
  props: RouteData;
}) {
  const routes = createRoutes(props);
  const { query, dataRoutes } = createStaticHandler(routes);
  const request = createFetchRequest(req, res);
  const context = await query(request);

  if (context instanceof Response) {
    throw context;
  }

  const router = createStaticRouter(dataRoutes, context);
  return (
    <React.StrictMode>
      <I18nextProvider i18n={i18n}>
        <StaticRouterProvider router={router} context={context} />
      </I18nextProvider>
    </React.StrictMode>
  );
}

export function createFetchRequest(
  req: FastifyRequest,
  reply: FastifyReply
): Request {
  if (!req.headers) {
    const origin = `http://${HOST}:${PORT}`;
    const url = new URL(req.url, origin);
    const headers = new Headers();
    const controller = new AbortController();
    return new Request(url.href, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
  }
  const protocol =
    req.headers['x-forwarded-proto']?.toString().split(',')[0] || req.protocol;
  const host = req.headers.host || 'localhost';
  const origin = `${protocol}://${host}`;
  const requestUrl = req.raw.url || req.url;
  const url = new URL(requestUrl, origin);
  const controller = new AbortController();
  reply.raw.on('close', () => {
    controller.abort();
  });
  const headers = new Headers();
  for (const [key, values] of Object.entries(req.headers)) {
    if (values === undefined) {
      continue;
    }
    if (Array.isArray(values)) {
      for (const value of values) {
        headers.append(key, value);
      }
    } else {
      headers.set(key, values);
    }
  }
  const init: RequestInit = {
    method: req.method,
    headers,
    signal: controller.signal,
  };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = getRequestBody(req);
  }
  return new Request(url.href, init);
}

function getRequestBody(req: FastifyRequest): BodyInit | undefined {
  const body = req.body;
  if (body === undefined || body === null) {
    return undefined;
  }
  if (typeof body === 'string') {
    return body;
  }
  if (Buffer.isBuffer(body)) {
    return new Uint8Array(body);
  }
  if (typeof body === 'object') {
    return JSON.stringify(body);
  }
  return String(body);
}
