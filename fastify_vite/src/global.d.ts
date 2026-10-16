import type { InitialProps, RouteDataCache } from './types';

export {};

declare global {
  interface Window {
    __INITIAL_PROPS__: InitialProps;
    __ROUTE_DATA__: RouteDataCache;
    __SSR__?: boolean;
  }
  declare const __IS_PRODUCTION__: boolean;
  declare const __IS_SERVER__: boolean;
}
