import type {
  FastifyBaseLogger,
  FastifySchema,
  setCookieWrapper,
} from 'fastify';
import type { RequestRouteOptions } from 'fastify/types/request';
import type { HttpHeader } from 'fastify/types/utils';
import type { Resource, ResourceKey, TFunction } from 'i18next';
import type { i18n } from 'i18next';

export interface SSRCtx {
  id: string;
  ip: string;
  ips?: string[] | undefined;
  host: string;
  port: number | null;
  hostname: string;
  headers: { [k: string]: string };
  body: unknown;
  query: unknown;
  cookies: { [cookieName: string]: string | undefined };
  url: string;
  originalUrl: string;
  protocol: 'http' | 'https';
  method: string;
  params: unknown;
  routePath: Record<string, string | undefined>;
  queryParams: { [k: string]: string };
  t: TFunction<'translation', undefined>;
  i18n: i18n;
  language: string;
  languages: string[];
  is404: boolean;
  log: FastifyBaseLogger;
  routeOptions: Readonly<RequestRouteOptions<unknown, FastifySchema>>;
  setDecorator<T>(name: string | symbol, value: T): void;
  setCookie: setCookieWrapper;
}

export interface RouteData<T = unknown> {
  title?: string;
  data?: T;
}
export type RouteDataCache = Record<string, RouteData>;

export type StaticProps<T = unknown> = Promise<
  RouteData<T> & i18nProps & ServerReply
>;

export interface ServerReply {
  redirect?: {
    statusCode?: number;
    url: string;
  };
  removeHeaders?: HttpHeader[];
}

export interface i18nProps {
  i18nStore?: Record<string, Record<string, ResourceKey>>;
  language?: string;
}

export interface InitialProps {
  initialI18nStore: Resource;
  initialLanguage: string;
  initialNS: string[];
}
