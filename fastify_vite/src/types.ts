import type {
  FastifyBaseLogger,
  FastifySchema,
  setCookieWrapper,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import type { RequestRouteOptions } from 'fastify/types/request';
import type { HttpHeader } from 'fastify/types/utils';
import type { Resource, ResourceKey, TFunction } from 'i18next';
import type { i18n } from 'i18next';

export interface ManifestSSG {
  path: string;
  header: string;
  hashes: string[];
}

export interface RenderProps {
  req: FastifyRequest;
  res: FastifyReply;
  i18n: i18n;
  props: RouteData;
  nonce?: string;
}

export type RenderFunction = (props: RenderProps) => Promise<React.JSX.Element>;

export interface SSRCtx {
  id: string;
  ip: string;
  ips?: string[];
  host: string;
  port: number | null;
  hostname: string;
  headers: { [k: string]: string };
  body: unknown;
  query: unknown;
  cookies: {
    [cookieName: string]: string | undefined;
  };
  url: string;
  originalUrl: string;
  protocol: 'http' | 'https';
  method: string;
  params: unknown;
  routePath: Record<string, string | undefined>;
  queryParams: {
    [k: string]: string;
  };
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

export type StaticProps<T = unknown> = RouteData<T> & i18nProps & ServerReply;
export type GetStaticProps<T = unknown> = Promise<StaticProps<T>>;

export interface ServerReply {
  redirect?: {
    statusCode?: number;
    url: string;
  };
  removeHeaders?: HttpHeader[];
  statusCode?: number;
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

export type RenderMode = 'ssr' | 'ssg' | 'csr';

export type StaticParams = Record<string, string>;

export interface StaticPageModule {
  generateStaticParams?: () => StaticParams[] | Promise<StaticParams[]>;
}
