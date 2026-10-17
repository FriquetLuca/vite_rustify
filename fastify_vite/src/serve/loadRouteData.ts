import type { FastifyReply, FastifyRequest } from 'fastify';
import type { StaticProps } from '../types';
import type { ServerRoute } from '@router/server';

export interface LoadedRouteData {
  data: unknown;
  title?: string;
  statusCode: number;
  redirect?: {
    statusCode?: number;
    url: string;
  };
  i18nStore?: Record<string, Record<string, unknown>>;
  language?: string;
}

export async function loadRouteData({
  route,
  request,
  reply,
  params,
}: {
  route: ServerRoute;
  request: FastifyRequest;
  reply: FastifyReply;
  params: Record<string, string | undefined>;
}): Promise<LoadedRouteData> {
  if (!route.serverFile) {
    return {
      data: {},
      statusCode: 200,
    };
  }
  const pageModule = route.serverFile();
  if (!pageModule.default) {
    return {
      data: {},
      statusCode: 200,
    };
  }
  const fullUrl = new URL(
    request.raw.url ?? '/',
    `http://${request.raw.headers.host}`
  );
  const queryParams = Object.fromEntries(fullUrl.searchParams.entries());
  const result = (await pageModule.default({
    ...request,
    routePath: params,
    queryParams,
    setCookie: reply.setCookie,
  })) as StaticProps;
  if (result?.removeHeaders) {
    result.removeHeaders.forEach((header) => {
      reply.removeHeader(header);
    });
  }
  return {
    data: result?.data ?? {},
    title: result?.title,
    statusCode: result?.statusCode ?? 200,
    redirect: result?.redirect,
    i18nStore: result?.i18nStore,
    language: result?.language,
  };
}
